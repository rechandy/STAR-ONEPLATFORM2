import { Module } from '@nestjs/common';
import { EventBackbone } from './event-backbone';
import { brokerProvider } from './broker.provider';
import { CurriculumProjector } from './curriculum-projector.service';

/**
 * Links' inbound event plumbing. Links is a metric CONSUMER: the projector
 * subscribes to `student.metric.v1` and advances curriculum assignments
 * (adapt-instruction read model). No outbox here — Links doesn't emit in this
 * slice.
 */
@Module({
  providers: [EventBackbone, brokerProvider, CurriculumProjector],
  exports: [brokerProvider],
})
export class MessagingModule {}
