-- AlterTable: contratos → motivo de la resolución del depósito (caso "pelear la
-- garantía": por qué se neteó/ejecutó). Aditivo/nullable.
ALTER TABLE "contratos" ADD COLUMN "motivoDeposito" TEXT;
