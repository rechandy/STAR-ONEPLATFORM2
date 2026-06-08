import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';

@Module({
  imports: [AuthzModule],
  controllers: [RosterController],
  providers: [RosterService],
})
export class RosterModule {}
