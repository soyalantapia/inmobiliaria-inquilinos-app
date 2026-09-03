-- T-11 · Traza de las dos ediciones que Camila pidió por nombre.
--
-- `PATCH /contratos/:id/inquilino-contacto` y el CRUD de garantes eran los únicos endpoints de
-- edición de contrato que no escribían autor en ningún lado. El email del inquilino es su
-- credencial (el OTP viaja ahí) y el garante se borra DURO: sin evento no quedaba ni quién lo
-- sacó ni qué decía la póliza.
--
-- IF NOT EXISTS porque el deploy puede reintentar; ADD VALUE es aditivo y no reescribe filas.
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'INQUILINO_CONTACTO_CAMBIADO';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'GARANTE_AGREGADO';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'GARANTE_EDITADO';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'GARANTE_ELIMINADO';
