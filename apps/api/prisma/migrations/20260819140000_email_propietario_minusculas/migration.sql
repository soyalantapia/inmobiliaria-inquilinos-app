-- Normalizar a minúsculas el email de los propietarios ya cargados (T-23-N2).
--
-- POR QUÉ: desde T-23 ese campo es la CREDENCIAL del portal del propietario. El login busca
-- `where email = <lo tipeado>.toLowerCase()` y Postgres compara distinguiendo mayúsculas, así
-- que todo propietario cargado con alguna mayúscula —"Juan.Perez@Gmail.com"— no matchea nunca:
-- pide el código, el endpoint responde `ok` (no revela si el email existe, a propósito) y el
-- código no llega jamás. Un fallo mudo, que del otro lado se ve como "el portal no anda".
--
-- El código nuevo ya guarda normalizado (`normalizarEmail` en core.ts), pero eso sólo arregla
-- lo que se cargue de acá en adelante. Esta migración arregla lo que YA está.
--
-- SEGURA: es un UPDATE idempotente sobre una sola columna, acotado a las filas que realmente
-- cambian. No toca ninguna otra tabla. El email en minúsculas sigue sirviendo igual para
-- mandar mails: el estándar exige que el dominio sea case-insensitive y en la práctica ningún
-- proveedor real distingue mayúsculas en la parte local.
--
-- NO ES REVERSIBLE en el sentido estricto: se pierde cómo estaba escrito originalmente. Es
-- deliberado — esa capitalización no significaba nada y estaba rompiendo el login.
--
-- ⚠️ MIRAR ANTES DE CORRER (solo lectura), para saber a cuántos afecta y si el cambio deja
-- duplicados dentro de una misma inmobiliaria:
--
--   SELECT id, "inmobiliariaId", email FROM propietarios WHERE email <> lower(trim(email));
--
--   SELECT "inmobiliariaId", lower(trim(email)) AS email, count(*)
--   FROM propietarios WHERE trim(email) <> ''
--   GROUP BY 1, 2 HAVING count(*) > 1;
--
-- Si la segunda devuelve filas, NO es un bloqueante: dos propietarios de la misma inmobiliaria
-- pueden compartir email legítimamente (un matrimonio, el contador de varios dueños). Sólo hay
-- que saberlo, porque esas personas van a ver más de una cartera al entrar y el selector las
-- distingue por nombre.
--
-- SIN APLICAR. La corre el dueño.

UPDATE "propietarios"
SET "email" = lower(trim("email"))
WHERE "email" <> lower(trim("email"));
