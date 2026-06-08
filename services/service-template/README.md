# @oneplatform/service-template

The **golden-path** template for OnePlatform backend services (NestJS). Copy this directory
to start a new service so it inherits the platform contracts on day one:

- **Config** via `@nestjs/config` (typed `configuration()`).
- **Multi-tenancy**: `TenantContextMiddleware` resolves `req.tenantId` for every request.
- **Health probes**: `GET /api/healthz` (liveness) and `GET /api/readyz` (readiness).
- **Security**: `helmet`, global validation pipe.
- **Ops**: graceful shutdown (`enableShutdownHooks`), multi-stage Dockerfile.

## Create a new service

```bash
cp -r services/service-template services/<your-service>
# then in services/<your-service>/package.json set:
#   "name": "@oneplatform/<your-service>"
# and SERVICE_NAME in .env
pnpm install
pnpm --filter @oneplatform/<your-service> dev
```

## Scripts

| Script | Purpose |
| --- | --- |
| `dev` | `nest start --watch` |
| `build` | `nest build` → `dist/` |
| `start` | run compiled `dist/main.js` |
| `typecheck` | `tsc --noEmit` |
| `lint` | eslint |

## Next steps when extending

- Add a Prisma data module (depend on `@oneplatform/database` or the service's own schema).
- Add OpenTelemetry instrumentation (traces/metrics/logs) per the blueprint.
- Replace the header-based tenant stand-in with the verified gateway tenant claim.
- Add gRPC/REST controllers and the transactional **outbox** for event publishing.
