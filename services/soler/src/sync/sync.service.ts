import { Injectable, Logger } from '@nestjs/common';
import { GoalDomain, MetricSource, MetricType, Prisma, SessionStatus } from '@prisma/client';
import { EVENT_TYPES, type StudentMetricV1 } from '@oneplatform/events';
import { AuthzService } from '../authz/authz.service';
import { PrismaService } from '../prisma/prisma.service';
import type { MutationDto, MutationResult, SyncMutationsDto } from './dto';

const DOMAINS = new Set<string>(Object.values(GoalDomain));

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  /**
   * Process a batch of offline-captured SOLER mutations. Each op is independent
   * and idempotent; each is authorized individually with Cedar
   * `recordStudentData` before any write. Returns one result per op.
   */
  async applyMutations(
    tenantId: string,
    staffId: string,
    dto: SyncMutationsDto,
  ): Promise<{ serverTime: string; results: MutationResult[] }> {
    const results: MutationResult[] = [];
    for (const m of dto.mutations) {
      results.push(await this.applyOne(tenantId, staffId, m));
    }
    return { serverTime: new Date().toISOString(), results };
  }

  private async applyOne(
    tenantId: string,
    staffId: string,
    m: MutationDto,
  ): Promise<MutationResult> {
    if (m.collection === 'session' && m.op === 'create') return this.createSession(tenantId, staffId, m);
    if (m.collection === 'trial' && m.op === 'create') return this.createTrial(tenantId, staffId, m);
    if (m.collection === 'session' && m.op === 'finalize') return this.finalizeSession(tenantId, staffId, m);
    return reject(m.opId, 'unsupported', `Unsupported ${m.collection}/${m.op}`);
  }

  /** Open a data-collection session. The client supplies the session id (cuid). */
  private async createSession(
    tenantId: string,
    staffId: string,
    m: MutationDto,
  ): Promise<MutationResult> {
    const p = m.payload;
    const sessionId = str(p.sessionId) ? p.sessionId : undefined;
    const studentId = str(p.studentId) ? p.studentId : undefined;
    const domain = str(p.domain) ? p.domain : undefined;

    if (!sessionId) return reject(m.opId, 'invalid', 'payload.sessionId is required');
    if (!studentId) return reject(m.opId, 'invalid', 'payload.studentId is required');
    if (!domain || !DOMAINS.has(domain)) return reject(m.opId, 'invalid', `payload.domain invalid: ${domain}`);

    if (!(await this.authz.canAccessStudent(tenantId, staffId, 'recordStudentData', studentId))) {
      return reject(m.opId, 'forbidden', `Not authorized to record data for ${studentId}`);
    }

    const masteryTarget = num(p.masteryTarget) ? p.masteryTarget : null;
    if (masteryTarget !== null && (masteryTarget < 0 || masteryTarget > 1)) {
      return reject(m.opId, 'invalid', 'payload.masteryTarget must be in [0,1]');
    }

    try {
      const created = await this.prisma.dataCollectionSession.create({
        data: {
          id: sessionId,
          tenantId,
          studentId,
          goalId: str(p.goalId) ? p.goalId : null,
          classId: str(p.classId) ? p.classId : null,
          recordedById: staffId,
          domain: domain as GoalDomain,
          promptLevel: num(p.promptLevel) ? p.promptLevel : null,
          masteryTarget,
          note: str(p.note) ? p.note : null,
          startedAt: new Date((p.startedAt as string) ?? m.occurredAt ?? Date.now()),
        },
        select: { id: true },
      });
      return { opId: m.opId, status: 'applied', serverId: created.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { opId: m.opId, status: 'duplicate', serverId: sessionId };
      }
      this.logger.error(`session/create ${m.opId} failed`, e as Error);
      return reject(m.opId, 'internal', 'Failed to create session');
    }
  }

  /** Append one discrete-trial datapoint to an open session. */
  private async createTrial(
    tenantId: string,
    staffId: string,
    m: MutationDto,
  ): Promise<MutationResult> {
    const p = m.payload;
    const sessionId = str(p.sessionId) ? p.sessionId : undefined;
    if (!sessionId) return reject(m.opId, 'invalid', 'payload.sessionId is required');
    if (typeof p.correct !== 'boolean') return reject(m.opId, 'invalid', 'payload.correct must be a boolean');
    if (!num(p.ordinal)) return reject(m.opId, 'invalid', 'payload.ordinal must be a number');

    const session = await this.prisma.dataCollectionSession.findFirst({
      where: { id: sessionId, tenantId },
      select: { studentId: true, status: true },
    });
    if (!session) return reject(m.opId, 'invalid', `Unknown session ${sessionId}`);
    if (session.status !== SessionStatus.IN_PROGRESS) {
      return reject(m.opId, 'conflict', `Session ${sessionId} is not in progress`);
    }

    if (!(await this.authz.canAccessStudent(tenantId, staffId, 'recordStudentData', session.studentId))) {
      return reject(m.opId, 'forbidden', `Not authorized to record data for ${session.studentId}`);
    }

    try {
      const created = await this.prisma.trial.create({
        data: {
          tenantId,
          sessionId,
          idempotencyKey: m.opId,
          ordinal: p.ordinal,
          correct: p.correct,
          promptLevel: num(p.promptLevel) ? p.promptLevel : null,
          note: str(p.note) ? p.note : null,
          occurredAt: new Date((p.occurredAt as string) ?? m.occurredAt ?? Date.now()),
        },
        select: { id: true },
      });
      return { opId: m.opId, status: 'applied', serverId: created.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { opId: m.opId, status: 'duplicate' };
      }
      this.logger.error(`trial/create ${m.opId} failed`, e as Error);
      return reject(m.opId, 'internal', 'Failed to record trial');
    }
  }

  /**
   * Close a session: compute accuracy from its trials and, in ONE transaction,
   * write the canonical MetricEvent(s) + outbox `student.metric.v1` (ADR-0003)
   * so Student Record + Reporting update. Idempotent: a finalized session
   * returns `duplicate`.
   */
  private async finalizeSession(
    tenantId: string,
    staffId: string,
    m: MutationDto,
  ): Promise<MutationResult> {
    const sessionId = str(m.payload.sessionId) ? m.payload.sessionId : undefined;
    if (!sessionId) return reject(m.opId, 'invalid', 'payload.sessionId is required');

    const session = await this.prisma.dataCollectionSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) return reject(m.opId, 'invalid', `Unknown session ${sessionId}`);

    if (!(await this.authz.canAccessStudent(tenantId, staffId, 'recordStudentData', session.studentId))) {
      return reject(m.opId, 'forbidden', `Not authorized to record data for ${session.studentId}`);
    }
    if (session.status === SessionStatus.COMPLETED) {
      return { opId: m.opId, status: 'duplicate', serverId: session.metricEventId ?? session.id };
    }

    const [total, correct] = await Promise.all([
      this.prisma.trial.count({ where: { tenantId, sessionId } }),
      this.prisma.trial.count({ where: { tenantId, sessionId, correct: true } }),
    ]);
    if (total === 0) return reject(m.opId, 'invalid', 'Cannot finalize a session with no trials');
    const accuracy = correct / total;
    const goalMastered =
      session.masteryTarget !== null && accuracy >= session.masteryTarget && !!session.goalId;
    const occurredAt = new Date(m.payload.occurredAt as string ?? m.occurredAt ?? Date.now());

    try {
      const accuracyMetricId = await this.prisma.$transaction(async (tx) => {
        const accuracyMetric = await this.emitMetric(tx, {
          tenantId,
          idempotencyKey: `${sessionId}:accuracy`,
          metricType: MetricType.ACCURACY_SNAPSHOT,
          studentId: session.studentId,
          goalId: session.goalId,
          classId: session.classId,
          recordedById: staffId,
          value: { accuracy, trials: total, correct, promptLevel: session.promptLevel },
          occurredAt,
          schemaVersion: m.schemaVersion ?? 1,
        });

        if (goalMastered) {
          await this.emitMetric(tx, {
            tenantId,
            idempotencyKey: `${sessionId}:mastered`,
            metricType: MetricType.OBJECTIVE_MASTERED,
            studentId: session.studentId,
            goalId: session.goalId,
            classId: session.classId,
            recordedById: staffId,
            value: { goalId: session.goalId, accuracy, masteryTarget: session.masteryTarget },
            occurredAt,
            schemaVersion: m.schemaVersion ?? 1,
          });
        }

        await tx.dataCollectionSession.update({
          where: { id: sessionId },
          data: {
            status: SessionStatus.COMPLETED,
            totalTrials: total,
            correctTrials: correct,
            accuracy,
            goalMastered,
            metricEventId: accuracyMetric,
            completedAt: occurredAt,
          },
        });
        return accuracyMetric;
      });
      return { opId: m.opId, status: 'applied', serverId: accuracyMetricId };
    } catch (e) {
      this.logger.error(`session/finalize ${m.opId} failed`, e as Error);
      return reject(m.opId, 'internal', 'Failed to finalize session');
    }
  }

  /**
   * Write a canonical MetricEvent AND its outbox row in the caller's transaction
   * (no dual-write). Returns the new MetricEvent id. Mirrors student-record's
   * write+emit so every producer speaks the one `student.metric.v1` shape.
   */
  private async emitMetric(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      idempotencyKey: string;
      metricType: MetricType;
      studentId: string;
      goalId: string | null;
      classId: string | null;
      recordedById: string;
      value: Record<string, unknown>;
      occurredAt: Date;
      schemaVersion: number;
    },
  ): Promise<string> {
    const metric = await tx.metricEvent.create({
      data: {
        tenantId: input.tenantId,
        idempotencyKey: input.idempotencyKey,
        source: MetricSource.SOLER,
        metricType: input.metricType,
        studentId: input.studentId,
        goalId: input.goalId,
        classId: input.classId,
        recordedById: input.recordedById,
        value: input.value as Prisma.InputJsonValue,
        occurredAt: input.occurredAt,
        schemaVersion: input.schemaVersion,
      },
      select: { id: true },
    });

    const payload: StudentMetricV1 = {
      metricId: metric.id,
      tenantId: input.tenantId,
      studentId: input.studentId,
      goalId: input.goalId,
      classId: input.classId,
      source: MetricSource.SOLER,
      metricType: input.metricType,
      value: input.value,
      occurredAt: input.occurredAt.toISOString(),
      recordedById: input.recordedById,
      schemaVersion: input.schemaVersion,
    };
    await tx.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        aggregateType: 'MetricEvent',
        aggregateId: metric.id,
        type: EVENT_TYPES.STUDENT_METRIC_V1,
        payload: payload as unknown as Prisma.InputJsonValue,
        occurredAt: input.occurredAt,
        schemaVersion: input.schemaVersion,
      },
    });
    return metric.id;
  }
}

function reject(opId: string, code: string, message: string): MutationResult {
  return { opId, status: 'rejected', error: { code, message } };
}
