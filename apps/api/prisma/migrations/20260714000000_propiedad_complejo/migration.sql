-- Nombre libre de complejo/edificio para agrupar propiedades (feedback 14/07).
-- Aditivo y nullable → no rompe filas existentes. IF NOT EXISTS: DB dev tuvo
-- aplicaciones out-of-band.
ALTER TABLE "propiedades" ADD COLUMN IF NOT EXISTS "complejo" TEXT;
CREATE INDEX IF NOT EXISTS "propiedades_inmobiliariaId_complejo_idx" ON "propiedades"("inmobiliariaId", "complejo");
