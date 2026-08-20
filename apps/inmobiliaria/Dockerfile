# Front PANEL (inmobiliaria) — build determinístico para Railway.
# Contexto de build = raíz del monorepo.
# Service Railway: setear RAILWAY_DOCKERFILE_PATH=apps/inmobiliaria/Dockerfile
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
COPY apps/propietario/package.json apps/propietario/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile
COPY packages packages
COPY scripts scripts
COPY apps/inmobiliaria apps/inmobiliaria
COPY apps/propietario apps/propietario
# Resto de NEXT_PUBLIC_* que el cliente hornea en build time. Railway las expone
# como build args desde las variables del service, pero SOLO si se declara el ARG
# para consumirlas; sin esto quedan undefined en el bundle aunque estén seteadas
# en el panel (PostHog no inicia; el link mágico del inquilino cae a un 404).
# Se declaran acá (después del COPY) para no invalidar la capa de pnpm install.
ARG NEXT_PUBLIC_INQUILINO_URL
ENV NEXT_PUBLIC_INQUILINO_URL=$NEXT_PUBLIC_INQUILINO_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
# El commit que se está buildeando, para el <meta name="build-commit"> del layout. Railway
# expone RAILWAY_GIT_COMMIT_SHA en los deploys que salen del repo conectado; si falta, el
# layout cae a 'desconocido' en vez de mentir. Es lo que hace verificable un deploy del front:
# hasta ahora sólo la API decía qué versión corría, en /health.
ARG RAILWAY_GIT_COMMIT_SHA
ENV NEXT_PUBLIC_COMMIT=$RAILWAY_GIT_COMMIT_SHA
# EL PORTAL DEL PROPIETARIO VIAJA ADENTRO DEL PANEL, en `/propietario`.
#
# Es una app de sólo lectura y 100% estática (ya se exporta así para la demo). Un servicio
# de Railway propio serían dólares por mes y un dominio más para mantener; acá el export
# queda en `public/propietario/` y lo sirve el mismo Next que ya está corriendo. Los
# rewrites que hacen que `/propietario` resuelva al index viven en next.config.mjs.
#
# Va ANTES del build del panel: `public/` se lee durante el build.
# `NEXT_PUBLIC_DEMO` NO se pasa a propósito — con `NEXT_PUBLIC_API_URL` puesta, `demoEnabled`
# ya da false igual (pide las dos cosas), pero dejarlo explícito acá evita que alguien lo
# agregue "para probar" y publique datos inventados en un dominio real.
RUN BASE_PATH=/propietario STATIC_EXPORT=1 NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
      pnpm --filter @llave/propietario exec next build \
 && rm -rf apps/inmobiliaria/public/propietario \
 && mkdir -p apps/inmobiliaria/public/propietario \
 && cp -R apps/propietario/out/. apps/inmobiliaria/public/propietario/

RUN pnpm --filter @llave/inmobiliaria exec next build

FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /repo /repo
WORKDIR /repo/apps/inmobiliaria
# Railway inyecta PORT; Next escucha ahí en todas las interfaces.
CMD ["sh", "-c", "pnpm exec next start -H 0.0.0.0 -p ${PORT:-3000}"]
