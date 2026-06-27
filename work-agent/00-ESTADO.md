# Estado del proyecto — My Alquiler

> **Documento de handoff.** Resumen ejecutivo de dónde está el proyecto hoy.
> Última actualización: **2026-06-27**. Último commit: `23fae36` (auditoría 27/06, D4).
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

## Qué falta (próximo chat)

**No hay bugs abiertos conocidos.** Lo pendiente necesita **decisión de producto o
insumo del owner** (no es bug) — triado en `04-PENDIENTES.md`:

1. **Forma de pago del plan SaaS** (billing): cómo cobra el SaaS a la inmobiliaria.
2. **Programa de referidos**: reglas comerciales.
3. **Screening real** (NOSIS) · **Broker IA/OCR** de comprobantes (presupuesto).
4. **WhatsApp real** (recordatorio a morosos / invitaciones) · conciliación bancaria.

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
