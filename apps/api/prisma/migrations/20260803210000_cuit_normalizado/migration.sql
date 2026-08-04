-- El CUIT de los propietarios convivía en dos formatos en la MISMA columna:
-- "20301234567" (11 dígitos pelados, como lo carga el wizard de propiedad, que
-- strippea en el onChange) y "20-30123456-7" (con guiones, como lo cargaba el
-- alta desde /propietarios). El buscador filtraba con un `includes` crudo, así
-- que buscar "20-30" no encontraba al primero y la inmobiliaria concluía que el
-- propietario "no se había guardado".
--
-- A partir de ahora el server normaliza a dígitos en POST y PUT /propietarios
-- (ver normalizarCuit en core.ts). Esto deja consistente lo YA cargado.
--
-- Sólo saca caracteres no numéricos: no valida, no completa y no borra. Una fila
-- con el CUIT vacío (la cartera importada carga '') queda vacía igual.
UPDATE "propietarios"
SET "cuit" = regexp_replace("cuit", '[^0-9]', '', 'g')
WHERE "cuit" <> regexp_replace("cuit", '[^0-9]', '', 'g');
