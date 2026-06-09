import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TenantId } from '../common/request-context';
import { StaffIdentityGuard } from '../common/staff-identity.guard';
import { CurriculumService } from './curriculum.service';

/** Curriculum browsing — any authenticated staff member may read the map. */
@Controller('curriculum')
@UseGuards(StaffIdentityGuard)
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  /** Scope & sequence (optionally filtered to one domain). */
  @Get('scope-sequence')
  scopeSequence(@TenantId() tenantId: string, @Query('domain') domain?: string) {
    return this.curriculum.scopeSequence(tenantId, domain);
  }

  /** A single objective with its ordered lessons. */
  @Get('objectives/:objectiveId')
  objective(@TenantId() tenantId: string, @Param('objectiveId') objectiveId: string) {
    return this.curriculum.objectiveDetail(tenantId, objectiveId);
  }
}
