# Estado del proyecto — My Alquiler

> **Documento de handoff.** Resumen ejecutivo de dónde está el proyecto hoy.
> Última actualización: **2026-07-04**. Último commit: `535d15d` (origin/main, árbol limpio).
> Contexto absoluto en [`../PROJECT.MD`](../PROJECT.MD). Detalle en los demás `work-agent/`.

## Qué es

**My Alquiler** (codename `@llave/*`) es un SaaS **multi-tenant** de gestión de
alquileres para **Tapia Propiedades** (y futuras inmobiliarias). Dos frentes:

- **Panel de la inmobiliaria** (admin): contratos, propiedades, propietarios, pagos,
  rendiciones, caja, reclamos, equipo, sociedades, configuración.
- **PWA del inquilino**: contrato/liquidaciones, informar pagos con comprobante,
  boletas de servicios, reclamos, co-inquilinos, notificaciones.

## EN VIVO (producción, Railway)

| Servicio | URL |
|---|---|
| Panel inmobiliaria | **https://admin.myalquiler.com** |
| PWA inquilino | **https://app.myalquiler.com** |
| API | https://api-production-262e.up.railway.app (`GET /health`) |

Tenant real: **Tapia Propiedades** · admin `alannaimtapia@gmail.com / Tapia.2026! / PIN 1234`.

## Dónde estamos

El sistema está **lanzado y endurecido**, con el flujo central **100% cableado al API
real** (no mock): contratos, liquidaciones, pagos, rendiciones, caja, reclamos,
equipo, sociedades, co-inquilinos, servicios, documentos. Múltiples campañas de
auditoría multi-agente arreglaron **~50+ bugs reales** verificados y deployados.

**Hitos junio 2026 (todo en prod, en `main`):**

- ✅ **File storage REAL** (Railway Volume `/data` + `/uploads` multipart): los 4
  flujos de archivos suben de verdad — comprobante de pago, foto de reclamo, boleta,
  documentos del contrato. (Ver `01-ARQUITECTURA.md` §storage y `../PROJECT.MD` §9.)
- ✅ **Cron de devengo** in-process (cada 6h, idempotente) + endpoint
  `/internal/cron/devengar` con `CRON_SECRET`. Genera liquidaciones futuras sin tocar nada.
- ✅ **Servicios públicos** del panel persistidos (la inmo carga → el inquilino ve) y
  **edición de propiedad** que persiste de verdad (antes era override de localStorage).
- ✅ **Auditoría multi-agente 27/06** — workflow (6 finders → verificación adversarial
  → crítico de completitud) encontró **8 hallazgos, los 8 fixeados/deployados/testeados
  en prod** (E2E con cleanup; B2 con test de regresión). Ver `03-AUDITORIAS.md`.

**Cierre de julio 2026 (02-04/07) — se cerró TODO el backlog de archivos/adjuntos
(todo en prod vía `railway up` y en `main`, demo intacta / ambos modos andan):**

- ✅ **Consorcios Fase 1** (CRUD real: consorcio, UFs, movimientos, asambleas) — 02/07.
- ✅ **8 features que cierran el backlog de "campos en schema SIN feature"** (auditoría de
  archivos/adjuntos): construidas de verdad, E2E, con la demo intacta —
  - **Avatar del inquilino** + **documentos reales** (DNI/recibos/garante).
  - **Flujo real del profesional por link mágico** (`/p/:token`, sin cuenta ni password):
    confirmar → en camino → listo, con **fotos antes/después** a `/uploads`.
  - **Validador de resumen bancario** (CSV/Excel, **matching determinístico SIN IA/OCR**):
    parseo del extracto + conciliación con PIN que crea un `Pago` CONCILIADO directo.
  - **Migración de cartera** (Excel/CSV con **mapeo flexible** de columnas): subir → mapear
    → validar fila por fila → confirmar crea propiedades + inquilinos + contratos.
  - **Avatar del usuario del panel** (`PUT /me/avatar`) — backend-ready (falta UI del panel).
  - **Comprobante en gastos de caja** (`MovimientoCaja.comprobanteUrl`) — backend-ready
    (falta UI del panel).
  - **Harden de tenant en uploads** (`f715055`): se cerró la fuga por la que un inquilino
    podía inyectar una imagen externa (`https://`) en foto/adjunto de reclamo y archivo de
    boleta (ahora validan `urlEsDelTenant`).

## Qué falta (próximo chat)

**No hay bugs abiertos conocidos.** La **conciliación bancaria** y la **migración de
cartera** ya están (ver julio, arriba), así que salen de esta lista. Lo que queda:

**Backend-ready, falta solo la UI del panel** (no es decisión, es cablear el front):

1. **Avatar del usuario del panel** — `PUT /me/avatar` vivo; el panel todavía muestra
   iniciales, no sube foto.
2. **Comprobante en gastos de caja** — el alta acepta `comprobanteUrl` pero el form de
   caja no lo adjunta (el comprobante de **pago** del inquilino sí tiene UI).

**Decisión de producto o insumo del owner** (no es bug) — triado en `04-PENDIENTES.md`:

3. **Forma de pago del plan SaaS** (billing): cómo cobra el SaaS a la inmobiliaria.
4. **Programa de referidos**: reglas comerciales.
5. **Screening real** (NOSIS) · **IA/OCR opcional** de comprobantes (presupuesto) — hoy
   el resumen bancario matchea sin IA por decisión del dueño; el OCR sería un extra.
6. **WhatsApp real** (recordatorio a morosos / invitaciones).

## Cómo seguir

1. Para una feature nueva: leé `01-ARQUITECTURA.md` (patrones) + `05-DECISIONES.md`
   (reglas LOCKED) antes de tocar plata/auth/multi-tenant.
2. Cablear con disciplina (verificar file:line, `tsc`+`build` 0, E2E contra prod con
   cleanup), commitear, deployar (`02-DEPLOY.md`), smoke test.
3. Para validar que no se rompió nada: re-correr `PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md`.

## Mapa de este handoff

| Archivo | Contenido |
|---|---|
| `00-ESTADO.md` | Este resumen ejecutivo |
| `01-ARQUITECTURA.md` | Stack, estructura, multi-tenant, money model, storage, cron, convenciones |
| `02-DEPLOY.md` | Railway, Volume, migraciones, consultar prod, smoke test, reglas duras |
| `03-AUDITORIAS.md` | Historia de las campañas + metodología + la auditoría 27/06 (8 fixes) |
| `04-PENDIENTES.md` | Roadmap — lo que falta (decisiones de producto) |
| `05-DECISIONES.md` | Decisiones de negocio del dueño + reglas duras |
| `06-ANALISIS-SENIOR.md` | Análisis dev senior / roadmap en olas |
| `PROMPT-ONBOARDING-DEV-SENIOR.md` | **Prompt de onboarding** — un dev senior x10 recorre TODO, lo entiende y propone con qué seguir |
| `PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md` | Prompt reutilizable de auditoría en loop |
| `historico/` | Docs viejos archivados (auditorías/reportes/prompts) |
| `../PROJECT.MD` | **Documento maestro (contexto absoluto)** |
| `../README.md` | Orientación + tooling + setup |
| `../docs/` | Referencias: API, modelo de datos, config, runbook, testing, frontend, glosario |
| `../CONTRIBUTING.md` · `../SECURITY.md` · `../CHANGELOG.md` | Contribuir · seguridad · historial |
