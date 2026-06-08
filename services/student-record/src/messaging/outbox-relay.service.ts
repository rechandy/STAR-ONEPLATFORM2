import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxStatus } from '@prisma/client';
import type { Broker, EventEnvelope } from '@oneplatform/events';
import { PrismaService } from '../prisma/prisma.service';
import { EVENT_BROKER } from './broker.provider';

/**
 * Polls the transactional outbox and publishes PENDING rows to the broker,
 * marking them PUBLISHED (ADR-0003). Failures back off via attempt counting and
 * land in FAILED after MAX_ATTEMPTS. In production this role is typically played
 * by Debezium CDC streaming the outbox into Kafka; this app-level relay is the
 * equivalent for environments without CDC.
 *
 * NOTE: single-instance dev relay. For multiple replicas, claim rows with
 * `SELECT ... FOR UPDATE SKIP LOCKED` to avoid double-publishing.
 */
@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private readonly maxAttempts = 5;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BROKER) private readonly broker: Broker,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const ms = this.config.get<number>('relayPollMs', 500);
    this.timer = setInterval(() => void this.drainOnce(), ms);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Publish a batch of pending events. Returns how many were published. */
  async drainOnce(limit = 100): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const rows = await this.prisma.outboxEvent.findMany({
        where: { status: OutboxStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      let published = 0;
      for (const row of rows) {
        const env: EventEnvelope = {
          id: row.id,
          type: row.type,
          tenantId: row.tenantId,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          occurredAt: row.occurredAt.toISOString(),
          schemaVersion: row.schemaVersion,
          payload: row.payload,
        };
        try {
          await this.broker.publish(env);
          await this.prisma.outboxEvent.update({
            where: { id: row.id },
            data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
          });
          published++;
        } catch (e) {
          const attempts = row.attempts + 1;
          await this.prisma.outboxEvent.update({
            where: { id: row.id },
            data: {
              attempts,
              lastError: String(e),
              status: attempts >= this.maxAttempts ? OutboxStatus.FAILED : OutboxStatus.PENDING,
            },
          });
          this.logger.warn(`Relay publish failed for ${row.id} (attempt ${attempts})`);
        }
      }
      return published;
    } finally {
      this.running = false;
    }
  }
}
