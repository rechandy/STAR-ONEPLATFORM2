import { Module } from '@nestjs/common';
import { brokerProvider } from './broker.provider';
import { OutboxRelay } from './outbox-relay.service';
import { ReportingProjector } from './reporting-projector.service';

@Module({
  providers: [brokerProvider, OutboxRelay, ReportingProjector],
  exports: [brokerProvider, OutboxRelay],
})
export class MessagingModule {}
