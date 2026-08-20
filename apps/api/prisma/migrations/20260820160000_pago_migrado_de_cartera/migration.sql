-- La plata registrada al cargar un contrato EN CURSO no es un cobro de la inmobiliaria.
--
-- El wizard de alta escribe hasta 120 períodos pasados como pagados, con un Pago sintético
-- CONCILIADO, para que el saldo del inquilino arranque en el número correcto. Esa plata la
-- cobró la inmobiliaria antes de usar el sistema y ya se la liquidó al propietario por fuera.
-- Sin distinguirla, `POST /rendiciones` la considera rendible —le puede transferir al dueño
-- plata que ya tiene— y `GET /portal/pendiente` se la reclama como "cobrado y todavía sin
-- rendirte", en un número que no llega a cero por ningún camino.
--
-- ADITIVA Y REVERSIBLE: agrega una columna con default false. Ninguna fila cambia de
-- significado salvo las que el backfill marca, y esas se identifican por la observación
-- EXACTA que escribe `estado-inicial-contrato.ts` (NOTA_MIGRACION), no por un LIKE.
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "migradoDeCartera" BOOLEAN NOT NULL DEFAULT false;

UPDATE "pagos"
   SET "migradoDeCartera" = true
 WHERE "observacion" = 'Migración: registrado al cargar el contrato en curso'
   AND "estado" = 'CONCILIADO';
