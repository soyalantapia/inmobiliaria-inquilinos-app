-- A qué cuenta va la plata del dueño: el CBU/alias de su ficha, la cuenta de cobranza directa
-- que ve el inquilino, y el email que es su credencial del portal. Los tres se podían
-- reescribir sin dejar autor.
--
-- IF NOT EXISTS porque el deploy puede reintentar; ADD VALUE es aditivo y no reescribe filas.
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'PROPIETARIO_CUENTA_CAMBIADA';
