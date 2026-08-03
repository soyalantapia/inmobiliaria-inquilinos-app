-- "¿Se permiten mascotas?" pasa de ser un atributo del CONTRATO a serlo de la
-- PROPIEDAD: es del inmueble, no de cada contrato que se firma sobre él. Antes
-- había que responderlo de nuevo en cada contrato nuevo de la misma propiedad,
-- y si cambiaba había que editar el contrato en vez de la propiedad.
--
-- Aditiva y nullable → no toca ninguna fila existente por sí sola (null = no
-- especificado). La columna vieja "contratos.mascotasPermitidas" NO se toca:
-- queda deprecada (ver comentario en schema.prisma) porque con migrate-on-boot
-- un DROP COLUMN no se revierte con un git revert, y ahí hay datos reales.
ALTER TABLE "propiedades" ADD COLUMN IF NOT EXISTS "mascotasPermitidas" BOOLEAN;

-- Backfill: no perder lo que ya estaba cargado a nivel contrato. Una propiedad
-- puede tener varios contratos históricos, así que la prioridad es:
--   1) el contrato ACTUAL de la propiedad (contratoActualId), si tiene el
--      campo cargado (no null);
--   2) si no, el contrato más reciente (por fechaInicio, desempate por
--      createdAt) que tenga el campo cargado, sin importar si es el actual.
-- Las propiedades sin ningún contrato con el dato cargado quedan en NULL (no
-- especificado) — mismo significado que tenían antes de esta migración.

-- 1) Contrato actual.
UPDATE "propiedades" p
SET "mascotasPermitidas" = c."mascotasPermitidas"
FROM "contratos" c
WHERE c.id = p."contratoActualId"
  AND c."mascotasPermitidas" IS NOT NULL;

-- 2) Fallback al contrato histórico más reciente con el dato cargado, sólo
-- para las propiedades que el paso 1 dejó sin valor.
UPDATE "propiedades" p
SET "mascotasPermitidas" = sub."mascotasPermitidas"
FROM (
  SELECT DISTINCT ON (c."propiedadId")
    c."propiedadId",
    c."mascotasPermitidas"
  FROM "contratos" c
  WHERE c."mascotasPermitidas" IS NOT NULL
  ORDER BY c."propiedadId", c."fechaInicio" DESC, c."createdAt" DESC
) sub
WHERE sub."propiedadId" = p.id
  AND p."mascotasPermitidas" IS NULL;
