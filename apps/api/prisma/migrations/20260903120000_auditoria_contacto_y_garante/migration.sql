-- T-11 · Traza de las dos ediciones que Camila pidió por nombre.
--
-- `PATCH /contratos/:id/inquilino-contacto` y el CRUD de garantes eran los únicos endpoints de
-- edición de contrato que no escribían autor en ningún lado. El email del inquilino es su
-- credencial (el OTP viaja ahí) y el garante se borra DURO: sin evento no quedaba ni quién lo
-- sacó ni qué decía la póliza.
--
-- IF NOT EXISTS porque el deploy puede reintentar; ADD VALUE es aditivo y no reescribe filas.
--
-- LOS NOMBRES COINCIDEN CON LOS DE LA OTRA RAMA A PROPÓSITO. Esta tarea se estaba haciendo
-- en paralelo en otra sesión, con `GARANTIA_EDITADA` / `GARANTIA_ELIMINADA` /
-- `INQUILINO_CONTACTO_EDITADO`. Se adoptaron esos nombres para que, si entran las dos, el
-- enum no termine con ocho valores para cuatro acciones: los tres compartidos quedan en
-- no-op y sólo se agrega `GARANTIA_AGREGADA`, que la otra rama no tiene.
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'INQUILINO_CONTACTO_EDITADO';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'GARANTIA_AGREGADA';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'GARANTIA_EDITADA';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'GARANTIA_ELIMINADA';
