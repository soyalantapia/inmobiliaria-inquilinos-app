-- AlterTable: cargos_contrato → saldado por la inmo (cobrado). Un cargo con
-- saldadoAt deja de ser deuda del inquilino (sale de /mis-cargos y del total).
-- Sólo aplica a los que NO son contraDeposito (esos se netean contra el depósito).
ALTER TABLE "cargos_contrato" ADD COLUMN     "saldadoAt" TIMESTAMP(3),
ADD COLUMN     "saldadoPorId" TEXT;
