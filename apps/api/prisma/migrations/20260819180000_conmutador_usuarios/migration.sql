-- Conmutador de usuarios del mostrador (T-25).
--
-- Sólo valores de enum para AUDITORÍA. Las tres columnas que el feature usa
-- (`pinHash`, `pinIntentosFallidos`, `pinBloqueadoHasta`) ya existen desde antes:
-- nunca se borraron cuando el PIN se sacó de las acciones de plata.
--
-- POR QUÉ IMPORTA LA AUDITORÍA acá y no es un extra: un PIN de 5 dígitos que se
-- tipea treinta veces por día en un mostrador con público del otro lado del vidrio
-- NO es un secreto fuerte, y el lockout no protege contra el que te miró teclear.
-- Lo que sí da el feature es trazabilidad: quién se cambió a quién, cuándo, y qué
-- intentos fueron rechazados. Sin estos valores, el conmutador sería una puerta sin
-- registro de quién pasó.
--
-- SEGURA: `ADD VALUE IF NOT EXISTS` es aditivo, no toca ninguna fila y es
-- compatible con el código viejo (que simplemente nunca los escribe). Re-correrla
-- no hace nada.
--
-- ⚠️ ORDEN CON EL DEPLOY: primero la migración, después el código. Postgres no deja
-- USAR un valor de enum en la misma transacción que lo crea, y además el código
-- nuevo escribe estos valores desde el minuto cero. Al revés, conmutar tiraría 500.
-- El Dockerfile ya lo garantiza: `pnpm db:deploy && exec node dist/index.js`.
--
-- SIN APLICAR. La corre el dueño (o el deploy).

ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'SESION_CONMUTADA';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'CONMUTACION_RECHAZADA';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'PIN_DESBLOQUEADO';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'PIN_ELIMINADO';
