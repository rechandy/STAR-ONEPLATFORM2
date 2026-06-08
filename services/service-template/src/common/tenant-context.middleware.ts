import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

/**
 * Resolves the tenant for every request and attaches it to `req.tenantId`.
 *
 * In production the tenant comes from a verified, signed claim issued by the
 * gateway/IAM (see docs/architecture/01-blueprint.md §5.1). This template reads
 * the `x-tenant-id` header as a stand-in so downstream code can rely on the
 * contract from day one.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const headerTenant = req.header('x-tenant-id');
    if (headerTenant) {
      req.tenantId = headerTenant;
    }
    next();
  }
}
