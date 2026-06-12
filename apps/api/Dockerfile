# API de My Alquiler — build determinístico para Railway (contexto = raíz del monorepo)
# Service Railway: setear RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile
FROM node:22-slim AS base
RUN corepack enable && apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
# Todos los package.json del workspace (el lockfile valida contra TODOS los importers)
COPY apps/api/package.json apps/api/package.json
COPY apps/inquilino/package.json apps/inquilino/package.json
COPY apps/inmobiliaria/package.json apps/inmobiliaria/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile --filter api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter api db:generate && pnpm --filter api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 3002
# migrate deploy aplica migraciones pendientes (no-op si está al día) y arranca
CMD ["sh", "-c", "pnpm db:deploy && node dist/index.js"]
