import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Ensures the request carries tenant + staff identity before any write.
 * 401 if no staff identity; 400 if no tenant context.
 */
@Injectable()
export class StaffIdentityGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.tenantId) throw new ForbiddenException('Missing tenant context (x-tenant-id).');
    if (!req.header('x-user-id')) throw new UnauthorizedException('Missing staff identity (x-user-id).');
    return true;
  }
}
