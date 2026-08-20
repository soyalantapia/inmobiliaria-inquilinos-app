# T-30 · DB de test separada de producción
- tomada: 2026-08-19T13:45:48Z
- worktree: ../myalquiler-T-30
- rama: feat/T-30-guard-seed-produccion
- fase: 1
- HALLAZGO: la premisa de la tarea era FALSA. Ya existe una DB de test separada
  (proxy publico rlwy.net); prod es host interno inalcanzable (docs/TESTING.md:25).
  El riesgo real es otro: seedBase NO tiene guard anti-prod, y limpiar-test-db.ts si.
- fase: 8 — TERMINADA (con la premisa corregida)
- commit: 1198c53
- rama: feat/T-30-guard-seed-produccion (worktree ../myalquiler-T-30)

## La premisa de la tarea era falsa
YA existe una DB de test separada: prod = host interno *.railway.internal
(inalcanzable desde afuera), tests = proxy publico *.proxy.rlwy.net.
docs/TESTING.md lo dice. No habia nada que montar.

## Lo que SI estaba roto, y nadie habia visto
seedBase (destructivo, corre en el beforeAll de ~50 suites) NO tenia ningun guard.
Con la DATABASE_URL de prod exportada, `vitest run` le escribia a la base del
cliente. El unico guard del repo estaba en limpiar-test-db.ts.
Ahora el criterio esta en prisma/guard-db.ts, lo usan los dos, y falla cerrado.

## Verificado
- 10 tests puros del guard + verificado que se ponen en rojo al aflojarlo.
- End-to-end: seedBase con DATABASE_URL de prod y con URL vacia => corta.
- 105 tests puros en verde. tsc 0.

## Impacto en otras tareas
DESBLOQUEA la parte de T-28 que se habia recortado: los tests de integracion de
/caja/cierre, /internal/cron/devengar, /cargos/:id/descobrar,
/contratos/:id/cargos y /mis-cargos SI se pueden escribir y correr, apuntando al
proxy. Conviene reabrir T-28 con ese alcance.

## Migraciones
Ninguna.

## COLISION DE NUMERACION (19/08)
Este lock se llamaba T-30. Otro chat escribio un T-30 DISTINTO en el documento
("el mail sale de un no-reply"). Renombrado a T-32-guard-seed para liberar el
numero, porque mientras el lock existiera el T-30 del documento era irreclamable.
La rama sigue llamandose feat/T-30-guard-seed-produccion (ya commiteada).
