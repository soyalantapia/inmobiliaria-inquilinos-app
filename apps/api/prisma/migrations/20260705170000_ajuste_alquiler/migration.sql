-- CreateTable: historial de ajustes del alquiler (manual-asistido).
CREATE TABLE "ajustes_alquiler" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "montoAnterior" DECIMAL(14,2) NOT NULL,
    "montoNuevo" DECIMAL(14,2) NOT NULL,
    "periodoDesde" TEXT NOT NULL,
    "motivo" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_alquiler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ajustes_alquiler_inmobiliariaId_idx" ON "ajustes_alquiler"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "ajustes_alquiler_contratoId_idx" ON "ajustes_alquiler"("contratoId");

-- AddForeignKey
ALTER TABLE "ajustes_alquiler" ADD CONSTRAINT "ajustes_alquiler_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_alquiler" ADD CONSTRAINT "ajustes_alquiler_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
