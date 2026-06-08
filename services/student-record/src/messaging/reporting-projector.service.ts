import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
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
 * DEMONSTRATION consumer of `student.metric.v1` that maintains the OutcomeRollup
 * read model (CQRS, ADR-0004) — proving events propagate into a projection.
 * In production this consumer lives in the **Reporting** service; SOLER and
 * Links subscribe to the same topic for their own read models.
 */
@Injectable()
export class ReportingProjector implements OnModuleInit {
  private readonly logger = new Logger(ReportingProjector.name);

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
    await this.prisma.outcomeRollup.upsert({
      where: { tenantId_studentId: { tenantId: p.tenantId, studentId: p.studentId } },
      create: {
        tenantId: p.tenantId,
        studentId: p.studentId,
        totalMetrics: 1,
        lastMetricType: p.metricType,
        lastOccurredAt: new Date(p.occurredAt),
      },
      update: {
        totalMetrics: { increment: 1 },
        lastMetricType: p.metricType,
        lastOccurredAt: new Date(p.occurredAt),
      },
    });
  }
}
