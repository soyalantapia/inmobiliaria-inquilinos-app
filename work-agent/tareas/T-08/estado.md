# T-08 · Encabezado fijo con la propiedad en el wizard de alta
- tomada: 2026-08-19T13:21:16Z
- worktree: ../myalquiler-T-08
- rama: feat/T-08-encabezado-propiedad-wizard
- base: feat/reunion-camila-0308 (NO main: el helper rotulo-propiedad.ts sólo existe ahí)
- fase: 6 (role play)
- fase: 8 — TERMINADA
- commit: bd7d1c2
- rama: feat/T-08-encabezado-propiedad-wizard (worktree ../myalquiler-T-08, sin borrar)

## Qué quedó hecho
Barra sticky con la propiedad, visible desde el paso 2 del wizard de producción.
Cumple los 6 criterios de aceptación por revisión estática.

## Qué NO se verificó
La barra renderizada. Sólo aparece con apiEnabled=true, lo que exige apuntar a la
API de producción y loguearse en el tenant real (prohibido por la regla 4). Sí se
verificó en navegador que el modo demo no se rompió (sin errores de consola).

## Migraciones
Ninguna. Es sólo presentación: no toca endpoints, queries ni payload.

## Veredicto de Camila (fase 7)
"Me sirve, pero me lo pusiste sólo en el alta. Cuando entro a un contrato ya
cargado o a un reclamo sigo viendo la calle." → es T-06, sin hacer.
"El botón Cambiar no me dice si pierdo lo cargado." → ver tarea nueva.

## Tareas nuevas detectadas
- T-29: el botón "Cambiar" del encabezado no aclara que no se pierde lo cargado.
