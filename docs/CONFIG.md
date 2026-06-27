# Configuración — variables de entorno

> Referencia de todas las env vars de My Alquiler (API, panel, inquilino, test).
> Secretos solo en Railway — ver [`../SECURITY.md`](../SECURITY.md) y
> [`./RUNBOOK.md`](./RUNBOOK.md) para rotación.

---

## Variables de entorno

Referencia de configuración de las tres apps del monorepo. Las marcadas **no cableada (roadmap)** existen en `.env.example` pero ningún código las lee todavía — son integraciones futuras.

> Convención: el backend (`apps/api`) valida un subconjunto de vars con Zod en `apps/api/src/env.ts` (`EnvSchema`) y falla al arrancar si falta una requerida. El resto se leen con `process.env.*` directo sin validación. En Railway no existe el archivo `.env` (la carga de `env.ts` es no-op) y las vars vienen del entorno del service.

### API (`apps/api` — Fastify + Prisma + Postgres)

| Variable | Requerida? | Default | Dónde se setea | Para qué |
|---|---|---|---|---|
| `DATABASE_URL` | **Sí** (`min(1)`) | — | Railway service `api` / `.env` local | Conexión Postgres (Prisma). |
| `JWT_SECRET` | **Sí** (`min(16)`) | — | Railway service `api` / `.env` local | Firma/verificación de JWT (auth usuarios e inquilinos). |
| `PORT` | No | `3002` (default del schema y del `.env` local) | Railway (lo inyecta la plataforma) / `.env` local | Puerto de escucha del servidor. |
| `DEMO_MODE` | No | `false` | `.env` local / overrides en tests | Modo demo. En tests se pasa `DEMO_MODE: 'true'` vía `buildApp({...})`. |
| `CORS_ORIGINS` | No | `http://localhost:3000,http://localhost:3001,https://soyalantapia.github.io` | Railway service `api` | Lista (CSV) de orígenes permitidos para CORS. |
| `NODE_ENV` | No | `development` (enum: `development\|test\|production`) | Railway / Dockerfile (`ENV NODE_ENV=production`) / tests (`'test'`) | Entorno de ejecución. |
| `FECHA_LANZAMIENTO` | No (opcional) | — (sin tope de acceso gratis) | Railway service `api` | Fecha de fin de acceso gratis pre-lanzamiento (la usa `/auth/registro`). Si está y no parsea como fecha, **falla en el arranque** con mensaje claro. |
| `SMTP_HOST` | No (gate de envío) | — | Railway service `api` | Host SMTP. El mailer queda habilitado solo si `SMTP_HOST && SMTP_USER && SMTP_PASS` (`mailerConfigured`, `apps/api/src/mailer.ts`). |
| `SMTP_PORT` | No | `587` | Railway service `api` | Puerto SMTP. |
| `SMTP_USER` | No (gate de envío) | — | Railway service `api` | Usuario SMTP (parte del gate `mailerConfigured`). |
| `SMTP_PASS` | No (gate de envío) | — | Railway service `api` | Password SMTP (parte del gate `mailerConfigured`). |
| `SMTP_FROM` | No | `My Alquiler <no-reply@myalquiler.app>` | Railway service `api` | Remitente de los emails. |
| `UPLOADS_DIR` | No | `/data/uploads` si existe `/data`, si no `<tmpdir>/myalquiler-uploads` | Railway service `api` (Volume montado en `/data`) | Directorio de subida de archivos (`apps/api/src/routes/uploads.ts`). |
| `CRON_DEVENGO` | No | (sin valor → cron activo) | Railway service `api` | Si vale `off` deshabilita el cron de devengo (`apps/api/src/cron.ts`). |
| `CRON_SECRET` | No | — | Railway service `api` | Secreto para autorizar el endpoint de cron de plata (`apps/api/src/routes/plata.ts`). |

### Panel inmobiliaria (`apps/inmobiliaria` — Next.js 14)

Las `NEXT_PUBLIC_*` se **hornean en el bundle en build-time**, no en runtime.

| Variable | Requerida? | Default | Dónde se setea | Para qué |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No (vacío → modo demo) | `https://api-production-262e.up.railway.app` (build-arg) | **build-arg/ENV en `apps/inmobiliaria/Dockerfile`** (`ARG`/`ENV`) | URL del backend. Si está vacío, `apiEnabled=false` y la app corre con mocks (demo GH Pages) — incluso el login deja pasar (`auth-guard.tsx`). |
| `NEXT_PUBLIC_INQUILINO_URL` | No | — (cae a relativo) | build-time / entorno de build | Base para armar links públicos al portal del inquilino (`asignar-profesional-dialog.tsx`). En prod: `https://app.myalquiler.com`. |
| `STATIC_EXPORT` | No | sin setear → SSR | Entorno de build (export a GH Pages) | Si vale `1`, el build hace `output: export` + `basePath: /inmobiliaria-inquilinos-app/inmobiliaria` (`next.config.mjs`). |
| `NODE_ENV` | No | `production` en imagen | Dockerfile (`ENV NODE_ENV=production`) | Entorno de build/runtime de Next. |
| `NEXT_TELEMETRY_DISABLED` | No | `1` | Dockerfile (`ENV`) | Desactiva telemetría de Next en build. |

