-- Caja: la propiedad pasa a ser OPCIONAL y las cuentas ganan una PREDETERMINADA.
--
-- Por qué:
--   1) No toda la plata que pasa por la caja corresponde a una unidad. Camila carga
--      gastos de la oficina y compensaciones entre socios; hasta hoy tenía que elegir
--      una propiedad cualquiera, lo que ensuciaba la rendición de ese propietario.
--   2) La carga manual ahora EXIGE cuenta (validado en la API, no acá: la columna
--      sigue nullable a propósito). Pero el ingreso que el sistema crea solo al saldar
--      un cargo del inquilino no tiene a nadie que elija la cuenta. Sin una cuenta
--      predeterminada esa plata entra a la caja pero a ninguna cuenta, y los totales
--      por cuenta jamás cierran contra el total de la caja.
--
-- Aditiva y segura de correr sobre datos vivos: aflojar un NOT NULL no reescribe la
-- tabla ni puede fallar por datos existentes, y la columna nueva tiene DEFAULT false.

-- 1. La propiedad deja de ser obligatoria.
ALTER TABLE "movimientos_caja" ALTER COLUMN "propiedadId" DROP NOT NULL;

-- 2. Flag de cuenta predeterminada por inmobiliaria.
ALTER TABLE "cuentas_caja" ADD COLUMN "esPredeterminada" BOOLEAN NOT NULL DEFAULT false;

-- 3. Una sola predeterminada por inmobiliaria. Es un índice UNIQUE PARCIAL: Prisma no
--    sabe expresar el `WHERE`, así que va en SQL crudo y `migrate dev` va a reportar
--    drift en este índice para siempre (mismo caso que `pagos_liquidacionId_informado_key`).
--    Sin el `WHERE` un UNIQUE plano permitiría UNA sola cuenta por inmobiliaria en total.
CREATE UNIQUE INDEX "cuentas_caja_inmobiliariaId_predeterminada_key"
  ON "cuentas_caja" ("inmobiliariaId")
  WHERE "esPredeterminada" = true;

-- 4. Backfill: si una inmobiliaria tiene EXACTAMENTE UNA cuenta activa que acepta
--    entradas, esa pasa a ser la predeterminada. El movimiento automático es un
--    INGRESO, así que una cuenta de solo salida no sirve como predeterminada.
--    Con más de una candidata no elegimos por ella: lo decide desde la pantalla de
--    Cuentas. Idempotente y sin riesgo de violar el índice parcial (elige una sola).
UPDATE "cuentas_caja" c
SET "esPredeterminada" = true
WHERE c."activa" = true
  AND c."direccion" IN ('ENTRADA', 'AMBAS')
  AND (
    SELECT COUNT(*) FROM "cuentas_caja" o
    WHERE o."inmobiliariaId" = c."inmobiliariaId"
      AND o."activa" = true
      AND o."direccion" IN ('ENTRADA', 'AMBAS')
  ) = 1;
