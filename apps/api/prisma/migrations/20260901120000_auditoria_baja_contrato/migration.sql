-- Dar de baja un contrato es de lo más irreversible que hace la app: libera la propiedad,
-- anula las cuotas futuras, puede crear la penalidad de rescisión y puede resolver el
-- depósito de garantía. No dejaba UN SOLO rastro de quién lo hizo ni cuándo — mientras que
-- cambiar el email de un propietario sí lo deja (PROPIETARIO_CUENTA_CAMBIADA).
--
-- IF NOT EXISTS porque el deploy puede reintentar; ADD VALUE es aditivo y no reescribe filas.
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'CONTRATO_DADO_DE_BAJA';
