-- Seguro self-serve del profesional de la red: la inmo carga aseguradora/póliza/
-- vencimiento; "Asegurado" se computa on-read (polizaVence vigente). Aditivo/nullable.
ALTER TABLE "profesionales_red" ADD COLUMN "aseguradora" TEXT;
ALTER TABLE "profesionales_red" ADD COLUMN "nroPoliza" TEXT;
ALTER TABLE "profesionales_red" ADD COLUMN "polizaVence" TIMESTAMP(3);
