# Reporte nocturno — My Alquiler — 2026-07-14

> Trabajo autónomo sin supervisión. **NIVEL_DESPLIEGUE = `pr`** (rama + PR, sin deploy).
> Rama: `fix/followups-noche-2026-07-14` · PR: https://github.com/soyalantapia/inmobiliaria-inquilinos-app/pull/4

## 1. Resumen ejecutivo

Proyecto **maduro / ya lanzado en prod**. El backlog accionable-y-sin-bloqueos era chico. Se cerraron **2 fixes de correctitud** (detectados/flageados en sesiones previas), verificados y con PR listo para revisar.

- **2 HECHOS** (verificados): #1 INFORMADO huérfano al conciliar · #2 cobros parciales en "por rendir".
- **2 PARKEADOS** (decisión/diseño, no adivino): #3 quitar PIN residual (9 pantallas) · avatar del usuario del panel.
- **5 BLOQUEADOS por decisión del owner / API keys** (Sección A de `04-PENDIENTES.md`): billing SaaS, referidos, screening NOSIS, WhatsApp, IA/OCR.
- Sin secretos commiteados. Sin tests rotos introducidos.

## 2. Por ítem

### ✅ #1 — Auto-cerrar el aviso INFORMADO huérfano al conciliar por extracto
- **Qué era:** al conciliar un crédito del extracto bancario que salda una liquidación, un aviso de pago del inquilino (estado `INFORMADO`) que siguiera pendiente quedaba vivo en "Pagos a validar" como saldo fantasma; validarlo daba un 409 confuso. (No había doble-cobro: el tope-al-saldo de `/pagos/:id/validar` ya lo prevenía.)
- **Qué hice:** dentro de la misma transacción de conciliar, cuando la liq queda saldada (`cobrado >= total`), auto-rechazo los `INFORMADO` de esa liq con el patrón neutro `"Anulado tras conciliar:"` (la PWA del inquilino lo muestra como anulado, sin alarmarlo; el cobro figura en "Pagos recibidos"). Scoped por `liquidacionId + inmobiliariaId`; idempotente.
- **Archivo:** `apps/api/src/routes/resumenes-bancarios.ts` (commit `2249151`).
- **Verificación:** **E2E en la API real (dev)** — contrato throwaway → seed `INFORMADO` + resumen + crédito → `POST .../conciliar`. Resultado: `INFORMADO→RECHAZADO`, crédito`→CONCILIADO`, liq`→PAGADO`, tope-al-saldo intacto (100000==100000). **Regresión:** crédito parcial → `INFORMADO` **sigue** INFORMADO, liq`→PARCIAL` (no rechaza un pago legítimo). Fixtures borrados. typecheck + build api ✅.
- **Estado:** HECHO.

### ✅ #2 — Contar cobros PARCIAL en "propietarios por rendir"
- **Qué era:** `usePropietarios` (KPI "por rendir" + preview del diálogo de rendir) contaba solo liqs `PAGADO` y **excluía `PARCIAL`**, pero el server (`POST /rendiciones`) sí rinde lo conciliado de las PARCIAL. Un dueño con cobro parcial mostraba $0 y no aparecía en "por rendir".
- **Qué hice:** incluir PARCIAL con la porción de alquiler efectivamente cobrada: `min(montoPagado, montoTotal) × (montoAlquiler / montoTotal)` (sin expensas), prorrateada igual que el cierre de caja. PAGADO sigue usando el alquiler completo. Mantiene la exclusión de `PROPIETARIO_DIRECTO`.
- **Archivo:** `apps/inmobiliaria/src/lib/api/hooks.ts` (commit `13ff5e8`).
- **Verificación:** typecheck ✅ + fórmula (6 casos, todos OK). **La auditoría encontró un P2** (prorrateaba con mora en el denominador) → **arreglado** en commit `5de629e` (ver §7). **Honesto:** la UI **no** se ejerció en runtime (requiere panel + datos con cobro parcial del mes); la fórmula ahora replica exactamente la proración del server (base sin mora).
- **Estado:** HECHO (lógica verificada + hallazgo de auditoría corregido; UI no ejercida).

