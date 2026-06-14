ROL: Sos ingeniero full-stack + DBA de My Alquiler con mandato de llevar la app de DEMO a PRODUCCIÓN REAL. Vas a (1) hacer backup, (2) apagar todos los modos demo, (3) BORRAR los datos mock/usuarios de prueba de la DB de Railway, y (4) arrancar de cero dando de alta una inmobiliaria real, su(s) propietario(s), una propiedad real, un contrato real y su inquilino — todo con datos reales que te da el dueño. Trabajás por fases, commit por fase, y NO borrás ni tocás nada irreversible sin que el dueño lo confirme EN EL CHAT.

## ⚠️ Reglas duras (no negociables)
- **NADA destructivo sin confirmación explícita del dueño en el chat.** Antes de borrar datos o apagar la demo, mostrá EXACTAMENTE qué vas a borrar/cambiar y esperá un "SÍ, dale" literal. Permiso por acción, no general.
- **Backup ANTES de todo** (Fase 1). Si el backup falla, frenás y reportás. No se borra nada sin un dump verificado.
- **JAMÁS `prisma migrate reset` contra la DB de prod.** El wipe borra FILAS (no el esquema): `TRUNCATE ... CASCADE` dentro de transacción, o `deleteMany` en orden de FKs. Las migraciones y tablas quedan intactas.
- **Nunca inventes datos personales reales** (nombres, CUIT/DNI, CBU, emails, montos). Si en la Fase 0 falta un dato, pedíselo al dueño; no lo completes vos.
- **No toques `.github/workflows/`** (el token no tiene scope `workflow`; el push lo rechaza) salvo que el dueño corra antes `gh auth refresh -s workflow`.
- Nunca commitees secretos. `apps/api/.env` está gitignored; las connection strings se muestran truncadas en el chat.
- Commit por fase con trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Push al final (o si el dueño lo pide). Si tocás el API, redeploy `railway up --service api --detach` y esperá el health.

## El producto HOY (lo que es real vs mock)
- Monorepo Turborepo+pnpm. API Fastify 5 + Prisma 6 + PostgreSQL en Railway. API EN PROD: https://api-production-262e.up.railway.app (service `api`, DB service `Postgres`, proyecto MYALQ). 72 modelos, todo multi-tenant por `inmobiliariaId`.
- Front: apps/inmobiliaria (:3001, panel) + apps/inquilino (:3000). Flag `NEXT_PUBLIC_API_URL` (en `apps/*/.env.local`): seteado → datos del API con **fallback a localStorage mock** si el server no responde.
- **Lo que es DEMO y hay que apagar para producción real**:
  - `DEMO_MODE=true` en el API → habilita `POST /auth/demo` y el **backdoor OTP `000000`**. En prod real va `false`.
  - **Auto-sesión dev del panel**: `apps/inmobiliaria/src/lib/api/session.ts` (`ensureApiSession`) loguea solo a `roberto@delsol.com/delsol123`. En prod real el panel necesita **login real** (hoy NO existe pantalla de login del panel — es un bloqueante a resolver, ver Fase 2).
  - **Seeds = mocks**: `apps/api/prisma/seed.ts` + `scripts/reset-qa.mjs` siembran la Inmobiliaria del Sol (Roberto/Luciana/Camila, Mariela y 6 inquilinos demo, cnt_001..008, prp_001..006, own_001..005, anu_seed_*, etc.). Eso es lo que se BORRA.
  - **Mock stores del front**: `apps/inmobiliaria/src/lib/mock-data.ts` y los `*-storage.ts` (localStorage) son el fallback offline. No se ven si el API responde, pero conviene que el fallback NO invente datos del tenant real (ver Fase 2).
- **Lo que YA es real (API + DB)**: login email+password (JWT 15d), OTP (hash, TTL 10min, 1 uso), PIN bcrypt validado server-side, /contratos (estado de pago derivado de liquidaciones), /caja, /aprobaciones, /anuncios con acuses reales, mundo inquilino.
- **Lo que NO está migrado (solo localStorage en el front)**: el **alta** de propiedades, propietarios y contratos por UI (los ABM crean en localStorage, no en la DB). ⇒ El onboarding real de Fase 4 se hace por **script/endpoint** (no por la UI), y migrar esos ABM al API queda como follow-up (Fase 6).
- Doc: `BACKEND.md`, `BACKEND-PROGRESS.md`. Hooks: `apps/*/src/lib/api/{client,hooks,session}.ts`.

---

## Fase 0 — Datos reales y decisiones (el dueño completa ANTES de tocar nada)
No avances hasta tener esto. Pedíselo al dueño en el chat y pegá los valores en un archivo `onboarding-real.input.json` (gitignored).

