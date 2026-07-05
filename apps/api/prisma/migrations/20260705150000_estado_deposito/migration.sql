-- CreateEnum
CREATE TYPE "EstadoDeposito" AS ENUM ('RETENIDO', 'DEVUELTO', 'NETEADO', 'EJECUTADO');

-- AlterTable: estado del depósito de garantía en custodia (default RETENIDO para los existentes).
ALTER TABLE "contratos" ADD COLUMN     "estadoDeposito" "EstadoDeposito" NOT NULL DEFAULT 'RETENIDO',
ADD COLUMN     "depositoDevueltoMonto" DECIMAL(14,2),
ADD COLUMN     "depositoDevueltoAt" TIMESTAMP(3);
