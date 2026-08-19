-- T-23-N4 · Baja lógica del propietario.
--
-- Hasta ahora `requirePropietario` sólo comprobaba que la fila (id, inmobiliariaId)
-- existiera: no había NADA que mirar para cortarle el acceso a alguien. La única
-- forma de revocarle la sesión a un propietario era BORRAR su fila — que tiene
-- rendiciones, participaciones y contratos colgando, o sea que en la práctica no
-- se podía. Y su token del portal dura 7 días, sin logout server-side ni denylist.
--
-- El portal expone plata de terceros: nombre del inquilino, su morosidad de los
-- últimos 6 períodos, el desglose de la rendición y los reclamos con el texto que
-- escribió el inquilino. Que eso no tenga forma de cortarse es el agujero.
--
-- Misma convención que `Sociedad.activa` ("baja lógica") y `Usuario.activo`.
--
-- DEFAULT true + NOT NULL: las filas existentes quedan activas, así que aplicar
-- esto no le saca el acceso a nadie.
--
-- ⚠ ORDEN: esta migración va ANTES del deploy del código, no después. El código
-- nuevo lee `activo` en el guard del portal; contra una base sin la columna,
-- Prisma falla y el portal responde 500. En este repo las migraciones se aplican
-- A MANO (no hay railway.json ni Procfile que corra `prisma migrate deploy`), así
-- que el orden es responsabilidad de quien deploya. Se eligió a propósito que
-- falle ruidosamente en vez de degradar en silencio: un guard que se saltea el
-- chequeo porque la columna no está es peor que uno que se cae.

ALTER TABLE "propietarios"
  ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;
