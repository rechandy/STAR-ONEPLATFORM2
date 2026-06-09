import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { AuthzService } from '../authz/authz.service';
import { PrismaService } from '../prisma/prisma.service';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const encodeCursor = (id: string) => Buffer.from(id).toString('base64url');
const decodeCursor = (c: string) => Buffer.from(c, 'base64url').toString('utf8');

export interface ListOptions {
  status?: string;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  /** Reverse-chronological, cursor-paginated data-collection sessions for a student. */
  async listByStudent(tenantId: string, studentId: string, opts: ListOptions) {
    const status =
      opts.status && (Object.values(SessionStatus) as string[]).includes(opts.status)
        ? (opts.status as SessionStatus)
        : undefined;
    const limit = Math.min(Math.max(Number(opts.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    const rows = await this.prisma.dataCollectionSession.findMany({
      where: { tenantId, studentId, ...(status ? { status } : {}) },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: decodeCursor(opts.cursor) }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      studentId,
      count: page.length,
      sessions: page.map((s) => ({
        id: s.id,
        goalId: s.goalId,
        classId: s.classId,
        domain: s.domain,
        status: s.status,
        promptLevel: s.promptLevel,
        totalTrials: s.totalTrials,
        correctTrials: s.correctTrials,
        accuracy: s.accuracy,
        goalMastered: s.goalMastered,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1].id) : null,
    };
  }

  /**
   * Mastery report for one session: header + trial-by-trial detail + a running
   * accuracy curve. Authorizes against the session's student (Cedar viewStudent),
   * since the student is resolved from the row, not the URL.
   */
  async report(tenantId: string, staffId: string, sessionId: string) {
    const session = await this.prisma.dataCollectionSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException(`Unknown session ${sessionId}`);

    const allowed = await this.authz.canAccessStudent(
      tenantId,
      staffId,
      'viewStudent',
      session.studentId,
    );
    if (!allowed) {
      throw new ForbiddenException(`Not authorized to view data for ${session.studentId}.`);
    }

    const trials = await this.prisma.trial.findMany({
      where: { tenantId, sessionId },
      orderBy: [{ ordinal: 'asc' }, { occurredAt: 'asc' }],
    });

    let runningCorrect = 0;
    const curve = trials.map((t, i) => {
      if (t.correct) runningCorrect++;
      return {
        ordinal: t.ordinal,
        correct: t.correct,
        promptLevel: t.promptLevel,
        cumulativeAccuracy: runningCorrect / (i + 1),
        occurredAt: t.occurredAt,
      };
    });

    return {
      session: {
        id: session.id,
        studentId: session.studentId,
        goalId: session.goalId,
        classId: session.classId,
        domain: session.domain,
        status: session.status,
        promptLevel: session.promptLevel,
        masteryTarget: session.masteryTarget,
        totalTrials: session.totalTrials,
        correctTrials: session.correctTrials,
        accuracy: session.accuracy,
        goalMastered: session.goalMastered,
        metricEventId: session.metricEventId,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      },
      trials: curve,
    };
  }
}