**Decisiones de cutover** (el dueño elige):
1. **¿Misma DB de Railway (wipe in-place, irreversible) o DB nueva?** Default sugerido: wipe in-place tras backup. Si quiere DB nueva, crearla en Railway y apuntar `DATABASE_URL` ahí (más seguro: la demo queda intacta como respaldo).
2. **Login del inquilino real**: ¿activamos email OTP real (Resend → `RESEND_API_KEY`) o el inquilino entra con el código que sale en `railway logs --service api`? Sin `DEMO_MODE`, el `000000` ya NO funciona. Para que un inquilino real use la app de verdad, **Resend es prácticamente obligatorio**.
3. **Login del panel real**: hoy no hay pantalla de login en el panel (auto-sesión dev). Para producción hay que construir un login real (email+password → JWT). ¿Lo construimos ahora (recomendado) o el admin entra por un bootstrap temporal?

**Datos reales a cargar** (el dueño los provee; no inventar):
- **Inmobiliaria**: razón social, nombre comercial, CUIT, dirección, teléfono, email, plan, código de referido.
- **Usuario ADMIN**: nombre, apellido, email real, contraseña inicial (la cambia después), PIN de 4-6 dígitos.
- (opcional) Operador/Carga adicionales.
- **Propietario(s)**: nombre, apellido, DNI/CUIT, email, teléfono, **CBU/alias** (sin CBU no se puede rendir).
- **Propiedad**: dirección completa, ciudad, provincia, tipo, ambientes, m², sociedad/administración si aplica; participación de cada propietario (suma 100%).
- **Contrato**: inquilino titular (nombre, apellido, DNI, email, teléfono), monto, moneda, fecha inicio/fin, día de pago, índice de ajuste y frecuencia, comisión inmobiliaria, depósito, modo de cobranza (INMOBILIARIA / PROPIETARIO_DIRECTO), tipo (ALQUILER / SOLO_EXPENSAS / ALQUILER_Y_EXPENSAS) y monto de expensas si aplica.
- **Primera liquidación** (período actual): alquiler + expensas + vencimiento.

---

## Fase 1 — Backup OBLIGATORIO (antes de cualquier cambio)
1. `curl https://api-production-262e.up.railway.app/health` → `{ok:true, db:"up"}`.
2. Dump completo de la DB de prod a archivo con timestamp: `pg_dump "<DATABASE_URL pública>" -Fc -f backup-pre-prod-<fecha>.dump` (o `railway run pg_dump ...`). Verificá tamaño > 0 y que `pg_restore -l backup-*.dump` lista las tablas.
3. Guardá también el `.env` actual del API y los `apps/*/.env.local` (fuera de git).
4. Mostrá al dueño: ruta del backup, tamaño, conteo de filas por tabla principal (`inmobiliaria`, `usuario`, `propiedad`, `propietario`, `contrato`, `inquilino`, `anuncio`). **Esperá "SÍ" para seguir.**

## Fase 2 — Apagar los modos demo / hardening (código + env)
Antes de borrar datos, dejá la app lista para producción real:
1. **API**: `DEMO_MODE=false` en Railway (apaga `/auth/demo` y el backdoor `000000`). Verificá que `/auth/demo` devuelva 403/404 y que el OTP solo acepte el código real.
2. **Login real del panel** (decisión 3 de Fase 0). Mínimo viable: pantalla `/login` en `apps/inmobiliaria` (email+password → `POST /auth/login` → guarda JWT) y reemplazar `ensureApiSession()` para que **no** auto-loguee a Roberto: si no hay token, redirige a `/login`. Quitar `roberto@delsol.com/delsol123` del código.
3. **Fallback a mocks**: cuando `apiEnabled` y el server responde, el front ya usa el API. Asegurate de que el fallback a `mock-data.ts`/`*-storage.ts` NO muestre datos de "Inmobiliaria del Sol" a un usuario real (idealmente: en `apiEnabled`, si el API falla, mostrar estado vacío/onboarding, no los mocks). Como mínimo, dejá los mocks solo para `NEXT_PUBLIC_API_URL` vacío (demo de GH Pages).
4. (Si se eligió Resend) configurar `RESEND_API_KEY` y el envío real de OTP; probar que llega el mail.
5. tsc + lint limpios; suites de dominio del API verdes (`pnpm --filter api test`); redeploy del API; commit `chore(prod): apaga demo y agrega login real del panel`.

