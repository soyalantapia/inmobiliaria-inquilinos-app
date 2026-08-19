-- ¿Se le acreditó a algún propietario más de lo que entró? (addendum de T-23-N3-N2)
--
-- SOLO LECTURA. No modifica nada. Correr con `railway connect` y pegar.
--
-- POR QUÉ: hasta el commit 704f37f, el descuento de INGRESOS EXTRA de la rendición tenía sólo
-- el tope POR DUEÑO y le faltaba el tope GLOBAL que sí tenían los gastos de caja y los
-- reclamos. Con las participaciones re-armadas entre una rendición y otra, el mismo ingreso
-- podía acreditarse dos veces:
--
--   ingreso de $100 en una propiedad de A(50%) y B(50%)
--   → A rinde: se le acreditan $50   (ledger 50, movimiento sigue abierto)
--   → se re-arma la participación, B pasa a 100%
--   → B rinde: se le acreditan $100  (su cap por dueño es 100, y no había tope global)
--   = $150 acreditados sobre $100 que entraron
--
-- Y como 50+100 >= 100, el movimiento quedó marcado como cubierto: el caso se cerró solo y no
-- vuelve a aparecer por ningún lado. Por eso hace falta buscarlo a mano.
--
-- El arreglo es para adelante. Esta consulta dice si YA pasó, y por cuánto.
--
-- Si devuelve 0 filas, no hay nada que reparar.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Ingresos extra acreditados por MÁS que su monto real.
--    `de_mas` es la plata que la inmobiliaria pagó y nunca cobró.
-- ────────────────────────────────────────────────────────────────────────────
SELECT m."id"                        AS movimiento_id,
       m."inmobiliariaId",
       m."propiedadId",
       m."fecha",
       m."descripcion",
       m."monto"                     AS entro_de_verdad,
       SUM(i."monto")                AS se_acredito,
       SUM(i."monto") - m."monto"    AS de_mas,
       count(*)                      AS veces_rendido
FROM "movimientos_caja" m
JOIN "ingresos_rendidos" i ON i."refId" = m."id"
WHERE m."tipo" = 'INGRESO_EXTRA'
GROUP BY m."id", m."inmobiliariaId", m."propiedadId", m."fecha", m."descripcion", m."monto"
-- el 0.01 es tolerancia de redondeo: la parte de cada dueño se redondea a centavos
HAVING SUM(i."monto") - m."monto" > 0.01
ORDER BY (SUM(i."monto") - m."monto") DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) El detalle de los casos de arriba: a QUIÉN se le acreditó cada parte.
--    Es lo que hace falta para decidir a quién se le descuenta la diferencia.
-- ────────────────────────────────────────────────────────────────────────────
SELECT i."refId"          AS movimiento_id,
       r."propietarioId",
       p."nombre" || ' ' || p."apellido" AS propietario,
       r."periodo",
       i."participacion" AS pct_en_ese_momento,
       i."monto"         AS se_le_acredito,
       i."montoTotal"    AS monto_del_ingreso,
       r."rendidoAt"
FROM "ingresos_rendidos" i
JOIN "rendiciones" r  ON r."id" = i."rendicionId"
JOIN "propietarios" p ON p."id" = r."propietarioId"
WHERE i."refId" IN (
  SELECT m."id"
  FROM "movimientos_caja" m
  JOIN "ingresos_rendidos" x ON x."refId" = m."id"
  WHERE m."tipo" = 'INGRESO_EXTRA'
  GROUP BY m."id", m."monto"
  HAVING SUM(x."monto") - m."monto" > 0.01
)
ORDER BY i."refId", r."rendidoAt";

-- ────────────────────────────────────────────────────────────────────────────
-- 3) El espejo, por las dudas: ingresos que quedaron marcados como cubiertos
--    pero que en realidad se acreditaron de MENOS. Acá el perjudicado es el
--    PROPIETARIO — es plata suya que nunca se le rindió.
-- ────────────────────────────────────────────────────────────────────────────
SELECT m."id"                     AS movimiento_id,
       m."inmobiliariaId",
       m."descripcion",
       m."monto"                  AS entro_de_verdad,
       COALESCE(SUM(i."monto"), 0) AS se_acredito,
       m."monto" - COALESCE(SUM(i."monto"), 0) AS falta_acreditar
FROM "movimientos_caja" m
LEFT JOIN "ingresos_rendidos" i ON i."refId" = m."id"
WHERE m."tipo" = 'INGRESO_EXTRA'
  AND m."descontadoEnRendicion" = true
GROUP BY m."id", m."inmobiliariaId", m."descripcion", m."monto"
HAVING m."monto" - COALESCE(SUM(i."monto"), 0) > 0.01
ORDER BY (m."monto" - COALESCE(SUM(i."monto"), 0)) DESC;

-- ⚠️ Las columnas van entre comillas dobles porque en este schema sólo las TABLAS tienen
-- @@map (snake_case); las COLUMNAS quedaron en camelCase.
