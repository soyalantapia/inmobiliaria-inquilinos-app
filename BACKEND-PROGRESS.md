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

### ✅ Fase 2 — Núcleo de datos (COMPLETA)
- [x] Schema COMPLETO del producto aplicado: 72 modelos + 72 enums (migración
      `nucleo_completo`, 2206 líneas SQL) — derivado por workflow de los 37+
      stores del front. Ids de mocks preservados (cnt_001, prp_001, own_001…).
      CodigoOtp endurecido (hash+TTL+un uso, FK a Inquilino).
- [x] Seeds core: tenant completo + 3 sociedades + 5 propietarios + 6 propiedades
      + participaciones (cotitularidad 60/40 en prp_001) + 8 contratos + 7
      inquilinos titulares 1:1.
- [x] Endpoints core (requireUsuario + capacidad + tenant scope): GET /contratos,
      /contratos/:id, /propiedades, /propiedades/:id, /propietarios,
      /propietarios/:id, /inquilinos — con joins (titular, participaciones,
      contratoActual, arca, cuentaCobranza).
- [x] Tests 16/16 (auth 9 + core 7: joins, cotitularidad, 401, 403 inquilino→panel).
- [x] Front inmo: `lib/api/session.ts` (auto-login dev de Roberto hasta que haya
      pantalla de login) + `lib/api/hooks.ts` (useContratos con adaptador a
      ContratoListado y fallback a mocks si API caída) + página /contratos
      migrada al hook.
- [x] E2E verificado: browser → CORS preflight → POST /auth/login → GET
      /contratos → los 8 contratos de la DB renderizados en el panel.
- Modo API dev: `.env.local` en ambas apps con NEXT_PUBLIC_API_URL=http://localhost:3002.
- Bridge documentado (muere en Fase 3): estadoPagoActual/proximoVencimiento del
  listado se completan desde el mock por id (derivados de liquidaciones).
- BACKEND-ENDPOINTS.md: 92 endpoints + 39 seeds planificados (del workflow).

### ✅ Fase 3 — La plata (API COMPLETA · front parcial)
- [x] Seeds: 6 liquidaciones (estados del mock: Mariela y Laura VENCIDAS),
      2 pagos INFORMADOS (bandeja a validar), 3 movimientos de caja (1 ya
      descontado), rendición seed ren_001 (own_001 mayo, con GastoRendido
      snapshot), 2 aprobaciones pendientes (sin PAGO_MANUAL, por diseño).
- [x] Endpoints (routes/plata.ts): GET /liquidaciones · GET /pagos ·
      POST /pagos/:id/validar|rechazar (PIN + permisos pago.conciliar/rechazar,
      transacción pago+liquidación) · POST /pagos/informar +
      GET /mis-liquidaciones (inquilino) · GET/POST /caja/movimientos ·
      GET/POST /rendiciones (TRANSACCIÓN del loop: bruto por participación −
      comisión − gastos pendientes → GastoRendido snapshots + movimientos
      marcados descontadoEnRendicion + rendicionId; guard CBU faltante; 409 si
      período ya rendido) · GET /aprobaciones + aprobar/rechazar con PIN
      (aprueba CONTRATO_CARGADO → contrato ACTIVO).
- [x] GET /contratos ahora DERIVA estadoPagoActual/proximoVencimiento de
      liquidaciones reales → MUERTO el bridge del front (hooks.ts ya no mira
      mocks) y muerto el crítico de plata del reporte PM.
- [x] Tests 28/28 (12 de plata: PIN incorrecto, permisos por rol, doble
      validación 409, informar pago del inquilino, neto exacto $1.420.750 del
      loop de rendición, CBU faltante, doble rendición, aprobación activa
      contrato).
- [x] E2E: panel /contratos muestra estados reales del server.
- ⏭ Front de plata pendiente (continuación): migrar pantallas /pagos, /caja,
      /aprobaciones del panel + checkout/comprobantes del inquilino a estos
      endpoints (hoy siguen en localStorage; los endpoints ya devuelven el shape
      necesario).