### Portal inquilino (`apps/inquilino` — Next.js 14)

| Variable | Requerida? | Default | Dónde se setea | Para qué |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No (vacío → modo demo) | `https://api-production-262e.up.railway.app` (build-arg) | **build-arg/ENV en `apps/inquilino/Dockerfile`** | URL del backend. Vacío → `API_HABILITADO=false`, la app usa localStorage/mocks (demo offline intacta: verificar, garantes, reclamos, etc.). |
| `NEXT_PUBLIC_BASE_PATH` | No | `''` (vacío en dev/SSR) | **`next.config.mjs`** (lo setea a `/inmobiliaria-inquilinos-app/inquilino` solo en export) | Prefijo de URLs públicas compartibles y del `manifest.webmanifest` / PWA register, para que los links no den 404 en GH Pages bajo basePath. |
| `STATIC_EXPORT` | No | sin setear → SSR | Entorno de build (export a GH Pages) | Si vale `1`, `output: export` + `basePath: /inmobiliaria-inquilinos-app/inquilino` (`next.config.mjs`). |
| `NODE_ENV` | No | `production` en imagen | Dockerfile (`ENV NODE_ENV=production`) | Entorno de build/runtime de Next. |
| `NEXT_TELEMETRY_DISABLED` | No | `1` | Dockerfile (`ENV`) | Desactiva telemetría de Next en build. |

### Tests (`apps/api/test` — Vitest)

Los tests no leen vars de entorno: pasan los overrides directamente a `buildApp({...})`. No requieren `DATABASE_URL` ni `JWT_SECRET` reales.

| Variable | Requerida? | Default | Dónde se setea | Para qué |
|---|---|---|---|---|
| `NODE_ENV` | No | `'test'` | Override en `buildApp({ NODE_ENV: 'test', ... })` en cada suite | Fuerza entorno de test (enum válido del schema). |
| `DEMO_MODE` | No | `'true'` en casi todas las suites | Override en `buildApp({ ..., DEMO_MODE: 'true' })` | Corre la API en modo demo durante los tests (excepto `health.test.ts`, que solo pasa `NODE_ENV: 'test'`). |

### Integraciones futuras — **no cableadas (roadmap)**

Listadas en `.env.example` pero **ningún código las consume todavía** (no aparecen en `process.env.*` ni en `EnvSchema`). Cuando se cableen, irían en el service `api` de Railway (o `NEXT_PUBLIC_*` como build-arg en los Dockerfiles de los fronts).

| Variable | Grupo | Para qué (previsto) |
|---|---|---|
| `REDIS_URL` | Cache/colas | Conexión Redis. **No cableada (roadmap).** |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (`claude-sonnet-4-6`) | IA | API de Anthropic. **No cableada (roadmap).** |
| `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET` | Pagos (Mercado Pago) | Cobros/suscripciones MP. **No cableada (roadmap).** |
| `NOSIS_API_KEY`, `NOSIS_BASE_URL` (`https://api.nosis.com/v1`) | Scoring crediticio | Verificación de garantes/inquilinos vía Nosis. **No cableada (roadmap).** |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Mensajería | WhatsApp Cloud API. **No cableada (roadmap).** |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (`llave-prod`) | Storage | Cloudflare R2 (hoy los uploads van a disco vía `UPLOADS_DIR`). **No cableada (roadmap).** |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (`hola@llave.ar`) | Email | Resend como transporte (hoy el envío real es SMTP vía `mailer.ts`). **No cableada (roadmap).** |
| `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Auth | Clerk (hoy la auth es JWT propia + OTP). **No cableada (roadmap).** |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` / `NEXT_PUBLIC_SENTRY_DSN` | Observabilidad | Sentry. **No cableada (roadmap).** |
| `POSTHOG_KEY`, `POSTHOG_HOST` (`https://app.posthog.com`) / `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Analytics | PostHog. **No cableada (roadmap).** |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Pagos (front) | Clave pública MP para el checkout en el front del inquilino. **No cableada (roadmap).** |

---

Archivos fuente: `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/.env.example`, `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/apps/api/.env`, `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/apps/api/src/env.ts`, `apps/{api,inmobiliaria,inquilino}/Dockerfile`, `apps/{inmobiliaria,inquilino}/next.config.mjs`, `apps/api/src/{mailer,cron}.ts`, `apps/api/src/routes/{uploads,plata}.ts`.

Nota: el `DATABASE_URL`/`REDIS_URL` del `.env.example` apuntan a un proyecto de marca `llave`; el `.env` real de `apps/api` y los emails (`SMTP_FROM` por defecto, dominio `myalquiler.app`) usan la marca **My Alquiler**.

