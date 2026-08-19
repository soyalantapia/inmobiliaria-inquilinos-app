# T-15 · Que el inquilino vea lo que le falta pagar — TERMINADA
- rama: feat/reunion-camila-0308 · commit: 1ffb4bc · fase: 8

## Hecho
`lib/saldo-liquidacion.ts` como fuente única. Home y detalle del pago lo usan.
El detalle era el roto: medía parcialidad con montoPagado (sólo CONCILIADO), así que un
pago informado sin validar mostraba el total entero.

## Pendiente de esta misma tarea
Recibos (/comprobantes) NO se migró al helper: no llegué a verificar si su cuenta
coincide. Si diverge, es la tercera verdad. Vale una pasada corta.

## No verificado
Navegador, camino real: las dos ramas tocadas sólo corren con apiEnabled=true.
El cambio es demostrablemente inerte en demo (el detalle sigue en saldoPendiente y el
home no entra al bloque de pagoVivo porque los mocks no traen liq.pagos).

## Tarea nueva: T-32
apps/inquilino y apps/inmobiliaria NO tienen runner de tests. `saldoDeLiquidacion` es
pura y se testea sola, pero no hay dónde correrla. Montar vitest en los dos fronts
desbloquea el testeo de TODA la lógica de front — hoy imposible. Es infra, roza T-28.
