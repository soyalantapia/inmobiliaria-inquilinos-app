# T-28 · Tests de los flujos de plata sin cobertura
- tomada: 2026-08-19T13:38:28Z
- worktree: ../myalquiler-T-28
- rama: feat/T-28-tests-plata
- base: feat/reunion-camila-0308
- fase: 0
- fase: 8 — TERMINADA (parcial, con alcance recortado a propósito)
- commit: 55d5e49
- rama: feat/T-28-tests-plata (worktree ../myalquiler-T-28)

## Qué quedó hecho
15 tests puros de `calcularPendienteSinRendir` (extraído de alquilerCobradoSinRendir).
Verificado que se ponen en rojo al revertir el cap. 107 tests puros en verde, tsc 0.

## Qué NO se hizo, y por qué
Los 5 endpoints que lista T-28 (/caja/cierre, /internal/cron/devengar,
/cargos/:id/descobrar, /contratos/:id/cargos, /mis-cargos) necesitan tests de
INTEGRACIÓN, y en este entorno no se pueden correr: pegan a la Postgres de
producción y seedBase hace reset/seed (regla 3). Escribirlos sería entregar código
sin verificar, que es peor que no tenerlos.

DESBLOQUEO: hace falta una DB de test separada de producción. Eso es una tarea de
infra que T-28 daba por resuelta y no lo está. Ver T-30.

## Migraciones
Ninguna.

## Veredicto de Camila (fase 7)
No aplica directo: no toca ninguna superficie que ella use. Lo que sí le importa es
la consecuencia — el guard que la trabó el 03/08 ahora tiene su aritmética fijada,
así que si alguien la toca, salta.

## Tareas nuevas detectadas
- T-30 (OPS+DATA, 🔴): montar una DB de test separada de producción. Hoy bloquea
  toda cobertura de integración: 50 de los 64 tests del repo no se pueden correr
  sin riesgo, y por eso nadie los corre.
