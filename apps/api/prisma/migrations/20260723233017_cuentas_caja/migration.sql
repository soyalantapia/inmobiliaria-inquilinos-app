-- Cuentas de caja (pedido de Camila): cuentas que la inmobiliaria define y nombra
-- ("Gaspar Mercado Pago", "efectivo", "Líder"…), cada una con una dirección permitida
-- (solo entrada / solo salida / ambas). Cada movimiento de caja se asocia a una.

-- CreateEnum
CREATE TYPE "DireccionCuenta" AS ENUM ('ENTRADA', 'SALIDA', 'AMBAS');

-- CreateTable
CREATE TABLE "cuentas_caja" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" "DireccionCuenta" NOT NULL DEFAULT 'AMBAS',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cuentas_caja_inmobiliariaId_idx" ON "cuentas_caja"("inmobiliariaId");

-- AlterTable: cada movimiento sale de / entra a una cuenta (nullable: los viejos no la tienen)
ALTER TABLE "movimientos_caja" ADD COLUMN     "cuentaId" TEXT;

-- CreateIndex
CREATE INDEX "movimientos_caja_cuentaId_idx" ON "movimientos_caja"("cuentaId");

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_caja" ADD CONSTRAINT "cuentas_caja_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
