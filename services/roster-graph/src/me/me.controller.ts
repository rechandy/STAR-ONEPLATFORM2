import { Controller, Get } from '@nestjs/common';
import { StaffId, TenantId } from '../common/request-context';
import { MeService } from './me.service';

@Controller()
export class MeController {
  constructor(private readonly me: MeService) {}

  /** The acting user's identity (drives the dashboard shell + role nav). */
  @Get('me')
  getMe(@TenantId() tenantId: string, @StaffId() staffId: string) {
    return this.me.me(tenantId, staffId);
  }

  /** The tenant's product-pillar entitlements (drives dashboard filtering). */
  @Get('licenses')
  getLicenses(@TenantId() tenantId: string) {
    return this.me.licenses(tenantId);
  }
}
