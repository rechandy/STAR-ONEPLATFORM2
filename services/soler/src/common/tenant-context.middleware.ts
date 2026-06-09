import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

/** Resolves the tenant for every request -> `req.tenantId` (x-tenant-id stand-in). */
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
