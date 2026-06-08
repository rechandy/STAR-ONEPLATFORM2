import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [AuthzModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
