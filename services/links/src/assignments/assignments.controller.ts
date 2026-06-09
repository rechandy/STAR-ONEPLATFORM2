import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { StaffId, TenantId } from '../common/request-context';
import { StaffIdentityGuard } from '../common/staff-identity.guard';
import { StudentAccessGuard } from '../authz/student-access.guard';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto';

@Controller()
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  /** Assign curriculum to a class or student. Authorized per target in the service. */
  @Post('assignments')
  @UseGuards(StaffIdentityGuard)
  create(
    @TenantId() tenantId: string,
    @StaffId() staffId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignments.create(tenantId, staffId, dto);
  }

  /** A student's assigned curriculum (direct + via their classes). Cedar `viewStudent`. */
  @Get('students/:studentId/assignments')
  @UseGuards(StudentAccessGuard)
  byStudent(@TenantId() tenantId: string, @Param('studentId') studentId: string) {
    return this.assignments.listByStudent(tenantId, studentId);
  }

  /** A class's assigned curriculum. Authorized against the class in the service. */
  @Get('classes/:classId/assignments')
  @UseGuards(StaffIdentityGuard)
  byClass(
    @TenantId() tenantId: string,
    @StaffId() staffId: string,
    @Param('classId') classId: string,
  ) {
    return this.assignments.listByClass(tenantId, staffId, classId);
  }
}
