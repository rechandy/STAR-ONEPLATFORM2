import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { StaffId, TenantId } from '../common/request-context';
import { CreateParentDto, CreateStudentDto, CreateTeacherDto } from './dto';
import { ProvisioningService } from './provisioning.service';

/**
 * Admin onboarding: provision teachers, students, and parents. Every endpoint
 * authorizes the acting staff with Cedar `manageRoster` on the target school
 * before writing (district admins anywhere; school admins for their school).
 */
@Controller('admin')
export class AdminController {
  constructor(private readonly provisioning: ProvisioningService) {}

  @Post('teachers')
  @HttpCode(201)
  createTeacher(@TenantId() tenantId: string, @StaffId() staffId: string, @Body() dto: CreateTeacherDto) {
    return this.provisioning.createTeacher(tenantId, staffId, dto);
  }

  @Post('students')
  @HttpCode(201)
  createStudent(@TenantId() tenantId: string, @StaffId() staffId: string, @Body() dto: CreateStudentDto) {
    return this.provisioning.createStudent(tenantId, staffId, dto);
  }

  @Post('parents')
  @HttpCode(201)
  createParent(@TenantId() tenantId: string, @StaffId() staffId: string, @Body() dto: CreateParentDto) {
    return this.provisioning.createParent(tenantId, staffId, dto);
  }
}
