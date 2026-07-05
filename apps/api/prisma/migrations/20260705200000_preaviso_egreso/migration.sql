-- Preaviso de egreso: cuándo se va el inquilino que avisó que no renueva.
ALTER TABLE "intenciones_renovacion" ADD COLUMN "fechaEgreso" TIMESTAMP(3);
