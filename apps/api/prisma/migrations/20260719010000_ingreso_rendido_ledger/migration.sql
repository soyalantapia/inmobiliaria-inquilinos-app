-- Ledger de ingresos extra rendidos (espejo de gastos_rendidos, pero suman).
-- Necesario para el reparto multi-dueño de INGRESO_EXTRA: cada parte rendida
-- queda registrada y el movimiento se marca descontado solo cuando las partes
-- cubren el total. IF NOT EXISTS por si la DB dev tuvo aplicaciones out-of-band.
CREATE TABLE IF NOT EXISTS "ingresos_rendidos" (
  "id" TEXT NOT NULL,
  "inmobiliariaId" TEXT NOT NULL,
  "rendicionId" TEXT NOT NULL,
  "refId" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL,
  "descripcion" TEXT NOT NULL,
  "monto" DECIMAL(14,2) NOT NULL,
  "montoTotal" DECIMAL(14,2) NOT NULL,
  "participacion" DOUBLE PRECISION NOT NULL,
  "propiedadId" TEXT NOT NULL,
  "direccion" TEXT NOT NULL,
  CONSTRAINT "ingresos_rendidos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ingresos_rendidos_inmobiliariaId_idx" ON "ingresos_rendidos"("inmobiliariaId");
CREATE INDEX IF NOT EXISTS "ingresos_rendidos_rendicionId_idx" ON "ingresos_rendidos"("rendicionId");
CREATE INDEX IF NOT EXISTS "ingresos_rendidos_refId_idx" ON "ingresos_rendidos"("refId");

DO $$ BEGIN
  ALTER TABLE "ingresos_rendidos"
    ADD CONSTRAINT "ingresos_rendidos_rendicionId_fkey"
    FOREIGN KEY ("rendicionId") REFERENCES "rendiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
