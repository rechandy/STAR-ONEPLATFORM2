import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { ChangesService } from './changes.service';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [AuthzModule],
  controllers: [SyncController],
  providers: [SyncService, ChangesService],
})
export class SyncModule {}
