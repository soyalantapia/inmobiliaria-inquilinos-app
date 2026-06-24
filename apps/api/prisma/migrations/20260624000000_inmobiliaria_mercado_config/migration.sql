-- Config "Mercado y país de operación" por inmobiliaria (tab Mercado de /configuracion).
-- El wizard de contratos usa indiceDefaultContrato y monedaDefault como defaults
-- de un contrato nuevo. Defaults = comportamiento histórico (AR / ARS / ICL).
ALTER TABLE "inmobiliarias" ADD COLUMN "paisCodigo" TEXT NOT NULL DEFAULT 'AR';
ALTER TABLE "inmobiliarias" ADD COLUMN "monedaDefault" TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE "inmobiliarias" ADD COLUMN "indiceDefaultContrato" TEXT NOT NULL DEFAULT 'ICL';
