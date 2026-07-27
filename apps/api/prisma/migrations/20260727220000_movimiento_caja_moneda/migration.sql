-- Moneda del movimiento de caja.
--
-- La rendición exige UNA sola moneda por rendición (la valida contra las liquidaciones),
-- pero los gastos e ingresos de caja no la llevaban: se sumaban/restaban del neto sin
-- mirar en qué moneda estaban. Un gasto de $80.000 (pesos) cargado a una propiedad con
-- contrato en dólares se descontaba como si fueran US$80.000.
--
-- Aditiva con default → las filas existentes quedan en ARS, que es la única moneda que la
-- UI de caja permite cargar hoy. IF NOT EXISTS por si alguna DB de dev la tuvo antes.
ALTER TABLE "movimientos_caja" ADD COLUMN IF NOT EXISTS "moneda" "Moneda" NOT NULL DEFAULT 'ARS';
