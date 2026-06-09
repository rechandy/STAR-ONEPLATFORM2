import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { StaffId, TenantId } from '../common/request-context';
import { StaffIdentityGuard } from '../common/staff-identity.guard';
import { StudentAccessGuard } from '../authz/student-access.guard';
import { SessionsService } from './sessions.service';

@Controller()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** A student's data-collection sessions, cursor-paginated. Cedar `viewStudent`. */
  @Get('students/:studentId/sessions')
  @UseGuards(StudentAccessGuard)
  list(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.sessions.listByStudent(tenantId, studentId, {
      status,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  /** Mastery report for a session. Authorized in the service against its student. */
  @Get('sessions/:sessionId')
  @UseGuards(StaffIdentityGuard)
  report(
    @TenantId() tenantId: string,
    @StaffId() staffId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessions.report(tenantId, staffId, sessionId);
  }
}
