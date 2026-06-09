import { Injectable } from '@nestjs/common';
import { AssignmentStatus, EntityStatus, Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Pull side of the offline-sync protocol (docs/architecture/05, §4): a cursor
 * delta of the server-owned read models the iPad needs offline — the staff's
 * accessible students (`roster`), the curriculum scope/sequence with lesson
 * routines (`curriculum`), and those students' assignments (`assignments`).
 *
 * Cursors are opaque to the client: base64url(JSON) of a per-collection
 * `(updatedAt, id)` high-water mark (the §5 fallback ordering — no schema
 * change). The id tiebreaks rows sharing a millisecond so paging can't skip or
 * repeat. SOLER reads these tables from the co-located dev DB; in production
 * this is a local read model fed by the event backbone (same pattern as
 * AuthzService).
 */
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;
const COLLECTIONS = ['roster', 'curriculum', 'goals', 'assignments'] as const;
type Collection = (typeof COLLECTIONS)[number];

interface Mark {
  u: string; // updatedAt ISO
  id: string;
}
type CursorState = Partial<Record<Collection, Mark>>;

export interface ChangeRow {
  id: string;
  op: 'upsert' | 'delete';
  version: number;
  row?: Record<string, unknown>;
}

export interface ChangesResult {
  serverTime: string;
  changes: Partial<Record<Collection, ChangeRow[]>>;
  nextCursor: string;
  hasMore: boolean;
}

export interface ChangesOptions {
  collections?: string;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class ChangesService {
  constructor(private readonly prisma: PrismaService) {}

  async changes(tenantId: string, staffId: string, opts: ChangesOptions): Promise<ChangesResult> {
    const requested = this.parseCollections(opts.collections);
    const limit = Math.min(Math.max(Number(opts.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const cursor = this.decodeCursor(opts.cursor);
    const next: CursorState = { ...cursor };
    const changes: ChangesResult['changes'] = {};
    let hasMore = false;

    // roster / goals / assignments are scoped to the students this staff member
    // can reach (class-based, mirroring authz). Compute once, only if needed.
    const scoped: Collection[] = ['roster', 'goals', 'assignments'];
    const needsScope = requested.some((c) => scoped.includes(c));
    const scope = needsScope ? await this.accessibleScope(tenantId, staffId) : null;

    for (const c of requested) {
      const mark = cursor[c];
      const { rows, last, more } =
        c === 'roster'
          ? await this.roster(tenantId, scope!.studentIds, mark, limit)
          : c === 'curriculum'
            ? await this.curriculum(tenantId, mark, limit)
            : c === 'goals'
              ? await this.goals(tenantId, scope!.studentIds, mark, limit)
              : await this.assignments(tenantId, scope!.studentIds, scope!.classIds, mark, limit);

      if (rows.length) {
        changes[c] = rows;
        next[c] = last;
      }
      hasMore = hasMore || more;
    }

    return {
      serverTime: new Date().toISOString(),
      changes,
      nextCursor: this.encodeCursor(next),
      hasMore,
    };
  }

  /** Students reachable by this staff member: those enrolled in a class they staff. */
  private async accessibleScope(
    tenantId: string,
    staffId: string,
  ): Promise<{ studentIds: string[]; classIds: string[] }> {
    const staffClasses = await this.prisma.enrollment.findMany({
      where: { tenantId, userId: staffId, role: { not: RoleType.STUDENT } },
      select: { classId: true },
    });
    const classIds = [...new Set(staffClasses.map((e) => e.classId))];
    if (classIds.length === 0) return { studentIds: [], classIds };

    const studentEnr = await this.prisma.enrollment.findMany({
      where: { tenantId, role: RoleType.STUDENT, classId: { in: classIds } },
      select: { userId: true },
    });
    return { studentIds: [...new Set(studentEnr.map((e) => e.userId))], classIds };
  }

  private async roster(tenantId: string, studentIds: string[], mark: Mark | undefined, limit: number) {
    if (studentIds.length === 0) return { rows: [], last: undefined, more: false };
    const profiles = await this.prisma.studentProfile.findMany({
      where: { tenantId, userId: { in: studentIds }, ...keyset(mark, 'userId') },
      include: { user: { select: { givenName: true, familyName: true } } },
      orderBy: [{ updatedAt: 'asc' }, { userId: 'asc' }],
      take: limit + 1,
    });
    const page = profiles.slice(0, limit);
    return {
      rows: page.map<ChangeRow>((p) => ({
        id: p.userId,
        op: 'upsert',
        version: p.updatedAt.getTime(),
        row: {
          studentId: p.userId,
          givenName: p.user.givenName,
          familyName: p.user.familyName,
          grade: p.grade,
          age: p.age,
          primaryDiagnosis: p.primaryDiagnosis,
        },
      })),
      last: markOf(page, (p) => ({ u: p.updatedAt, id: p.userId })),
      more: profiles.length > limit,
    };
  }

  private async curriculum(tenantId: string, mark: Mark | undefined, limit: number) {
    const objectives = await this.prisma.curriculumObjective.findMany({
      where: { tenantId, status: EntityStatus.ACTIVE, ...keyset(mark, 'id') },
      include: {
        lessons: {
          where: { status: EntityStatus.ACTIVE },
          orderBy: [{ sequence: 'asc' }],
          select: { id: true, code: true, title: true, sequence: true, steps: true, estimatedMinutes: true },
        },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const page = objectives.slice(0, limit);
    return {
      rows: page.map<ChangeRow>((o) => ({
        id: o.id,
        op: 'upsert',
        version: o.updatedAt.getTime(),
        row: {
          objectiveId: o.id,
          code: o.code,
          domain: o.domain,
          title: o.title,
          description: o.description,
          sequence: o.sequence,
          lessons: o.lessons,
        },
      })),
      last: markOf(page, (o) => ({ u: o.updatedAt, id: o.id })),
      more: objectives.length > limit,
    };
  }

  private async goals(tenantId: string, studentIds: string[], mark: Mark | undefined, limit: number) {
    if (studentIds.length === 0) return { rows: [], last: undefined, more: false };
    // IepGoal.studentId references StudentProfile.id ("sp-<userId>"); the iPad
    // keys everything on the raw student User.id, so map in and strip out.
    const profileIds = studentIds.map((id) => `sp-${id}`);
    const goals = await this.prisma.iepGoal.findMany({
      where: { tenantId, studentId: { in: profileIds }, ...keyset(mark, 'id') },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const page = goals.slice(0, limit);
    return {
      rows: page.map<ChangeRow>((g) => ({
        id: g.id,
        op: 'upsert',
        version: g.updatedAt.getTime(),
        row: {
          goalId: g.id,
          studentId: g.studentId.replace(/^sp-/, ''),
          classId: g.classId,
          domain: g.domain,
          description: g.description,
          objectiveId: g.curriculumObjectiveId,
          status: g.status,
          goalMet: g.goalMet,
        },
      })),
      last: markOf(page, (g) => ({ u: g.updatedAt, id: g.id })),
      more: goals.length > limit,
    };
  }

  private async assignments(
    tenantId: string,
    studentIds: string[],
    classIds: string[],
    mark: Mark | undefined,
    limit: number,
  ) {
    const reach: Prisma.CurriculumAssignmentWhereInput[] = [];
    if (studentIds.length) reach.push({ studentId: { in: studentIds } });
    if (classIds.length) reach.push({ classId: { in: classIds } });
    if (reach.length === 0) return { rows: [], last: undefined, more: false };

    const rows = await this.prisma.curriculumAssignment.findMany({
      // AND the access scope (OR over student/class reach) with the keyset
      // predicate (also an OR) — spreading both would collide on `OR` and the
      // keyset would silently drop the scope, leaking the whole tenant.
      where: { tenantId, AND: [{ OR: reach }, keyset(mark, 'id')] },
      include: { objective: { select: { code: true, domain: true, title: true } } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      // Archived assignments are tombstones so the client prunes its cache.
      rows: page.map<ChangeRow>((a) => ({
        id: a.id,
        op: a.status === AssignmentStatus.ARCHIVED ? 'delete' : 'upsert',
        version: a.updatedAt.getTime(),
        row:
          a.status === AssignmentStatus.ARCHIVED
            ? undefined
            : {
                id: a.id,
                objectiveId: a.objectiveId,
                lessonId: a.lessonId,
                classId: a.classId,
                studentId: a.studentId,
                status: a.status,
                lastAccuracy: a.lastAccuracy,
                masteredAt: a.masteredAt,
                objective: a.objective,
              },
      })),
      last: markOf(page, (a) => ({ u: a.updatedAt, id: a.id })),
      more: rows.length > limit,
    };
  }

  private parseCollections(raw?: string): Collection[] {
    if (!raw) return [...COLLECTIONS];
    const wanted = new Set(raw.split(',').map((s) => s.trim()));
    const picked = COLLECTIONS.filter((c) => wanted.has(c));
    return picked.length ? picked : [...COLLECTIONS];
  }

  private decodeCursor(cursor?: string): CursorState {
    if (!cursor) return {};
    try {
      const json = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(json) as CursorState;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {}; // unparseable cursor -> treat as initial sync
    }
  }

  private encodeCursor(state: CursorState): string {
    return Buffer.from(JSON.stringify(state)).toString('base64url');
  }
}

/** Keyset predicate for `(updatedAt, <idField>) > mark` — stable, no skips/repeats. */
function keyset(mark: Mark | undefined, idField: 'id' | 'userId'): Record<string, unknown> {
  if (!mark) return {};
  const at = new Date(mark.u);
  return {
    OR: [{ updatedAt: { gt: at } }, { updatedAt: at, [idField]: { gt: mark.id } }],
  };
}

function markOf<T>(page: T[], pick: (row: T) => { u: Date; id: string }): Mark | undefined {
  if (page.length === 0) return undefined;
  const { u, id } = pick(page[page.length - 1]);
  return { u: u.toISOString(), id };
}
