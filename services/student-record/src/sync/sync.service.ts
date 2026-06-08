import { Injectable, Logger } from '@nestjs/common';
import { MetricSource, MetricType, Prisma } from '@prisma/client';
import { AuthzService } from '../authz/authz.service';
import { PrismaService } from '../prisma/prisma.service';
import { isRecordable, validateOutcomeValue } from '../outcomes/taxonomy';
import type { MutationDto, MutationResult, SyncMutationsDto } from './dto';

const METRIC_SOURCES = new Set<string>(Object.values(MetricSource));

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  /**
   * Process a batch of offline-captured mutations. Each op is independent and
   * idempotent (dedup on opId); each is authorized individually with Cedar
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
    if (m.collection !== 'metricEvent' || m.op !== 'create') {
      return reject(m.opId, 'unsupported', `Unsupported ${m.collection}/${m.op}`);
    }

    const p = m.payload as Record<string, unknown>;
    const studentId = typeof p.studentId === 'string' ? p.studentId : undefined;
    const metricType = typeof p.metricType === 'string' ? p.metricType : undefined;
    const source = typeof p.source === 'string' ? p.source : MetricSource.SOLER;

    if (!studentId) return reject(m.opId, 'invalid', 'payload.studentId is required');
    if (!metricType || !isRecordable(metricType)) {
      return reject(m.opId, 'invalid', `payload.metricType not a recordable outcome: ${metricType}`);
    }
    if (!METRIC_SOURCES.has(source)) {
      return reject(m.opId, 'invalid', `payload.source invalid: ${source}`);
    }
    const valueError = validateOutcomeValue(metricType, p.value);
    if (valueError) {
      return reject(m.opId, 'invalid', valueError);
    }

    // Authorization: the acting staff must be allowed to record data for this
    // student (Cedar `recordStudentData` — shared class + instructional role).
    const allowed = await this.authz.canAccessStudent(
      tenantId,
      staffId,
      'recordStudentData',
      studentId,
    );
    if (!allowed) {
      return reject(m.opId, 'forbidden', `Not authorized to record data for ${studentId}`);
    }

    const occurredAt = new Date((p.occurredAt as string) ?? m.occurredAt ?? Date.now());
    try {
      const created = await this.prisma.metricEvent.create({
        data: {
          tenantId,
          idempotencyKey: m.opId,
          source: source as MetricSource,
          metricType: metricType as MetricType,
          studentId,
          goalId: typeof p.goalId === 'string' ? p.goalId : null,
          classId: typeof p.classId === 'string' ? p.classId : null,
          recordedById: staffId,
          value: (p.value ?? {}) as Prisma.InputJsonValue,
          occurredAt,
          schemaVersion: typeof m.schemaVersion === 'number' ? m.schemaVersion : 1,
        },
        select: { id: true },
      });
      return { opId: m.opId, status: 'applied', serverId: created.id };
    } catch (e) {
      // Unique violation on (tenantId, idempotencyKey) => already applied.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { opId: m.opId, status: 'duplicate' };
      }
      this.logger.error(`Mutation ${m.opId} failed`, e as Error);
      return reject(m.opId, 'internal', 'Failed to persist mutation');
    }
  }
}

function reject(opId: string, code: string, message: string): MutationResult {
  return { opId, status: 'rejected', error: { code, message } };
}
