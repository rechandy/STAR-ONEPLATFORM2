import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { StaffId, TenantId } from '../common/request-context';
import { StaffIdentityGuard } from '../common/staff-identity.guard';
import { SyncMutationsDto } from './dto';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(StaffIdentityGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /**
   * Batched outbox flush from the offline client. Idempotent per opId; each
   * mutation is authorized individually (Cedar `recordStudentData`).
   * Returns 200 with per-op results (the batch itself always "succeeds").
   */
  @Post('mutations')
  @HttpCode(200)
  mutations(
    @TenantId() tenantId: string,
    @StaffId() staffId: string,
    @Body() dto: SyncMutationsDto,
  ) {
    return this.sync.applyMutations(tenantId, staffId, dto);
  }
}
