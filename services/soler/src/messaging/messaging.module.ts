import { Module } from '@nestjs/common';
import { EventBackbone } from './event-backbone';
import { brokerProvider } from './broker.provider';
import { OutboxRelay } from './outbox-relay.service';

/**
 * SOLER's outbound event plumbing. SOLER is a metric PRODUCER: the relay drains
 * the transactional outbox (student.metric.v1) onto the backbone, where Student
 * Record + Reporting consume it. No projector here — SOLER emits, it doesn't
 * subscribe.
 */
@Module({
  providers: [EventBackbone, brokerProvider, OutboxRelay],
  exports: [brokerProvider, OutboxRelay],
})
export class MessagingModule {}
