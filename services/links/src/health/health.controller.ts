import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('healthz')
  liveness() {
    return { status: 'ok', service: this.config.get('serviceName'), time: new Date().toISOString() };
  }

  @Get('readyz')
  async readiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', service: this.config.get('serviceName') };
  }
}