### ⏸️ #3 — Quitar el PIN residual (parkeado)
- **Qué es:** el PIN se eliminó de la plataforma (kill-switch `verificarPin` no-op), pero el front todavía muestra `PinPromptDialog` en **9 pantallas** (caja, detalle de contrato, validador de resumen, rendir propietario, cargar pago manual, anular rendición, bandeja de aprobaciones, pagos por validar…). Pide un PIN que no hace nada.
- **Por qué lo parkeo:** no es un bug puntual sino una **decisión de UX de producto** sobre 9 flujos (¿se saca el paso de confirmación entero, o se deja como fricción sin PIN?). Cambiar los 9 autónomamente es un barrido amplio y ambiguo → contra la regla "ante duda, lo más reversible / no tomar decisiones ambiguas". Mi tarea flageada original era solo "caja", pero arreglar solo caja deja inconsistencia.
- **Qué necesito de vos:** definir si el PIN sale de TODAS las pantallas (lo hago en un barrido) o se mantiene como confirmación.

### ⏸️ Avatar del usuario del panel (parkeado)
- **Qué es:** `PUT /me/avatar` existe en el back, pero el panel no lo usa (muestra iniciales) y **no hay página de perfil** donde poner la subida.
- **Por qué lo parkeo:** (a) falta una **decisión de diseño** (dónde vive la subida — no hay pantalla de perfil); (b) el owner **acaba de pedir quitar el avatar del header** (bug #2, ya resuelto) → agregar una feature de avatar contradice esa preferencia reciente. Ambiguo → no adivino.

### ⛔ Bloqueados por decisión del owner / API keys (Sección A de `04-PENDIENTES.md`)
No accionables sin insumo tuyo; los dejo documentados:
1. **Billing / forma de pago del SaaS** — modelo de cobro sin definir (+ posible integración MercadoPago).
2. **Programa de referidos** — reglas comerciales sin definir.
3. **Screening real (NOSIS)** — falta `NOSIS_API_KEY` / contrato con el proveedor.
4. **WhatsApp real** — falta cuenta WhatsApp Business + `WHATSAPP_*`.
5. **IA/OCR de comprobantes** — opcional; la conciliación bancaria ya funciona sin IA.

## 3. Commits / PRs / deploys
- Rama: **`fix/followups-noche-2026-07-14`** (desde `main` `7009f12`).
- Commits (cada uno un solo archivo, mío):
  - `2249151` fix conciliación #1
  - `13ff5e8` fix rendiciones #2 (base)
  - `a88acbc` docs: este reporte
  - `5de629e` fix rendiciones #2 — prorrateo sobre base sin mora (**hallazgo P2 de la auditoría, arreglado**)
- **PR #4** abierto contra `main`: https://github.com/soyalantapia/inmobiliaria-inquilinos-app/pull/4
- **Deploys:** ninguno (NIVEL=pr).

## 4. Bloqueos y decisiones que necesitan tu OK (leer primero)
1. **#3 PIN residual (9 pantallas):** ¿saco el PIN de todas, o queda como confirmación? (definí y lo barro).
2. **Avatar panel:** ¿lo querés? Si sí, ¿dónde vive la subida (nueva pantalla "Mi cuenta")? Ojo que choca con el pedido reciente de quitar el avatar del header.
3. **Sección A (billing/referidos/NOSIS/WhatsApp/IA):** necesito tus reglas/keys para avanzar cualquiera.
4. **PR #4:** revisá y mergeá cuando quieras. #2 no fue ejercido en UI (solo fórmula) — si querés, lo pruebo en el panel con datos de cobro parcial antes de mergear.

## 5. Riesgos y cosas a revisar
- **Working tree COMPARTIDO entre sesiones:** hay WIP de otra sesión sin commitear (landing: `calculadora`, `trust-logos`, `header`, `testimonios`, `inicio/page`). **Commiteé solo mis 2 archivos por path explícito**; nada ajeno entró. ⚠️ Riesgo operativo del repo: `railway up` sube el working tree entero → una sesión puede deployar WIP de otra. Regla: commitear → árbol limpio → deploy.
- **Secretos:** `.env` gitignoreado, sin `.env` trackeados, sin secretos hardcodeados en `src`. Limpio.
- **DB dev (23651) compartida:** NO corrí el test suite de `apps/api` (usa `seedBase` destructivo sobre la DB compartida con otra sesión activa → viola "menor riesgo"). Verifiqué con typecheck + build + E2E dirigido con cleanup.

## 6. Próximos pasos sugeridos (priorizados)
1. **Revisar + mergear PR #4** (2 fixes de correctitud, bajo riesgo).
2. **Decidir #3 (PIN)** — barrido de 9 pantallas, 1 sesión.
3. **Definir billing** (P1 de negocio: hoy la pantalla de "forma de pago" es fake en prod).
4. Conseguir keys de **NOSIS** y **WhatsApp** para activar screening y recordatorios (features cáscara ya listas).
5. Avatar panel: decidir si va y dónde.

---
## 7. Auditoría adversarial (workflow de 3 agentes + revisión inline)

El workflow **sí completó** (había concluido erróneamente que se interrumpió; terminó tarde). Encontró **1 hallazgo P2 REAL en mi propio commit #2**, que **arreglé** (commit `5de629e`). Los demás son P3 documentados.

### 🔴→✅ P2 (ARREGLADO) — #2 prorrateaba con mora en el denominador
- **Bug:** la porción de alquiler cobrada de una PARCIAL se prorrateaba sobre `l.montoTotal`, pero ese monto de `GET /liquidaciones` **ya incluye el punitorio** (`conSaldo` lo suma). El server (`POST /rendiciones`) y el cierre de caja prorratean/capean sobre la **base sin mora**. → Para toda liq PARCIAL vencida con recargo, el KPI **subestimaba** el alquiler rendible (~9–17%). Ej: alquiler 100k + mora 10k, pagó 55k → el panel mostraba 50k, el server rinde 55k. Conservador (nunca sobre-rinde) y display-only, pero contradecía el objetivo del commit ("igual que el cierre de caja").
- **Fix:** usar `base = montoTotal − montoPunitorio` como denominador y tope. **Verificado** con 6 casos (mora, mora+expensas, cap, SOLO_EXPENSAS, PAGADO). typecheck ✅. Commit `5de629e`.
- _Confirmado independientemente por 2 de los 3 agentes de auditoría._

### P3 (documentados — follow-ups, no bloqueantes)
1. **#2 KPI es bruto, no neto de lo ya rendido.** El server `/rendiciones` es **incremental** (resta `AlquilerRendido` previo por liq, para rendir un mes en varias tandas — el caso que #2 habilita). El KPI/preview muestra el bruto acumulado, así que si a un dueño ya se le rindió una tanda del mes, "a rendir" sobreestima lo que **queda**. **No mueve plata mal** (el server es la fuente de verdad: `rendible<=0 → continue`/409), pero engaña al operador sobre el remanente. **Pre-existente** (afectaba PAGADO); ahora también PARCIAL. Fix real requiere exponer lo ya-rendido por liq al front → cambio más grande, no lo hice de noche. `hooks.ts:1095-1102` / `rendir-propietario-dialog.tsx:114`.
2. **#1 no registra evento de auditoría** en el auto-rechazo. Es parte de un gap pre-existente: **todo** el endpoint de conciliación bancaria no emite eventos (ni el CONCILIADO del crédito), a diferencia de los conciliar de `plata.ts`. Follow-up: emitir `PAGO_RECHAZADO`/`PAGO_CONCILIADO` en `resumenes-bancarios.ts`.
3. **#1 hardening `inmobiliariaId`** en el `updateMany` (defensa-en-profundidad; NO es leak — `liquidacionId` es tenant-única). No lo apliqué en el momento por la volatilidad del archivo compartido; follow-up de 1 línea.

### Verificado sólido (sin hallazgos)
- #1: no toca el CONCILIADO nuevo; idempotente; prefijo `"Anulado tras conciliar:"` matchea el mapeo neutro de la PWA; gate `cierra` correcto (regresión E2E OK).
- #2 (post-fix): `PROPIETARIO_DIRECTO` excluido; `montoPagado` = solo CONCILIADO; sin doble-conteo; división por cero guardada.
- **Seguridad:** `.env` ignorado, sin `.env` trackeados, sin secretos hardcodeados. Multi-tenant OK. **Sin P0/P1.**

## 8. Incidente operativo (importante)
Durante la noche, **otra sesión concurrente tomó el checkout local compartido**: cambió el branch a `feat/landing-mejoras` y commiteó ahí su trabajo de landing (`f22f35f`), moviendo el `HEAD` local fuera de mi rama. **Mi trabajo NO se perdió** — mis 2 commits están en `origin/fix/followups-noche-2026-07-14` y en el **PR #4** (verificado). Dejé de operar git en el checkout compartido para no colisionar con la sesión activa. Esto confirma el riesgo ya conocido: **el working tree se comparte entre sesiones** — conviene que cada sesión trabaje en su propio `git worktree`, o coordinar para no pisarse el `HEAD`.

