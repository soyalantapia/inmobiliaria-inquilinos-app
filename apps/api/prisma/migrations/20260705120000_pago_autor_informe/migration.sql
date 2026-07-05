-- Autor del informe de pago (co-inquilinos): quién de los miembros del contrato
-- informó cada pago. Nullable: los cobros manuales/bancarios nacen sin autor
-- inquilino. Sirve para atribuir en notificaciones y en "Pagos informados".
ALTER TABLE "pagos" ADD COLUMN "informadoPorInquilinoId" TEXT;
ALTER TABLE "pagos" ADD COLUMN "informadoPorCoInquilinoId" TEXT;
