-- Auditoría: borrar un movimiento financiero de un consorcio es borrar plata →
-- queda registrado en el timeline (igual que GASTO_CAJA_ELIMINADO en la caja).
ALTER TYPE "TipoEventoAuditoria" ADD VALUE 'MOVIMIENTO_CONSORCIO_ELIMINADO';
