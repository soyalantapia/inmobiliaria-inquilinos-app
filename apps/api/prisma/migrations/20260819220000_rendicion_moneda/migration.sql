-- Rendicion gana la MONEDA en la que se rindió.
--
-- POR QUÉ: `POST /rendiciones` ya sabe la moneda —la calcula en `monedaRendicion`, rechaza con
-- 409 si el propietario tiene cobros en varias, y la usa para los gastos, los ingresos y los
-- movimientos de caja— pero NO la guardaba en la fila. Aguas abajo nadie podía saberla, y el
-- portal del propietario formateaba TODO como pesos: una rendición en dólares se le mostraba
-- al dueño como "$ 237.960" en vez de "US$ 237.960".
--
-- Es la misma enfermedad que ya se corrigió una vez en el cierre de caja ("dejar de sumar
-- dólares como si fueran pesos"): plata mostrada sin su unidad.
--
-- BACKFILL, no default ciego. Poner ARS en todas las filas viejas sería inventar el dato para
-- las que fueron en dólares. La moneda real es derivable: cada rendición tiene sus
-- `alquileres_rendidos`, y cada uno apunta a una liquidación que SÍ tiene moneda. Se toma la de
-- sus liquidaciones; las que no tengan alquileres imputados (rendiciones sólo de gastos o
-- ingresos) quedan en el default ARS, que es lo único que se puede afirmar.
--
-- SEGURA: agrega una columna con default, y un UPDATE que sólo corrige lo que puede derivar.
-- No borra nada. Compatible con el código viejo, que ignora la columna.
--
-- ORDEN DE DEPLOY: aplicar ANTES de subir el backend. Al revés, el código nuevo escribiría
-- `moneda` en una columna que no existe y fallaría toda rendición.

ALTER TABLE "rendiciones" ADD COLUMN IF NOT EXISTS "moneda" "Moneda" NOT NULL DEFAULT 'ARS';

UPDATE "rendiciones" r
SET "moneda" = sub.moneda::"Moneda"
FROM (
  SELECT ar."rendicionId" AS rid, MIN(l."moneda"::text) AS moneda
  FROM "alquileres_rendidos" ar
  JOIN "liquidaciones" l ON l.id = ar."liquidacionId"
  GROUP BY ar."rendicionId"
  HAVING COUNT(DISTINCT l."moneda") = 1
) AS sub(rid, moneda)
WHERE r.id = sub.rid AND sub.moneda <> 'ARS';
