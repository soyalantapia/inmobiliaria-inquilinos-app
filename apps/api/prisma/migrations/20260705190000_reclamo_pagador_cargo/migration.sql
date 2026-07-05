-- CreateEnum
CREATE TYPE "PagadorReclamo" AS ENUM ('PROPIETARIO', 'INQUILINO', 'DEPOSITO');

-- AlterEnum
ALTER TYPE "TipoCargo" ADD VALUE 'REPARACION';

-- AlterTable: reclamos → pagador (quién paga el costoTrabajo)
ALTER TABLE "reclamos" ADD COLUMN     "pagador" "PagadorReclamo";

-- AlterTable: cargos_contrato → link a reclamo (idempotente) + flag contraDeposito
ALTER TABLE "cargos_contrato" ADD COLUMN     "contraDeposito" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reclamoId" TEXT;

-- CreateIndex: 1 cargo por reclamo
CREATE UNIQUE INDEX "cargos_contrato_reclamoId_key" ON "cargos_contrato"("reclamoId");

-- AddForeignKey
ALTER TABLE "cargos_contrato" ADD CONSTRAINT "cargos_contrato_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
