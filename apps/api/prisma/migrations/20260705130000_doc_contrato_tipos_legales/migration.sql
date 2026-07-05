-- Documentación legal habitual del rubro (req 4): tipos que antes caían en OTRO.
-- ALTER TYPE ADD VALUE es aditivo y seguro (no toca datos existentes).
ALTER TYPE "TipoDocContrato" ADD VALUE 'GARANTIA_PROPIETARIA';
ALTER TYPE "TipoDocContrato" ADD VALUE 'SEGURO_CAUCION';
ALTER TYPE "TipoDocContrato" ADD VALUE 'RECIBO_GARANTE';
ALTER TYPE "TipoDocContrato" ADD VALUE 'CONSTANCIA_LABORAL';
ALTER TYPE "TipoDocContrato" ADD VALUE 'CONSTANCIA_CUIT';
ALTER TYPE "TipoDocContrato" ADD VALUE 'INVENTARIO_INGRESO';
ALTER TYPE "TipoDocContrato" ADD VALUE 'SERVICIOS_A_NOMBRE';
ALTER TYPE "TipoDocContrato" ADD VALUE 'COMPROBANTE_DEPOSITO';
