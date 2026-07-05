-- CreateEnum
CREATE TYPE "TipoCargo" AS ENUM ('PENALIDAD_RESCISION', 'DANOS', 'OTRO');

-- AlterTable: defaults de rescision por inmobiliaria (aditivo con default).
ALTER TABLE "inmobiliarias" ADD COLUMN     "preavisoRescisionMesesDefault" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "penalidadRescisionMesesDefault" DOUBLE PRECISION NOT NULL DEFAULT 1.5;

-- AlterTable: datos de rescision del contrato.
ALTER TABLE "contratos" ADD COLUMN     "fechaEfectivaRescision" TIMESTAMP(3),
ADD COLUMN     "motivoRescision" TEXT,
ADD COLUMN     "penalidadRescisionMeses" DOUBLE PRECISION;

-- CreateTable: cargos one-off del contrato (penalidad/danos/otro).
CREATE TABLE "cargos_contrato" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tipo" "TipoCargo" NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargos_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cargos_contrato_inmobiliariaId_idx" ON "cargos_contrato"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "cargos_contrato_contratoId_idx" ON "cargos_contrato"("contratoId");

-- AddForeignKey
ALTER TABLE "cargos_contrato" ADD CONSTRAINT "cargos_contrato_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos_contrato" ADD CONSTRAINT "cargos_contrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
