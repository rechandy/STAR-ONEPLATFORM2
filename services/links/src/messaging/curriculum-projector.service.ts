import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { AssignmentStatus, MetricType } from '@prisma/client';
import {
  EVENT_TYPES,
  idempotent,
  topicForType,
  validateEnvelope,
  type Broker,
  type EventEnvelope,
  type StudentMetricV1,
} from '@oneplatform/events';
import { PrismaService } from '../prisma/prisma.service';
import { EVENT_BROKER } from './broker.provider';

/**
 * Consumes `student.metric.v1` to ADAPT INSTRUCTION (roadmap Phase 2): when a
 * SOLER outcome lands for a goal, Links advances the matching curriculum
 * assignment — recording the latest accuracy and flipping it to MASTERED when
 * the objective is mastered. This is Links' own read model (CQRS, ADR-0004); the
 * goal -> objective mapping comes from the IepGoal bridge.
 */
@Injectable()
export class CurriculumProjector implements OnModuleInit {
  private readonly logger = new Logger(CurriculumProjector.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BROKER) private readonly broker: Broker,
  ) {}

  onModuleInit(): void {
    this.broker.subscribe(
      topicForType(EVENT_TYPES.STUDENT_METRIC_V1),
      idempotent((env) => this.onMetric(env)),
    );
  }

  private async onMetric(env: EventEnvelope): Promise<void> {
    const { valid, errors } = validateEnvelope(env);
    if (!valid) {
      this.logger.warn(`Dropping invalid ${env.type}: ${errors.join('; ')}`);
      return; // dead-letter in production
    }
    const p = env.payload as StudentMetricV1;
    if (!p.goalId) return; // only goal-linked outcomes map to curriculum

    // Map the IEP goal to the Links curriculum objective it was written from.
    const goal = await this.prisma.iepGoal.findFirst({
      where: { id: p.goalId, tenantId: p.tenantId },
      select: { curriculumObjectiveId: true },
    });
    const objectiveId = goal?.curriculumObjectiveId;
    if (!objectiveId) return; // goal not derived from a curriculum objective

    const mastered = p.metricType === MetricType.OBJECTIVE_MASTERED;
    const accuracy =
      typeof (p.value as { accuracy?: unknown })?.accuracy === 'number'
        ? (p.value as { accuracy: number }).accuracy
        : undefined;

    const updated = await this.prisma.curriculumAssignment.updateMany({
      where: {
        tenantId: p.tenantId,
        objectiveId,
        studentId: p.studentId,
        status: { not: AssignmentStatus.ARCHIVED },
      },
      data: mastered
        ? { status: AssignmentStatus.MASTERED, masteredAt: new Date(p.occurredAt), ...(accuracy !== undefined ? { lastAccuracy: accuracy } : {}) }
        : { status: AssignmentStatus.IN_PROGRESS, ...(accuracy !== undefined ? { lastAccuracy: accuracy } : {}) },
    });

    if (updated.count > 0) {
      this.logger.log(
        `Adapted ${updated.count} assignment(s) for student=${p.studentId} objective=${objectiveId} (${mastered ? 'MASTERED' : 'IN_PROGRESS'})`,
      );
    }
  }
}
