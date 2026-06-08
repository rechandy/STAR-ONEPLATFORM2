import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Current tenant (set by TenantContextMiddleware). Throws 400 if absent. */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  if (!req.tenantId) {
    throw new BadRequestException('Missing tenant context (x-tenant-id).');
  }
  return req.tenantId;
});

/**
 * Acting staff member's id. In production this is the authenticated principal;
 * here we read `x-user-id`. Throws 400 if absent.
 */
export const StaffId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const userId = req.header('x-user-id');
  if (!userId) {
    throw new BadRequestException('Missing staff identity (x-user-id).');
  }
  return userId;
});
