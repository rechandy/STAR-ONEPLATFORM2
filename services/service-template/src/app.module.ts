import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { HealthModule } from './health/health.module';
import { TenantContextMiddleware } from './common/tenant-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Tenant context is resolved for every request (multi-tenancy is foundational).
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
