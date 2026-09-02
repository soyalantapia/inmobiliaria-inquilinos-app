# Front INQUILINO (PWA) — build determinístico para Railway.
# Contexto de build = raíz del monorepo.
# Service Railway: setear RAILWAY_DOCKERFILE_PATH=apps/inquilino/Dockerfile
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Las NEXT_PUBLIC_* se hornean en el bundle del cliente → deben existir en
# build time. Default al dominio del API (no cambia aunque se renombre el
# service); se puede overridear con la build arg / variable del service.
ARG NEXT_PUBLIC_API_URL=https://api-production-262e.up.railway.app
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
# package.json de TODO el workspace (el lockfile valida contra todos los importers)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/inquilino/package.json apps/inquilino/package.json
COPY apps/inmobiliaria/package.json apps/inmobiliaria/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile
COPY packages packages
COPY scripts scripts
COPY apps/inquilino apps/inquilino
# El commit que se está buildeando, para el <meta name="build-commit"> del layout. Railway
# expone RAILWAY_GIT_COMMIT_SHA en los deploys que salen del repo conectado; si falta, el
# layout cae a 'desconocido' en vez de mentir. Va después del COPY para no invalidar la capa
# de pnpm install (mismo criterio que los ARG del panel).
# Sonar: el HOST, sin default. Si no se pasa, el layout no emite el script — que es lo
# que queremos: el valor viejo apuntaba a Railway y sobrevivio al ban horneado en el HTML.
ARG NEXT_PUBLIC_SONAR_URL
ENV NEXT_PUBLIC_SONAR_URL=$NEXT_PUBLIC_SONAR_URL
ARG RAILWAY_GIT_COMMIT_SHA
# Render expone RENDER_GIT_COMMIT; Railway, RAILWAY_GIT_COMMIT_SHA. Se declaran los dos y
# gana el que venga, para que el <meta build-commit> diga la verdad en las dos plataformas.
ARG RENDER_GIT_COMMIT
ENV NEXT_PUBLIC_COMMIT=${RAILWAY_GIT_COMMIT_SHA:-$RENDER_GIT_COMMIT}
RUN pnpm --filter @llave/inquilino exec next build

FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /repo /repo
WORKDIR /repo/apps/inquilino
# Railway inyecta PORT; Next escucha ahí en todas las interfaces.
CMD ["sh", "-c", "pnpm exec next start -H 0.0.0.0 -p ${PORT:-3000}"]
