-- Mora dinámica: esquemas configurables por inmobiliaria con override por
-- contrato y override manual por período (migración de contratos en curso).
-- Cascada: Contrato.moraTipo → legacy tasaPunitorioDiaria → default Inmobiliaria.

-- CreateEnum
CREATE TYPE "TipoMora" AS ENUM ('SIN_MORA', 'PORCENTAJE_DIARIO', 'MONTO_FIJO', 'PORCENTAJE_MENSUAL');

-- AlterTable: default del tenant (config de Cobranza)
ALTER TABLE "inmobiliarias" ADD COLUMN "moraTipoDefault" "TipoMora" NOT NULL DEFAULT 'SIN_MORA';
ALTER TABLE "inmobiliarias" ADD COLUMN "moraValorDefault" DOUBLE PRECISION;

-- AlterTable: override por contrato
ALTER TABLE "contratos" ADD COLUMN "moraTipo" "TipoMora";
ALTER TABLE "contratos" ADD COLUMN "moraValor" DOUBLE PRECISION;

-- AlterTable: mora histórica congelada por período (alta de contrato en curso)
ALTER TABLE "liquidaciones" ADD COLUMN "montoPunitorioManual" DECIMAL(14,2);

-- Backfill: los contratos que ya cobraban con la tasa legacy pasan al esquema
-- explícito equivalente (mismo número, mismo cálculo) — compat total.
UPDATE "contratos"
SET "moraTipo" = 'PORCENTAJE_DIARIO', "moraValor" = "tasaPunitorioDiaria"
WHERE "tasaPunitorioDiaria" IS NOT NULL AND "tasaPunitorioDiaria" > 0;
