-- #19: una sola sociedad PRINCIPAL activa por inmobiliaria. Índice ÚNICO PARCIAL
-- (solo esPrincipal=true AND activa=true) → cierra la carrera de dos creates
-- concurrentes que vean "no hay principal" y creen ambos esPrincipal=true.
-- Prisma no expresa índices parciales en el schema → SQL crudo acá.
-- Prod verificado SIN duplicados antes de aplicar (1 fila, 0 principal-activa dup).
CREATE UNIQUE INDEX "sociedades_principal_activa_key" ON "sociedades"("inmobiliariaId") WHERE "esPrincipal" = true AND activa = true;
