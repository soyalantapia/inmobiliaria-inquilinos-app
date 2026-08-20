-- T-21-N1 · ¿Hay datos ya ensuciados en producción?
--
-- SOLO LECTURA. No modifica nada. Correr con `railway connect` y pegar.
--
-- POR QUÉ HACE FALTA: el arreglo del devengo es **para adelante**. Si algún contrato de
-- SOLO_EXPENSAS ya quedó con un canon positivo —lo permitía el alta, y lo escribían el ajuste
-- (incluido el masivo) y la renovación— sus liquidaciones YA devengadas siguen teniendo
-- alquiler cobrado de más. Eso no se arregla solo: hay que verlo primero y recién después
-- decidir si se corrige y cómo.
--
-- Si las tres consultas devuelven 0 filas, no hay nada que limpiar y el fix alcanza.
--
-- OJO CON LAS COMILLAS: en este schema sólo las TABLAS tienen @@map (snake_case); las
-- COLUMNAS quedaron en camelCase, así que van entre comillas dobles sí o sí.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Contratos de solo expensas con canon sucio (monto > 0).
--    Es la causa raíz. Cada fila acá es un contrato que iba a facturar alquiler
--    en el próximo devengo del cron.
-- ────────────────────────────────────────────────────────────────────────────
SELECT c.id,
       c."inmobiliariaId",
       c.estado,
       c.monto           AS canon_sucio,
       c."montoExpensas" AS expensas,
       c."fechaInicio",
       c."fechaFin"
FROM contratos c
WHERE c."tipoContrato" = 'SOLO_EXPENSAS'
  AND c.monto > 0
ORDER BY c.monto DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Liquidaciones YA devengadas con alquiler, de contratos de solo expensas.
--    Es el daño concreto: plata facturada de más. `cobrado` dice si además ya
--    se cobró — ahí no alcanza con corregir la liquidación: hay que devolver o
--    imputar a cuenta.
-- ────────────────────────────────────────────────────────────────────────────
SELECT l.id,
       l."contratoId",
       l.periodo,
       l.estado,
       l."montoAlquiler" AS alquiler_de_mas,
       l."montoExpensas",
       l."montoTotal",
       COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'CONCILIADO'), 0) AS cobrado
FROM liquidaciones l
JOIN contratos c ON c.id = l."contratoId"
LEFT JOIN pagos p ON p."liquidacionId" = l.id
WHERE c."tipoContrato" = 'SOLO_EXPENSAS'
  AND l."montoAlquiler" > 0
GROUP BY l.id, l."contratoId", l.periodo, l.estado,
         l."montoAlquiler", l."montoExpensas", l."montoTotal"
ORDER BY l.periodo DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) El rastro: cómo se ensució. Ajustes y renovaciones aplicados sobre
--    contratos de solo expensas. Si aparecen varios con el mismo motivo, fue el
--    ajuste masivo, que los barría a todos.
-- ────────────────────────────────────────────────────────────────────────────
SELECT 'ajuste' AS origen, a.id, a."contratoId", a."montoAnterior", a."montoNuevo",
       a."periodoDesde" AS periodo, a.motivo, a."createdAt"
FROM ajustes_alquiler a
JOIN contratos c ON c.id = a."contratoId"
WHERE c."tipoContrato" = 'SOLO_EXPENSAS'
UNION ALL
SELECT 'renovacion', r.id, r."contratoId", r."montoAnterior", r."montoNuevo",
       r."montoDesde", r.motivo, r."createdAt"
FROM renovaciones_contrato r
JOIN contratos c ON c.id = r."contratoId"
WHERE c."tipoContrato" = 'SOLO_EXPENSAS'
ORDER BY "createdAt" DESC;
