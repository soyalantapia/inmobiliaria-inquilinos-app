# 🔁 PROMPT — QA loop experto: flujo real de usuario × 10 pasadas limpias

> Pegá todo lo de abajo (desde "ROL") en una sesión de Claude Code parada en
> `~/dev/inmobiliaria-inquilinos-app`. Corre journeys de usuario REALES, arregla
> lo que encuentre, resetea todo y vuelve a empezar — hasta encadenar 10 pasadas
> perfectas consecutivas.

---

ROL: Sos un QA senior + ingeniero full-stack de **My Alquiler** con mandato de
**cero defectos**. Tu trabajo NO es tildar checks: es **vivir el producto como lo
viven Roberto (inmobiliaria) y Mariela (inquilina)**, con el dedo en la pantalla
y el ojo en cada detalle. Cuando algo falla, lo **arreglás vos** (código), lo
verificás, **reseteás TODO y volvés a empezar desde cero**. Terminás cuando
encadenás **10 PASADAS COMPLETAS SIN UN SOLO HALLAZGO, CONSECUTIVAS**.

## La mecánica del loop (no negociable)
- **1 pasada** = los 3 journeys (A, B, C de abajo) completos, en orden, sin
  ningún error, dato incoherente, pantalla rota, request fallido ni fricción
  que un usuario real notaría.
- Si encontrás CUALQUIER problema: (1) documentalo en `QA-LOOP-LOG.md` (qué,
  dónde, evidencia), (2) **arreglalo en el código**, (3) verificá el fix
  puntual, (4) commitealo (`fix(qa-loop): …`), (5) **RESET TOTAL** y (6) el
  **contador de pasadas exitosas vuelve a 0**. Las 10 pasadas valen solo si son
  consecutivas sin tocar código.
- Mantené el contador visible: arrancá cada pasada anotando en el log
  `## Pasada N (exitosas consecutivas: X/10)`.
- Si en 3 intentos no podés arreglar algo, anotalo como BLOQUEANTE en el log y
  frenón: reportá al dueño. No lo tapes ni lo saltees.

## El producto y su arquitectura HOY (acabamos de construir el backend)
- Monorepo Turborepo+pnpm. **El dato vive en PostgreSQL (Railway)** detrás de
  un API Fastify **EN PRODUCCIÓN**: `https://api-production-262e.up.railway.app`.
- 🏠 **apps/inquilino** (:3000, mobile-first) — Mariela Sosa, contrato `cnt_001`,
  Gorriti 4521 3°B. Login OTP real o bypass `/login?demo=1`.
- 🏢 **apps/inmobiliaria** (:3001) — Roberto Tapia, "Inmobiliaria del Sol".
  El panel auto-loguea contra el API (sesión dev de Roberto) al consumir datos.
- **Flag `NEXT_PUBLIC_API_URL`** (en `apps/*/.env.local`, hoy apuntando a PROD):
  con valor → hooks de TanStack Query contra el API (con fallback localStorage
  si el server no responde); vacío → modo demo localStorage puro.
- Doc de referencia: `BACKEND.md` (arquitectura/credenciales) y
  `BACKEND-PROGRESS.md` (qué está migrado y qué no). Código de hooks:
  `apps/*/src/lib/api/{client,hooks,session}.ts`.

## Qué pantallas hablan con el API (expectativas honestas)
**Migradas (deben mostrar datos de la DB):** panel → `/contratos` (con
estadoPagoActual DERIVADO de liquidaciones), `/caja` (crear/eliminar con PIN),
`/aprobaciones` (aprobar/rechazar con PIN del server), `/anuncios` (conteos
Leído/Confirmado REALES + crear/eliminar); inquilino → login OTP/demo (JWT),
feed "Anuncios de la inmobiliaria" del home (acuses reales vía
`/mis-anuncios` + `enterado`).
**Aún en localStorage (NO exigirles datos del API; sí exigirles que funcionen
como demo):** panel → `/pagos` (PagosPorValidar), `/`, `/propiedades`,
`/propietarios`, `/reclamos`, `/renovaciones`, `/consorcios`, `/screening`,
`/configuracion`; inquilino → checkout/comprobantes, contrato, reclamos,
servicios, cuenta, co-inquilinos, certificado. Si durante el loop te sobra
tiempo NO migres pantallas nuevas (scope creep) — solo arreglá lo roto.

## Credenciales y datos seed (para asserts exactos)
- Panel: `roberto@delsol.com` / `delsol123` (ADMIN) · **PIN `1234`** ·
  luciana@ (OPERADOR) y camila@ (CARGA), mismo pass/PIN.
- Mariela: `mariela.sosa@gmail.com` — OTP `000000` (DEMO_MODE) o el código real
  que el server loguea; o `/login?demo=1`.
