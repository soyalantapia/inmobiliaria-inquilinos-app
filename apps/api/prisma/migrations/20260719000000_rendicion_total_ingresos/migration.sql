-- Ingresos extra de caja (INGRESO_EXTRA) rendidos al propietario. Antes la
-- rendición solo restaba GASTOS y NUNCA sumaba los ingresos → la plata que
-- entraba a la caja de la propiedad quedaba sin rendir al dueño. Columna
-- aditiva con default 0 → no rompe filas existentes. IF NOT EXISTS por si la
-- DB dev tuvo aplicaciones out-of-band.
ALTER TABLE "rendiciones" ADD COLUMN IF NOT EXISTS "totalIngresos" DECIMAL(14,2) NOT NULL DEFAULT 0;
