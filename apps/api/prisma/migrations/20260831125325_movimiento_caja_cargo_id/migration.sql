-- AlterTable
ALTER TABLE "movimientos_caja" ADD COLUMN     "cargoId" TEXT;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
