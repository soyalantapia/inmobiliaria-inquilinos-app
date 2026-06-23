# Estado del proyecto — My Alquiler

> **Documento de handoff.** Resumen ejecutivo de dónde está el proyecto hoy.
> Última actualización: 2026-06-21. Último commit: `081c17e` (auditoría v5).
> Para detalle, ver los demás archivos de `work-agent/`.

## Qué es

**My Alquiler** (codename interno `@llave/*`) es un SaaS **multi-tenant** de gestión
de alquileres para **Tapia Propiedades** (y futuras inmobiliarias). Dos frentes:

- **Panel de la inmobiliaria** (admin): contratos, propiedades, propietarios,
  pagos, rendiciones, reclamos, equipo, sociedades, configuración.
- **PWA del inquilino**: ver contrato/liquidaciones, informar pagos, comprobantes,
  reclamos, servicios, co-inquilinos.

## EN VIVO (producción, Railway)

| Servicio | URL |
|---|---|
| Panel inmobiliaria | **https://admin.myalquiler.com** |
| PWA inquilino | **https://app.myalquiler.com** |
| API | https://api-production-262e.up.railway.app |

Tenant real: **Tapia Propiedades**. Admin: `alannaimtapia@gmail.com / Tapia.2026! / PIN 1234`.
Healthcheck: `GET /health` → `{ok, db, ts}`.

## Dónde estamos

El sistema está **lanzado y endurecido**. Se hicieron **6 pasadas de auditoría
multi-agente** (pre-lanzamiento + v2 + v3 + v4 + 2 regresiones) que arreglaron
**~50 bugs reales** verificados contra el código y deployados en prod. El flujo
central — contratos, liquidaciones, pagos, rendiciones, reclamos, equipo,
sociedades, co-inquilinos — está **cableado al API real**.

- **Core**: sólido y en prod. Money model, multi-tenant, máquinas de estado,
  locks atómicos, constraints únicos, auth/PIN/OTP — todo auditado.
- **Tendencia**: cada re-corrida del prompt de auditoría encuentra menos bugs
  (v4: 24 → 1ra regresión: 12 → 3ra regresión: ~15 confirmados, varios
  regresiones de los propios fixes). El loop **converge**.
- **3 decisiones de negocio** tomadas por el dueño (ver `05-DECISIONES.md`):
  comisión sobre alquiler, cualquier co-inquilino puede pagar, gastos por
  propiedad con ingreso.

## Qué falta (lo más importante para el próximo chat)

Hay **~15 hallazgos confirmados de la 3ra pasada de auditoría SIN aplicar todavía**
(la síntesis se cortó por límite de sesión, pero los confirmados están). Varios
son **regresiones de los fixes de la v5**. Están todos triados en
**`04-PENDIENTES.md`** — ése es el punto de partida del próximo chat.

Los 3 más urgentes (ALTA):
1. **rechazar aprobación puede fallar con P2003** si el inquilino del BORRADOR
   tiene `CodigoOtp`/`AnuncioAcuse`/`Documento` (el `deleteMany` de la v5 choca
   con FKs RESTRICT). → regresión del fix v5.
2. **Comprobante adjunto del checkout nunca se sube al backend** en prod (éxito
   falso). → bug viejo, alto impacto.
3. **Link de invitación de co-inquilino reusable** (token sin uso único).

## Cómo seguir

1. Leer `04-PENDIENTES.md` y aplicar los fixes (con la disciplina de
   `03-AUDITORIAS.md`: verificar cada uno contra el código real antes de tocar).
2. Deployar siguiendo `02-DEPLOY.md` (Railway, `migrate deploy`, smoke test).
3. Re-correr el prompt `AUDITORIA-PROFUNDA-PROMPT.md` (raíz del repo) para validar
   que no se introdujo nada nuevo.

## Mapa de archivos de este handoff

| Archivo | Contenido |
|---|---|
| `00-ESTADO.md` | Este resumen ejecutivo |
| `01-ARQUITECTURA.md` | Stack, estructura, multi-tenant, money model, convenciones |
| `02-DEPLOY.md` | Railway, migraciones, cómo chequear prod, smoke test, reglas duras |
| `03-AUDITORIAS.md` | Historia de las 6 pasadas + metodología + el prompt reutilizable |
| `04-PENDIENTES.md` | **Los ~15 hallazgos sin aplicar + long-tail diferido** |
| `05-DECISIONES.md` | Decisiones de negocio del dueño + reglas duras |
| `../AUDITORIA-PROFUNDA-PROMPT.md` | El prompt reutilizable de auditoría |
