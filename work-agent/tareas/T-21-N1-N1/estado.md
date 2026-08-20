# T-21-N1-N1 — No hay forma de cambiar las expensas de un contrato ya cargado

- tomada: 2026-08-19
- worktree: `../myalquiler-T21N1N1`
- rama: `feat/T-21-N1-N1-editar-expensas` (base: `feat/reunion-camila-0308`)
- estado: **terminada** · merge pendiente
- commits: `cdb78d7` (feature) · `f21e573` (auto-revisión)

## Verificado

`grep montoExpensas apps/api/src/routes/` devuelve **una sola escritura**: `core.ts:1155`, el
alta. Ningún endpoint lo tocaba después. Confirmado.

## Qué se hizo

`PATCH /contratos/:id/expensas`, hermano de `/monto` y con su misma forma a propósito (es el
mismo gesto para el operador) + botón **"Cambiar expensas"** en el detalle del contrato.

`recomputarExpensasFuturas` es espejo de `recomputarLiquidacionesFuturas`, con **una diferencia
que importa**: acá se conserva el `montoAlquiler` de CADA cuota, que puede diferir entre meses si
hubo un ajuste con vigencia futura. Uniformarlos habría pisado ese ajuste.

Mismo criterio conservador, línea por línea: no toca meses pasados, ni PAGADO/PARCIAL, ni cuotas
con un pago informado en revisión.

## Dos decisiones

- **El `tipoContrato` acompaña al monto.** `computarLiquidacionesContrato` factura expensas
  mirando sólo `montoExpensas`, sin consultar el tipo: un ALQUILER con expensas > 0 las
  facturaría mientras la PWA le dice al inquilino que su contrato no las tiene. El diálogo avisa
  el cambio de tipo **antes** de confirmar.
- **El botón NO se gatea por tipo**, al revés que el de ajustar alquiler: un SOLO_EXPENSAS es
  justo el que más lo necesita, porque es su único monto.

## Verificación

- `tsc` api: **0** · `tsc` panel: **0** (y `next build` compila)
- tests puros: **116/116** en 14 archivos (10 nuevos)
- verificado **en rojo** sacando el guard de pago informado
- NO se corrieron tests de DB · NO hubo migraciones

## De la auto-revisión (commit `f21e573`)

1. El 409 del ajuste de canon sobre un SOLO_EXPENSAS **todavía decía** que las expensas "sólo se
   definen al cargar el contrato". Era verdad cuando se escribió — de hecho **ese mensaje es el
   origen de esta tarea**. Ahora la puerta existe, así que indica cuál abrir.
2. El early-return de "mismo monto" devolvía el subset del `select` y el camino normal el
   contrato completo. Dos formas distintas según el camino es como se rompe un front que usa la
   respuesta para refrescar.

## Nota sobre T-21-N2

Estaba marcada como pendiente pero **ya la había hecho otro chat** (commit `77babfe`, junto con
T-21-N1). Se verificó y se liberó el lock sin tocar nada.
