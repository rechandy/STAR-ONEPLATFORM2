import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  /** Liveness probe — k8s `livenessProbe`. */
  @Get('healthz')
  liveness() {
    return { status: 'ok', service: this.config.get('serviceName'), time: new Date().toISOString() };
  }

  /** Readiness probe — k8s `readinessProbe`. Extend with dependency checks (db, kafka). */
  @Get('readyz')
  readiness() {
    return { status: 'ready', service: this.config.get('serviceName') };
  }
}
