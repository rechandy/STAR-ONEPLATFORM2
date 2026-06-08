import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TenantId } from '../common/request-context';
import { StudentAccessGuard } from '../authz/student-access.guard';
import { OutcomesService } from './outcomes.service';

/**
 * Protected read surface for a student's outcomes. Every route is guarded by
 * Cedar `viewStudent` (StudentAccessGuard) — the same policy roster-graph and
 * the /sync write path enforce.
 */
@Controller('students')
@UseGuards(StudentAccessGuard)
export class OutcomesController {
  constructor(private readonly outcomes: OutcomesService) {}

  /** Outcome log (progress | milestone | assessment | behavior), cursor-paginated. */
  @Get(':studentId/outcomes')
  list(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Query('category') category?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.outcomes.list(tenantId, studentId, {
      category,
      type,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  /** Aggregated progress summary across the four outcome families. */
  @Get(':studentId/summary')
  summary(@TenantId() tenantId: string, @Param('studentId') studentId: string) {
    return this.outcomes.summary(tenantId, studentId);
  }
}
