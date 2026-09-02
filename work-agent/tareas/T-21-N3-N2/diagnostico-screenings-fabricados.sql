-- ¿Se llegaron a fabricar informes crediticios sobre personas reales? (T-21-N3-N2)
--
-- SOLO LECTURA. No modifica nada. Correr con `railway connect` y pegar.
--
-- POR QUÉ: hasta este arreglo, `POST /screening` no consultaba ninguna fuente. El informe
-- entero —score, deudas BCRA, cheques rechazados, familia, domicilio, empleador, patrimonio—
-- salía de un PRNG sembrado con los dígitos del CUIT, y se persistía con `estado = 'COMPLETO'`
-- sobre una persona real identificada por CUIT y nombre.
--
-- Toda fila en esta tabla es, por construcción, **un informe inventado sobre una persona con
-- nombre y apellido**. No hay forma de distinguir "buenas" de "malas": no hay ninguna real.
--
-- Si devuelve 0 filas, no llegó a usarse y no hay nada que resolver.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Cuántos hay y de qué inmobiliarias.
-- ────────────────────────────────────────────────────────────────────────────
SELECT s."inmobiliariaId",
       i."nombre" AS inmobiliaria,
       count(*)   AS informes,
       min(s."createdAt") AS el_primero,
       max(s."createdAt") AS el_ultimo
FROM "screenings" s
JOIN "inmobiliarias" i ON i."id" = s."inmobiliariaId"
GROUP BY s."inmobiliariaId", i."nombre"
ORDER BY count(*) DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) SOBRE QUIÉNES. Esto es lo que importa: son personas reales, y sobre cada
--    una hay guardado un score y una recomendación que nadie calculó.
--    `convertido_en_contrato` dice si además se usó para decidir un alquiler.
-- ────────────────────────────────────────────────────────────────────────────
SELECT s."id",
       s."createdAt",
       s."inmobiliariaId",
       s."cuit",
       s."nombre" || ' ' || s."apellido" AS persona,
       s."estado",
       s."scoreNosis"     AS score_inventado,
       s."recomendacion"  AS recomendacion_inventada,
       s."contratoId" IS NOT NULL AS convertido_en_contrato
FROM "screenings" s
ORDER BY s."createdAt" DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) El caso grave: informes que terminaron ligados a un contrato, o sea que
--    muy probablemente se usaron para decidir a quién alquilarle.
-- ────────────────────────────────────────────────────────────────────────────
SELECT s."id",
       s."cuit",
       s."nombre" || ' ' || s."apellido" AS persona,
       s."recomendacion"                 AS recomendacion_inventada,
       s."contratoId",
       c."estado"                        AS estado_del_contrato,
       c."fechaInicio"
FROM "screenings" s
JOIN "contratos" c ON c."id" = s."contratoId"
ORDER BY s."createdAt" DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUÉ HACER CON LO QUE APAREZCA — no lo decide una consulta
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Son datos personales inventados sobre gente identificable, así que la opción por defecto
-- es **borrarlos**:
--
--   DELETE FROM "screenings";   -- ⚠️ NO CORRER SIN LEER LO DE ABAJO
--
-- Antes de eso hay dos cosas que mirar, y las dos son decisión del dueño:
--
-- 1. Si la consulta 3 devolvió filas, esos informes ya influyeron en una decisión de alquiler.
--    Borrarlos elimina la evidencia de que eso pasó. Puede convenir exportarlos primero.
-- 2. `Screening.contratoId` tiene FK: borrar la fila no borra el contrato, pero conviene
--    confirmarlo en el plan antes de ejecutar.
--
-- Nada de esto es urgente en el sentido de "se sigue rompiendo": con el 501 ya no se fabrica
-- ninguno nuevo. Lo que queda es qué se hace con lo que ya está.
