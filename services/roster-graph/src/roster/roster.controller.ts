import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { StaffId, TenantId } from '../common/request-context';
import { StudentAccessGuard, StudentAction } from '../authz/student-access.guard';
import { RosterService } from './roster.service';

@Controller('roster')
export class RosterController {
  constructor(private readonly roster: RosterService) {}

  /** Classes the acting staff member teaches or serves. */
  @Get('my-classes')
  myClasses(@TenantId() tenantId: string, @StaffId() staffId: string) {
    return this.roster.myClasses(tenantId, staffId);
  }

  /** Every student the acting staff member can access (across all their sections). */
  @Get('my-students')
  myStudents(@TenantId() tenantId: string, @StaffId() staffId: string) {
    return this.roster.myStudents(tenantId, staffId);
  }

  /** The acting specialist's related-service caseload. */
  @Get('my-caseload')
  myCaseload(@TenantId() tenantId: string, @StaffId() staffId: string) {
    return this.roster.myCaseload(tenantId, staffId);
  }

  /**
   * Protected student detail (profile + goals + Links objectives).
   * Enforced by Cedar `viewStudent` — only authorized staff may read it.
   */
  @Get('students/:studentId')
  @UseGuards(StudentAccessGuard)
  @StudentAction('viewStudent')
  getStudent(@TenantId() tenantId: string, @Param('studentId') studentId: string) {
    return this.roster.studentDetail(tenantId, studentId);
  }

  /**
   * The full staff access set for a student. Also guarded: only staff already
   * authorized for the student (or an admin) may see who can access them.
   */
  @Get('students/:studentId/access')
  @UseGuards(StudentAccessGuard)
  @StudentAction('viewStudent')
  accessSet(@TenantId() tenantId: string, @Param('studentId') studentId: string) {
    return this.roster.accessSet(tenantId, studentId);
  }
}
