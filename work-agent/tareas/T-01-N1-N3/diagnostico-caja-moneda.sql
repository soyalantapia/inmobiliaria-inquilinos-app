-- SOLO LECTURA. No modifica nada. Correr con el dueño.
--
-- PARA QUÉ: hasta el fix de T-01-N1-N3, cobrar un cargo del inquilino
-- (POST /cargos/:id/saldar) creaba el MovimientoCaja SIN pasar la moneda del cargo. Como la
-- columna es @default(ARS), esas filas quedaron escritas en pesos aunque el cargo fuera en
-- dólares — el monto correcto en la unidad equivocada.
--
-- No se puede arreglar a ciegas: una fila que dice ARS y debía decir USD es indistinguible de
-- una correcta MIRANDO SOLO LA FILA. Pero sí se puede encontrar cruzando con el cargo que la
-- originó, que es lo que hace esto.
--
-- El cruce es por descripción, porque el movimiento no guarda el id del cargo: se creaba con
-- 'Cobro de cargo al inquilino: ' || cargo.concepto. Es un cruce por texto y por eso puede
-- traer de más si dos cargos del mismo contrato tienen el mismo concepto; por eso esto es un
-- diagnóstico para mirar, no un UPDATE.

SELECT
  mc.id                AS movimiento_id,
  mc.fecha,
  mc.descripcion,
  mc.monto,
  mc.moneda            AS moneda_registrada,
  cc.moneda            AS moneda_del_cargo,
  cc.concepto,
  c.id                 AS contrato_id
FROM "movimientos_caja" mc
JOIN "contratos" c        ON c.id = mc."contratoId"
JOIN "cargos_contrato" cc ON cc."contratoId" = c.id
                         AND mc."descripcion" = 'Cobro de cargo al inquilino: ' || cc."concepto"
WHERE mc."tipo" = 'INGRESO_EXTRA'
  AND cc."moneda" <> mc."moneda"
ORDER BY mc.fecha DESC;

-- Si no devuelve filas: no hay nada que corregir, todos los cargos cobrados eran en pesos.
--
-- Si devuelve filas, para cada una hay que decidir a mano: el monto está bien, lo que está mal
-- es la unidad. Corregir la moneda del movimiento cambia el cierre de caja de ese día y puede
-- cambiar rendiciones ya emitidas — por eso no va un UPDATE automático acá.