- Seeds clave: 8 contratos (`cnt_001` Mariela $480.000 ARS ACTIVO **VENCIDO**
  liq mayo $572.000 · `cnt_002` Juan Pérez $620.000 PAGADO · `cnt_003` Laura
  Giménez $510.000 VENCIDO · `cnt_005` Ana Pereyra $850.000 · `cnt_006` Tomás
  Bravo USD BORRADOR pendiente de aprobación · `cnt_007` consorcio SOLO_EXPENSAS),
  propietarios `own_001` Castro (60% de prp_001, comisión 8%) … `own_003` López
  Vega SIN CBU (rendirle debe dar error claro), caja `mov_001..003`, anuncios
  `anu_seed_1..3`, aprobaciones `apr_seed_1` (contrato Tomás) y `apr_seed_3`
  (devolución depósito).
- ⚠️ La DB de Railway es LA de la demo: tus pasadas la mutan y tu reset la
  restaura. JAMÁS `prisma migrate reset` contra ella.

## Setup y RESET TOTAL (entre pasadas con fix, y antes de la pasada 1)
1. **Servers**: API ya corre en Railway (no hay que levantarlo). Fronts por
   Claude Preview MCP (launch.json: `llave-inquilino` :3000,
   `llave-inmobiliaria` :3001). Pantalla en blanco sin errores de consola =
   HMR corrupto → `preview_stop` + `preview_start`.
2. **Script de reset** (crealo UNA vez en `scripts/reset-qa.mjs` y reusalo):
   restaura el estado seed mutado — inspirate en los helpers `resetPlata()` de
   `apps/api/test/plata.test.ts` y `resetOperacion()` de `test/operacion.test.ts`:
   pag_001 → INFORMADO, liq_005 → PENDIENTE, cnt_006 → BORRADOR+pendiente,
   apr_seed_1/3 → PENDIENTE, mov_002/003 → no descontados, borra rendiciones ≠
   ren_001, borra anuncios/gastos/reclamos/pagos con prefijo `QA-` o creados en
   pasadas, **borra los AnuncioAcuse de Mariela** (para que el loop de acuses
   arranque virgen), y corre `seedBase` (es idempotente). Ejecutalo con
   `cd apps/api && pnpm exec tsx ../../scripts/reset-qa.mjs` (usa el
   PrismaClient del workspace con la DATABASE_URL del .env del api).
3. **localStorage limpio** en AMBOS orígenes: `localStorage.clear()` vía
   `preview_eval` en :3000 y :3001 (mata tokens y residuos de demo).
4. **REGLA 0 — identidad**: antes de cada pasada confirmá que :3000/:3001 son
   My Alquiler (NO Vulcano/Deenex/San Pedro — pasó que el preview cayó a otra
   app del workspace). Y `curl https://api-production-262e.up.railway.app/health`
   → `{ok:true, db:"up"}`.

## Los 3 journeys (el flujo REAL — vivilos, no los tildes)

### Journey A — Roberto, "la mañana del lunes" (panel, desktop 1440×900)
1. Abrí `/` → el dashboard carga sin errores de consola; "Para resolver hoy"
   tiene items tocables.
2. `/contratos` → **los 8 contratos de la DB** con badges de estado de pago
   REALES (Mariela "Atrasado/Vencido", Juan "Pagado"). Buscá "Mariela" en el
   buscador → filtra. Filtros Activos/Borradores funcionan y los contadores
   coinciden con lo visible.
3. `/aprobaciones` → la bandeja lista desde el API (autores Camila/Luciana).
   Aprobá el contrato de Tomás Bravo: ConfirmDialog → **PIN incorrecto `9999`
   primero** (debe rechazar con mensaje claro, sin romper el estado) → PIN
   `1234` → APROBADA. Volvé a `/contratos` → **cnt_006 ahora ACTIVO**.
4. `/caja` → los 3 gastos de la DB. Cargá un gasto nuevo
   (`QA-P{N} cerrajería test`, $15.000, propiedad Jorge Newbery) → aparece en
   la lista y los KPIs suman. Eliminalo: requiere PIN; con PIN ok desaparece.
   Intentá eliminar "Reparación pérdida cocina" (mov_001, ya rendido) → debe
   negarse con mensaje claro (409, inmutabilidad contable).
5. `/anuncios` → conteos Leído/Confirmado coherentes (números reales, no
   inventados). Creá un anuncio `QA-P{N} aviso de prueba` a TODOS los
   inquilinos → el alcance/destinatarios es real (≥5) y la card aparece con
   0 acuses. (Lo vas a usar en el Journey C — no lo borres todavía.)
6. Pasada PAR: repetí 2-5 en **mobile 375** (preview_resize): sin overflow
   horizontal, bottom-nav presente, diálogos full-screen, botones alcanzables.

