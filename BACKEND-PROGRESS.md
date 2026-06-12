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

### ✅ Fase 1 — Auth + tenancy (COMPLETA)
- [x] Enum de rol con LECTURA (migración `rol_lectura`). Matriz de permisos
      portada a `@llave/shared/permisos` (copia 1:1 de lib/permisos.ts del inmo).
- [x] `POST /auth/login` (email+password → JWT 15d, bcrypt).
- [x] `POST /auth/otp/request` + `/verify` (OTP real hasheado, TTL 10min, un solo
      uso; código por log del server; backdoor `000000` SOLO con DEMO_MODE;
      respuesta anti-enumeración de emails).
- [x] `POST /auth/demo` (DEMO_MODE) → JWT de Mariela. `GET /auth/me`.
      `POST /auth/pin/verify` (PIN bcrypt).
- [x] Guards `requireAuth` / `requireUsuario(capacidad)` / `requireInquilino`
      usando la matriz de shared.
- [x] Seeds idempotentes (`pnpm --filter api seed` y `seedBase()` para tests):
      tenant del-sol + roberto/luciana/camila (delsol123, PIN 1234) + 6 inquilinos
      (Mariela = mariela.sosa@gmail.com).
- [x] Tests: 9/9 verdes (login ok/401, OTP backdoor+inválido, /me 401/ok, PIN
      ok/403, demo) contra la DB real.
- [x] Build: tsup (bundlea @llave/shared; tsconfig paths para typecheck —
      tsc sin emit, build real por tsup).
- [x] Front inquilino: `auth-otp-api.ts` (capa unificada API↔local con fallback
      por red caída), login page cableada (solicitar/verificar/demo), token JWT
      en `llave:auth:token`, `cerrarSesion()` limpia el token. La sesión local se
      sigue persistiendo → el resto de la app intacta.
- [x] E2E verificado en preview: OTP REAL del server (código del log) → JWT en
      localStorage (kind inquilino, exp 15d) + home de Mariela.
- Modo API en dev: `apps/inquilino/.env.local` con
      `NEXT_PUBLIC_API_URL=http://localhost:3002` (gitignored; borrarlo = modo
      localStorage puro).
- ⏭ Diferido a Fase 2: pantalla de login del PANEL inmo (hoy auto-entra con mock;
      tiene sentido hacerla cuando el panel consuma datos reales).

### Fases 2-7 — pendientes (ver PROMPT-BACKEND-FULL.md)
- El workflow de extracción del modelo de datos (specs → schema completo) corre
  en background; su output alimenta Fase 2+.

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
