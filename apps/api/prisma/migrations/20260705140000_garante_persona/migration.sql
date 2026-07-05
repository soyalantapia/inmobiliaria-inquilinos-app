-- Activar el modelo Garante para un garante PERSONA (además de póliza de caución).
-- La tabla estaba huérfana (0 filas: nunca tuvo write-path) → relajar NOT NULL es seguro.
ALTER TABLE "garantes" ADD COLUMN "dni" TEXT;
ALTER TABLE "garantes" ALTER COLUMN "montoCobertura" DROP NOT NULL;
ALTER TABLE "garantes" ALTER COLUMN "vigenciaHasta" DROP NOT NULL;
ALTER TABLE "garantes" ALTER COLUMN "contactoNombre" DROP NOT NULL;
