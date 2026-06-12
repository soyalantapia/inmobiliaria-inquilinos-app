# 🏗️ BACKEND — progreso (checklist vivo)

> Memoria entre sesiones del build del backend (ver `PROMPT-BACKEND-FULL.md`).
> Stack: Fastify 5 + Prisma + Postgres (Railway) + Zod en `packages/shared` +
> TanStack Query en el front con fallback localStorage.

## Estado por fase

### ✅ Fase 0 — Cimientos (COMPLETA)
- [x] Railway linkeado (proyecto `distinguished-adaptation` · env production) — CLI.
- [x] Postgres creada en Railway. `DATABASE_URL` (pública, proxy.rlwy.net) en
      `apps/api/.env` (NO commiteado) + `JWT_SECRET` + `DEMO_MODE=true` + `PORT=3002`.
- [x] `apps/api`: Fastify 5 + TS (NodeNext) + Prisma 6 + Zod + vitest + Dockerfile.
      `buildApp()` separado de `index.ts` para testear con `app.inject()`.
      helmet + rate-limit (300/min) + CORS (localhost:3000/3001 + soyalantapia.github.io)
      + JWT registrados. `trustProxy: true` (IP real en Railway).
- [x] `prisma/schema.prisma` base: Inmobiliaria, Usuario (rol/password/pin),
      Inquilino, OtpCode. Migración `20260612041401_init` APLICADA en Railway.
- [x] `/health` → `{ok, db:"up"}` verificado contra la DB real (curl + vitest).
- [x] `packages/shared` (`@llave/shared`): schemas Zod de JWT payloads + auth
      requests/responses.
- [x] Front: `@tanstack/react-query` en ambas apps; `src/lib/api/client.ts`
      (API_URL, apiEnabled, getToken/setToken, apiFetch con Bearer) +
      `QueryProvider` montado en ambos layouts raíz. Flag: `NEXT_PUBLIC_API_URL`
      vacío → todo sigue en localStorage (cero cambio de comportamiento).
- [x] tsc + lint limpios (api + ambas apps), ambas apps renderizando (REGLA 0 ok).
- pnpm root: `pnpm.onlyBuiltDependencies` para prisma/esbuild (pnpm 10).

### ⏳ Fase 1 — Auth + tenancy (SIGUIENTE)
- [ ] Modelos ya existen (Usuario/Inquilino/OtpCode) — falta lógica.
- [ ] `POST /auth/login` (email+password → JWT 15d) + tests.
- [ ] `POST /auth/otp/request` + `/auth/otp/verify` (dev: OTP 000000 logueado en consola).
- [ ] `POST /auth/demo` (solo DEMO_MODE) → JWT de Mariela.
- [ ] `POST /auth/pin/verify` (para aprobaciones).
- [ ] Middleware `requireAuth` / `requireRol` (capacidades de lib/permisos.ts → shared).
- [ ] Seeds: tenant "Inmobiliaria del Sol" + roberto/luciana/camila (delsol123, PIN 1234)
      + inquilinos de los contratos mock.
- [ ] Front: login inmo + OTP inquilino reales detrás de `apiEnabled`.

### Fases 2-7 — pendientes (ver PROMPT-BACKEND-FULL.md)

## Datos operativos
- Railway: proyecto `b01a1ecb-2169-46ef-b6cf-71a2d6cca234`, env `857efc10-…`
  (production), service `Postgres`. CLI logueada como AlanTapia.
- API dev: `pnpm --filter api dev` → :3002. Tests: `pnpm --filter api test`
  (comparten DB; `fileParallelism: false`).
- Migraciones: `pnpm --filter api db:migrate` (dev) / `db:deploy` (prod/Docker).
- Workflow de extracción del modelo de datos (specs de los 37+ stores → draft de
  schema completo + seeds + endpoints): corre en background; el resultado
  alimenta las fases 1-6.

## Decisiones tomadas
- JWT Bearer en localStorage (`llave:auth:token`) — sin cookies cross-site.
- Multi-tenant liviano: `inmobiliariaId` en todo; tenant seed único.
- bcryptjs (sin binarios nativos — Docker simple).
- Tests contra la misma Postgres (schema `test` cuando haya escrituras).
- `.env` se carga explícito en `src/env.ts` (sin dep dotenv; no-op en Railway).
