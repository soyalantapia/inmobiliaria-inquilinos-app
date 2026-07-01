-- Rendición INCREMENTAL: se puede rendir un período a un propietario en varias
-- tandas (a medida que entran pagos parciales). Soltamos el unique por período y
-- agregamos la tabla que trackea cuánto alquiler ya se rindió de cada liquidación.

-- 1) Soltar el unique (propietarioId, periodo) y dejar un índice común en su lugar.
DROP INDEX IF EXISTS "rendiciones_propietarioId_periodo_key";
CREATE INDEX IF NOT EXISTS "rendiciones_propietarioId_periodo_idx" ON "rendiciones"("propietarioId", "periodo");

-- 2) Tabla de alquiler rendido por liquidación/rendición (análoga a gastos_rendidos).
CREATE TABLE "alquileres_rendidos" (
  "id" TEXT NOT NULL,
  "inmobiliariaId" TEXT NOT NULL,
  "rendicionId" TEXT NOT NULL,
  "liquidacionId" TEXT NOT NULL,
  "periodo" TEXT NOT NULL,
  "monto" DECIMAL(14,2) NOT NULL,
  "participacion" DOUBLE PRECISION NOT NULL,
  "propiedadId" TEXT NOT NULL,
  "direccion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alquileres_rendidos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alquileres_rendidos_inmobiliariaId_idx" ON "alquileres_rendidos"("inmobiliariaId");
CREATE INDEX "alquileres_rendidos_rendicionId_idx" ON "alquileres_rendidos"("rendicionId");
CREATE INDEX "alquileres_rendidos_liquidacionId_idx" ON "alquileres_rendidos"("liquidacionId");

ALTER TABLE "alquileres_rendidos"
  ADD CONSTRAINT "alquileres_rendidos_rendicionId_fkey"
  FOREIGN KEY ("rendicionId") REFERENCES "rendiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
