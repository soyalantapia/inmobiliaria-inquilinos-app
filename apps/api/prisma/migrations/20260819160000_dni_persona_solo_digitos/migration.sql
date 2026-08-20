-- Normalizar a dígitos el DNI de las Personas ya cargadas (T-24-N2-N1).
--
-- POR QUÉ: `Persona.dni` es la llave con la que el sistema decide si dos contratos son de la
-- MISMA persona. Nadie lo normalizaba del lado que escribe, así que una planilla con
-- `20.123.456` dejó la ficha con los puntos: al tipear `20123456` no matchea ni el buscador ni
-- la dedup, y se crea una Persona duplicada. Son justo las fichas viejas —las que Camila quería
-- que el sistema reconociera— y desde T-24-N2 la ausencia del cartel "ya está en tu cartera" se
-- lee como "no está", que ahí es falso.
--
-- El código nuevo (`lib/normalizar-dni.ts`) arregla lo que se cargue de acá en adelante; esto
-- arregla lo que ya está.
--
-- ⚠️ LA TRAMPA: `@@unique([inmobiliariaId, dni])`. Si en una misma inmobiliaria conviven
-- `20.123.456` y `20123456` como dos Personas distintas, normalizar las vuelve idénticas y el
-- UPDATE revienta. Por eso el UPDATE de abajo **se saltea esos casos a propósito**: son dos
-- fichas que hay que FUSIONAR (decidir cuál queda, mover sus contratos), y eso no lo puede
-- decidir una migración — cada una tiene contratos, pagos e historial colgando.
--
-- ORDEN RESPECTO DEL DEPLOY: da igual. El código nuevo funciona con la base sin migrar (sólo
-- que las fichas viejas siguen sin matchear) y la base migrada funciona con el código viejo.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- MIRAR ANTES DE CORRER (las dos son de SOLO LECTURA)
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- 1) A cuántas fichas afecta:
--
--   SELECT count(*) FROM personas
--   WHERE dni IS NOT NULL AND dni <> regexp_replace(dni, '\D', '', 'g');
--
-- 2) LAS QUE ESTA MIGRACIÓN NO VA A TOCAR — los duplicados que hay que fusionar a mano.
--    Si devuelve filas, cada grupo son dos o más fichas de la MISMA persona cargadas distinto:
--
--   SELECT "inmobiliariaId",
--          regexp_replace(dni, '\D', '', 'g') AS dni_normalizado,
--          count(*)                            AS fichas,
--          array_agg(id)                       AS ids,
--          array_agg(dni)                      AS como_estan_hoy
--   FROM personas
--   WHERE dni IS NOT NULL AND regexp_replace(dni, '\D', '', 'g') <> ''
--   GROUP BY 1, 2
--   HAVING count(*) > 1;
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- SEGURA: un UPDATE idempotente sobre una sola columna, acotado a las filas que cambian y que
-- NO generan colisión. No toca ninguna otra tabla ni borra nada.
--
-- NO ES REVERSIBLE en sentido estricto: se pierde cómo estaba escrito el número. Es deliberado
-- —esos puntos y guiones no significan nada y estaban rompiendo la dedup— y el dato no se
-- pierde: sigue siendo el mismo documento.
--
-- SIN APLICAR. La corre el dueño.

UPDATE "personas" AS p
SET "dni" = regexp_replace(p."dni", '\D', '', 'g')
WHERE p."dni" IS NOT NULL
  -- sólo las que realmente cambian
  AND p."dni" <> regexp_replace(p."dni", '\D', '', 'g')
  -- y que al normalizar quede algo (una ficha con dni 'sin datos' quedaría en '' y chocaría
  -- contra cualquier otra igual: esas se dejan como están, ver la consulta 2)
  AND regexp_replace(p."dni", '\D', '', 'g') <> ''
  -- y que NO colisionen con otra ficha del mismo tenant que ya tenga ese número normalizado
  AND NOT EXISTS (
    SELECT 1 FROM "personas" AS otra
    WHERE otra."inmobiliariaId" = p."inmobiliariaId"
      AND otra."id" <> p."id"
      AND regexp_replace(COALESCE(otra."dni", ''), '\D', '', 'g') = regexp_replace(p."dni", '\D', '', 'g')
  );
