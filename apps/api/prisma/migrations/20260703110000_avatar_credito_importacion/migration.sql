-- Bundle de 3 features de la auditoría "archivos/adjuntos": avatar del
-- inquilino, conciliación de créditos detectados (validador de resumen
-- bancario) y migración de cartera (importación masiva).

-- 1) Avatar del inquilino (mismo patrón que Usuario.imageUrl).
ALTER TABLE "inquilinos" ADD COLUMN "imageUrl" TEXT;

-- 2) CreditoDetectado: marca de conciliado + link 1:1 opcional al Pago creado.
ALTER TABLE "creditos_detectados" ADD COLUMN "conciliado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "creditos_detectados" ADD COLUMN "pagoId" TEXT;
CREATE UNIQUE INDEX "creditos_detectados_pagoId_key" ON "creditos_detectados"("pagoId");
ALTER TABLE "creditos_detectados"
  ADD CONSTRAINT "creditos_detectados_pagoId_fkey"
  FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Migración de cartera: importaciones_cartera.
CREATE TYPE "EstadoImportacion" AS ENUM ('SUBIDO', 'MAPEADO', 'CONFIRMADO');

CREATE TABLE "importaciones_cartera" (
  "id" TEXT NOT NULL,
  "inmobiliariaId" TEXT NOT NULL,
  "archivoUrl" TEXT NOT NULL,
  "nombreArchivo" TEXT NOT NULL,
  "columnas" JSONB NOT NULL,
  "filas" JSONB NOT NULL,
  "mapeoColumnas" JSONB,
  "totalFilas" INTEGER NOT NULL,
  "estado" "EstadoImportacion" NOT NULL DEFAULT 'SUBIDO',
  "resultado" JSONB,
  "creadoPor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "importaciones_cartera_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "importaciones_cartera_inmobiliariaId_idx" ON "importaciones_cartera"("inmobiliariaId");

ALTER TABLE "importaciones_cartera"
  ADD CONSTRAINT "importaciones_cartera_inmobiliariaId_fkey"
  FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
