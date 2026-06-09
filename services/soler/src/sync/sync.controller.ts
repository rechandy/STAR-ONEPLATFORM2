import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { StaffId, TenantId } from '../common/request-context';
import { StaffIdentityGuard } from '../common/staff-identity.guard';
import { ChangesService } from './changes.service';
import { SyncMutationsDto } from './dto';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(StaffIdentityGuard)
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly changes: ChangesService,
  ) {}

  /**
   * Batched outbox flush from the offline iPad: session opens, trial datapoints,
   * and session finalize. Idempotent per opId; each mutation is authorized
   * individually (Cedar `recordStudentData`). Returns 200 with per-op results.
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

  /**
   * Pull side: a cursor delta of the read models the iPad caches offline
   * (roster / curriculum / assignments), scoped to this staff member. The
   * client stores `nextCursor` opaquely and re-requests while `hasMore`.
   */
  @Get('changes')
  changesDelta(
    @TenantId() tenantId: string,
    @StaffId() staffId: string,
    @Query('collections') collections?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.changes.changes(tenantId, staffId, {
      collections,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
