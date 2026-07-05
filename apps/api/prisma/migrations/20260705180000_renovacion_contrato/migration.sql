-- CreateTable: historial de renovaciones del contrato.
CREATE TABLE "renovaciones_contrato" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "fechaFinAnterior" TIMESTAMP(3) NOT NULL,
    "fechaFinNueva" TIMESTAMP(3) NOT NULL,
    "montoAnterior" DECIMAL(14,2) NOT NULL,
    "montoNuevo" DECIMAL(14,2) NOT NULL,
    "montoDesde" TEXT NOT NULL,
    "motivo" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renovaciones_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "renovaciones_contrato_inmobiliariaId_idx" ON "renovaciones_contrato"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "renovaciones_contrato_contratoId_idx" ON "renovaciones_contrato"("contratoId");

-- AddForeignKey
ALTER TABLE "renovaciones_contrato" ADD CONSTRAINT "renovaciones_contrato_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovaciones_contrato" ADD CONSTRAINT "renovaciones_contrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
