# Golden-path multi-stage Dockerfile for a NestJS service in the pnpm monorepo.
# Build from the repo root:  docker build -f services/service-template/Dockerfile .
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ---- install deps (workspace-aware) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY services/service-template/package.json services/service-template/package.json
RUN pnpm install --frozen-lockfile=false

# ---- build ----
FROM deps AS build
COPY packages/tsconfig packages/tsconfig
COPY services/service-template services/service-template
RUN pnpm --filter @oneplatform/service-template build

# ---- runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/services/service-template/dist ./dist
COPY --from=build /repo/services/service-template/node_modules ./node_modules
COPY --from=build /repo/services/service-template/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
