import { Controller, Get, Param } from '@nestjs/common';
import { StaffId, TenantId } from '../common/request-context';
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

  /** The full staff access set for a student (the authorization decision input). */
  @Get('students/:studentId/access')
  accessSet(@TenantId() tenantId: string, @Param('studentId') studentId: string) {
    return this.roster.accessSet(tenantId, studentId);
  }
}