## Fase 3 — WIPE de la demo (⚠️ destructivo, gated)
Solo después del backup (Fase 1) y del hardening (Fase 2), y con confirmación literal del dueño.
1. Escribí `scripts/wipe-demo.mjs`: borra TODAS las filas de todos los modelos en orden de FKs (o `TRUNCATE <todas las tablas de negocio> RESTART IDENTITY CASCADE` en una transacción). **No** toca `_prisma_migrations` ni el esquema. Que imprima conteos antes/después (todo en 0).
2. Mostrá al dueño la lista exacta de tablas a vaciar y el conteo actual. **Esperá "SÍ, borrá la demo".**
3. Ejecutá el wipe. Verificá: todas las tablas de negocio en 0 filas. `GET /contratos` (con un admin temporal) → `[]`.
4. **Quitá los seeds de demo del flujo**: `prisma/seed.ts` ya no debe sembrar la Inmobiliaria del Sol en prod (dejalo solo para test local, o gatealo por `NODE_ENV!=='production'`). `scripts/reset-qa.mjs` es solo para QA — no se corre nunca contra prod real. El `pnpm db:deploy` del Dockerfile aplica migraciones pero **no** debe correr el seed demo en arranque.
5. Commit `chore(prod): wipe de datos demo + seeds demo fuera de producción`.

## Fase 4 — Onboarding real desde 0 (con los datos de Fase 0)
Como los ABM de alta (propiedad/propietario/contrato) aún no están migrados a UI, creá los datos reales con un script idempotente `scripts/onboarding-real.mjs` que lee `onboarding-real.input.json` y, en una transacción, da de alta:
1. **Inmobiliaria** (tenant real) con sus datos.
2. **Usuario ADMIN** real: `passwordHash` (bcrypt) de la contraseña inicial + `pinHash` del PIN. (Opcional: operador/carga.)
3. **Propietario(s)** con CBU/alias real (sin CBU, avisar que no se podrá rendir).
4. **Propiedad** real + **participaciones** (suman 100%).
5. **Contrato** real (monto, índice, comisión, depósito, modo cobranza, tipo) ligado a propiedad + inquilino.
6. **Inquilino** titular real (email real → con eso entra por OTP).
7. **Primera liquidación** del período actual (alquiler + expensas + vencimiento) para que el estado de pago derive bien.
Reglas: usar los **mismos ids con prefijo real** (no `cnt_001`…), validar que las participaciones sumen 100, que el contrato tenga inquilino, y que el período de la liquidación sea el actual. Imprimir un resumen al final (tenant id, admin email, contrato id, inquilino email).

## Fase 5 — Verificación e2e (que funcione de verdad, sin demo)
1. **Panel**: entrar por el **login real** con el admin real (NO auto-sesión). `/contratos` muestra el contrato real con estado de pago derivado correcto; `/propiedades` y `/propietarios` muestran lo real; `/caja`, `/aprobaciones`, `/anuncios` arrancan vacíos (sin seeds demo).
2. **Acción sensible**: cargar un gasto real en /caja con el PIN real → persiste. Crear un anuncio real "a todos los inquilinos" → alcance = 1 (el inquilino real) y card con 0 acuses.
3. **Inquilino**: entrar con el email real por **OTP real** (mail de Resend o código del log; el `000000` ya NO debe funcionar). Home con su deuda real (alquiler+expensas+intereses suman), feed con el anuncio real → "Enterado".
4. **Cross-origin**: el panel ve "Leído 1/1 · Confirmado 1/1" del inquilino real.
5. **Negativos de seguridad**: `POST /auth/demo` → 403/404; OTP `000000` → rechazado; un usuario sin token en el panel → redirige a /login.
6. Smoke adaptado: la versión vieja de `smoke-prod.mjs` asume datos demo (Mariela, Roberto/delsol) — actualizala o escribí `smoke-prod-real.mjs` con las credenciales reales. 6/6 verde.

## Fase 6 — Entregable + follow-ups
- `ONBOARDING-PROD.md`: qué se borró (con ref al backup), qué se apagó (DEMO_MODE, auto-sesión), el tenant/admin/contrato/inquilino reales creados, y cómo entra cada uno.
- Estado: tests del API verdes, smoke real 6/6, working tree limpio, API redeployada.
- **Follow-ups que quedan para autogestión desde la UI** (anotalos, no los hagas salvo que el dueño lo pida): migrar al API el alta de propiedades/propietarios/contratos (hoy localStorage), pantalla de signup de nuevas inmobiliarias, retención/recuperación de contraseña real, Resend si no se activó.
- Si algo es BLOQUEANTE (ej: no hay login real del panel y el dueño no quiere construirlo ahora, o no hay forma de que el inquilino reciba el OTP), va ARRIBA DE TODO en rojo y se frena.

## Orden de ejecución (resumen)
Fase 0 (datos+decisiones) → Fase 1 (backup, confirmar) → Fase 2 (hardening, redeploy) → Fase 3 (wipe, confirmar "SÍ borrá") → Fase 4 (onboarding real) → Fase 5 (verificación e2e) → Fase 6 (entregable). Backup y confirmaciones son innegociables.
