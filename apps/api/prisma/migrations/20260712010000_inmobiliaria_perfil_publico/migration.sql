-- Identidad y contacto público del perfil de la inmobiliaria (Mi inmobiliaria).
-- Aditivo, con DEFAULT '' → no rompe la fila existente ni requiere backfill.
-- IF NOT EXISTS: la DB dev tuvo aplicaciones out-of-band.
ALTER TABLE "inmobiliarias" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT NOT NULL DEFAULT '';
ALTER TABLE "inmobiliarias" ADD COLUMN IF NOT EXISTS "sitioWeb" TEXT NOT NULL DEFAULT '';
ALTER TABLE "inmobiliarias" ADD COLUMN IF NOT EXISTS "instagram" TEXT NOT NULL DEFAULT '';
ALTER TABLE "inmobiliarias" ADD COLUMN IF NOT EXISTS "facebook" TEXT NOT NULL DEFAULT '';
ALTER TABLE "inmobiliarias" ADD COLUMN IF NOT EXISTS "horariosAtencion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "inmobiliarias" ADD COLUMN IF NOT EXISTS "condicionIva" TEXT NOT NULL DEFAULT '';
ALTER TABLE "inmobiliarias" ADD COLUMN IF NOT EXISTS "iibb" TEXT NOT NULL DEFAULT '';
