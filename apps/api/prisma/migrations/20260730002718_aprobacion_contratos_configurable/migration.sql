-- AlterTable
ALTER TABLE "contratos" ADD COLUMN     "periodosAnterioresPendientes" JSONB;

-- AlterTable
ALTER TABLE "inmobiliarias" ADD COLUMN     "contratosRequierenAprobacion" BOOLEAN NOT NULL DEFAULT false;