### ✅ Fase 4 — Operación (API COMPLETA · 33 tests)
- routes/operacion.ts: reclamos e2e (inquilino crea → asignar profesional →
  timeline ReclamoEvento → resolver/rechazar con validación) + SLA server-side
  (helper portado de sla-reclamos.ts, plazos por urgencia), profesionales,
  consorcios (+unidades/movimientos/asambleas), renovaciones (+decisión con PIN).
- prisma/seeds/operacion.ts: reclamos/profesionales/consorcios del mock.

### ✅ Fase 5 — Anuncios con acuses REALES (API + FRONT · 20 tests)
- routes/anuncios.ts: audiencias resueltas server-side (FK consorcioId con
  fallback heurístico documentado), conteos Leído/Confirmado desde AnuncioAcuse,
  POST /anuncios/:id/leido|enterado del inquilino (upsert, idempotente, 403 si
  no le aplica), canales fijos APP+EMAIL.
- MUERTOS los hacks: anuncios-cross-app (lectura de localStorage ajeno) y el
  blend contarAcuses (simulación) quedan SOLO como fallback sin API.
- Front migrado: useAnuncios (inmo, refetch 30s) + useMisAnuncios (inquilino);
  páginas /anuncios y el feed del home consumiendo el API.
- ✅ E2E ESTRELLA EN BROWSER: Mariela toca "Enterado" en :3000 → el panel en
  :3001 muestra Leído 1/1 · Confirmado 1/1 vía Railway (cero localStorage).

### ✅ Fase 6 — Mundo inquilino (API COMPLETA · 27 tests)
- routes/inquilino-mundo.ts: GET /certificado (calculado de liquidaciones REALES,
  hash determinístico, honesto), POST /screening (identidad del informe =
  EXACTAMENTE lo solicitado — muerto el crítico 5 del reporte PM), co-inquilinos
  (invitación con token; "simular aceptó" solo DEMO_MODE), boletas, POST /reportes
  con tracking server-side (IP real vía trustProxy, userAgent, identidad JWT).

### ✅ Fase 7 — Producción (API DEPLOYADO EN RAILWAY)
- [x] Service `api` creado en el proyecto MYALQ (junto al Postgres), variables
      seteadas (DATABASE_URL por red INTERNA ${{Postgres.DATABASE_URL}},
      JWT_SECRET propio de prod, DEMO_MODE=true, CORS, RAILWAY_DOCKERFILE_PATH).
- [x] `railway up` → imagen Docker buildeada en Railway (Dockerfile multi-stage,
      lockfile validado con el workspace completo) → migrate deploy (al día) →
      server arriba en el PORT asignado.
- [x] **URL pública: https://api-production-262e.up.railway.app**
- [x] Smoke 6/6 CONTRA PROD (health db:up, demo, login, contratos derivados,
      mis-anuncios, conteos reales).
- [x] Verificación final en browser: front local + localStorage limpio → demo →
      JWT de prod → feed de anuncios desde la DB de producción.
- Los `.env.local` de ambas apps quedaron apuntando a PROD (el dueño ya no
  necesita levantar el API local; para dev de API: http://localhost:3002).
- [ ] Switch del build de GH Pages al API (única pieza restante de infra):
      requiere `gh auth refresh -s workflow` del dueño para tocar el workflow
      (inyectar NEXT_PUBLIC_API_URL) — el CORS ya admite soyalantapia.github.io.

### Front pendiente (los endpoints YA existen y están testeados)
- /pagos del panel (PagosPorValidar 726 líneas), checkout/comprobantes del
  inquilino, reclamos/renovaciones/consorcios, pantallas del mundo inquilino.
  Patrón establecido: hook en lib/api/hooks.ts + adaptador + fallback (ver caja,
  aprobaciones, anuncios, contratos).
- Pantalla de login real del panel (hoy auto-sesión dev de Roberto).
- Fix horizontal aplicado: apiFetch manda Content-Type SOLO con body (Fastify
  devuelve 400 ante JSON vacío).
- Las specs exactas de campos viven en /tmp/backend-specs.json (regenerables
  re-corriendo el workflow de extracción).

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
