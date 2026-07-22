-- Condonación de deuda: cancela el saldo del inquilino pero NO es un ingreso de la
-- inmobiliaria. Antes "condonar" creaba un Pago CONCILIADO idéntico a un cobro real, así
-- que entraba al cierre de caja del día (con comisión) y se le rendía al propietario plata
-- que nunca existió. Con esta marca, los dos caminos de INGRESO la excluyen; el cálculo de
-- saldo/deuda la sigue contando (la deuda efectivamente se canceló).
--
-- Aditiva con default → no rompe filas existentes. IF NOT EXISTS por si alguna DB de dev
-- tuvo aplicaciones out-of-band.
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "condonado" BOOLEAN NOT NULL DEFAULT false;
