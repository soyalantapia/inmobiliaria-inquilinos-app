# T-29 · Eventos de contrato
- tomada: 2026-08-19T13:50:48Z
- worktree: ../myalquiler-T-29
- rama: feat/T-29-eventos-contrato
- fase: 1
- fase: 8 — TERMINADA
- commit: 9b9be06 · rama feat/T-29-eventos-contrato (worktree ../myalquiler-T-29)

## Hecho
4 hitos: CREADO (alta, incl. BORRADOR), PAGO_RECIBIDO (conciliacion, distingue
saldado de parcial), RECLAMO_CREADO (los DOS caminos: panel e inquilino),
RENOVACION (valor propio del enum, antes reusaba AJUSTE_APLICADO).
Helper unico lib/evento-contrato.ts que nunca tira.

## Dejado afuera a proposito
PAGO_VENCIDO: lo escribiria el barrido del cron (cada 6h) y sin clave de
idempotencia duplicaria el evento en cada corrida. Necesita diseno aparte.
COMUNICACION_ENVIADA y GARANTE_RENOVADO: no hay hecho que registrar todavia
(las comunicaciones no se persisten — es el fake que detecto 07-ECOSISTEMA).

## MIGRACION SIN APLICAR
apps/api/prisma/migrations/20260819120000_evento_contrato_renovacion/migration.sql
ALTER TYPE "TipoEventoContrato" ADD VALUE 'RENOVACION'. Aditiva, no toca filas.
VA ANTES de subir el backend: al reves, renovar un contrato falla con enum invalido.

## Verificado
tsc 0 en apps/api. 95 tests puros en verde. NO se probo en navegador: el Historial
sale de GET /contratos/:id/eventos (T-07) y requiere apiEnabled + datos reales.
