-- Auditoría: cambiar el interés por mora de un contrato es un cambio de
-- configuración financiera → queda registrado en el timeline.
ALTER TYPE "TipoEventoAuditoria" ADD VALUE 'MORA_EDITADA';