### Journey B — Mariela, "me llegó el aviso" (inquilino, SIEMPRE mobile 375)
1. localStorage limpio → `/login?force=1` → flujo OTP COMPLETO: email
   `mariela.sosa@gmail.com` → pedir código → ingresá `000000` → entra al home
   con su nombre. (Pasada IMPAR: usá `/login?demo=1` en lugar del OTP —
   alterná los dos caminos.) Verificá que quedó **JWT real** en
   `llave:auth:token` (payload kind=inquilino).
2. Home: banner de deuda con desglose que SUMA exacto (alquiler $480.000 +
   expensas $92.000 + intereses = total mostrado), saludo "Hola, Mariela",
   quick actions presentes.
3. Feed "Anuncios de la inmobiliaria": viene del API (debe incluir el
   `QA-P{N}` del Journey A). Badge "N sin leer" coherente con los dots.
   Abrí un anuncio (se expande, queda leído, el contador baja). En el anuncio
   `QA-P{N}`: tocá **"Enterado"** → pasa a verde ✓ y el contador baja.
4. Recargá la página → los acuses PERSISTEN (vienen del server, no de
   localStorage).
5. Recorré 3 pantallas más como usuaria (contrato, pagos/comprobantes,
   reclamos): cargan sin errores, sin overflow, datos coherentes entre sí
   (son demo localStorage — exigí consistencia interna, no datos del API).

### Journey C — el loop cruzado (la prueba de que el sistema es UNO)
1. Volvé al panel (:3001) → `/anuncios` → el anuncio `QA-P{N}` debe mostrar
   **Leído 1/N · Confirmado 1/N** (el acuse REAL de Mariela del Journey B,
   llegado vía Railway — si tarda, el refetch es cada 30s; recargá).
2. Eliminá el anuncio `QA-P{N}` (teardown) → confirma que avisa "para todos
   sus destinatarios" → desaparece.
3. Smoke de cierre: `node scripts/smoke-prod.mjs https://api-production-262e.up.railway.app`
   → 6/6.
4. Si TODO el recorrido (A+B+C) fue impecable → `## Pasada N: ✅ LIMPIA` en el
   log y contador+1. Si NO → fix → reset → contador a 0.

## Workarounds operativos (ignorarlos te va a costar horas)
- `preview_click` no siempre dispara onClick de React → interactuá con
  `.click()` nativo y setters nativos
  (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set`)
  + `dispatchEvent(new Event('input',{bubbles:true}))` vía `preview_eval`.
  Esperá 300-450ms antes de medir; para llamadas al API de prod esperá 1.5-3s.
- `<Select>` de Radix: UN cambio por eval; leé toasts en el MISMO eval (se
  auto-dismissean en ~3s).
- El primer GET tras el login demo puede dar 401 (carrera token) — TanStack
  reintenta; si una pantalla queda en error, recargala antes de declarar bug.
- Overflow: medí `scrollWidth - clientWidth`; ~5px en :3001 = artefacto del
  scrollbar headless, NO bug (verificá dos veces antes de declarar).
- OTP real: el código sale en el log del server de Railway
  (`railway logs --service api`) — pero con DEMO_MODE el `000000` alcanza.

## Reglas de los fixes
- Arreglá la CAUSA, no el síntoma (si un dato está mal, ¿es el seed, el
  endpoint, el adaptador del hook o la pantalla?).
- Después de cada fix: tsc + lint del paquete tocado limpios; si tocaste el
  API, corré su suite de dominio (`pnpm --filter api exec vitest run test/<dominio>.test.ts`).
- Si el fix toca el API, el de PROD queda viejo → redeploy:
  `railway up --service api --detach` y esperá el health (el dueño ya autorizó
  el ciclo de deploy del api). Anotalo en el log.
- Commit por fix con trailer
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
  Push solo al final del loop (o si el dueño lo pide).
- PROHIBIDO: tocar `.github/workflows/` (token sin scope), `migrate reset`
  contra la DB, bajar la vara de un assert para que "pase".

## Variaciones entre pasadas (un QA real no repite como robot)
- Pasadas IMPARES: panel desktop + login demo. PARES: panel también en mobile
  375 + login OTP completo.
- Alterná el orden B→A→C en las pasadas 4 y 8.
- Datos de prueba SIEMPRE con prefijo `QA-P{N}` (N = número de pasada) — el
  teardown y el reset los buscan por ese prefijo.
- En al menos 2 pasadas: probá un camino de error extra (PIN mal 2 veces,
  rechazo de aprobación sin motivo, OTP incorrecto) — deben fallar con
  mensajes claros, jamás romper la pantalla.

## Entregable final
`QA-LOOP-LOG.md` con: tabla de pasadas (N, journeys, resultado, hallazgos),
cada hallazgo con causa raíz + fix + commit, y el cierre:
**"10/10 pasadas limpias consecutivas — pasadas X a Y"** + lista de todos los
fixes hechos en el camino + estado final (tests del API verdes, smoke prod 6/6,
working tree limpio). Si quedó algo BLOQUEANTE, va arriba de todo en rojo.
