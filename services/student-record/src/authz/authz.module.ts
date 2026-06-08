import { Module } from '@nestjs/common';
import { AuthzService } from './authz.service';
import { StudentAccessGuard } from './student-access.guard';

@Module({
  providers: [AuthzService, StudentAccessGuard],
  exports: [AuthzService, StudentAccessGuard],
})
export class AuthzModule {}
