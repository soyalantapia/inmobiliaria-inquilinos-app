-- Reglas de convivencia por propiedad (texto libre, visible al inquilino) y
-- flag de mascotas permitidas por contrato. Ambos aditivos y nullable → no
-- rompen filas existentes ni requieren backfill. IF NOT EXISTS: la DB dev tuvo
-- aplicaciones out-of-band; esto la hace segura de re-aplicar.
ALTER TABLE "propiedades" ADD COLUMN IF NOT EXISTS "reglasConvivencia" TEXT;
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "mascotasPermitidas" BOOLEAN;
