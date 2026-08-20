# T-20
- tomada: 2026-08-19T14:42:04Z
- base: feat/reunion-camila-0308
- fase: 0
- fase: 8 — TERMINADA (con hallazgo de plata)
- commit: cea770b · rama feat/T-20

## Qué se encontró
BUG DE PLATA, no una verificación: el devengo cobraba ALQUILER en contratos
SOLO_EXPENSAS. computarLiquidacionesContrato no miraba tipoContrato; el recálculo
tras un ajuste sí. Alcanzable desde el panel: ajustar el monto deja contrato.monto
positivo y el cron, 6h después, devenga con alquiler > 0. También inflaba la
comisión (sale de montoAlquiler).

## Qué se hizo
tipoContrato pasa a obligatorio en ContratoParaLiquidar (mismo patrón que
devengarDesde). Eso destapó que faltaba en LOS DOS barridos: cron global y botón
"Devengar" del panel. 4 tests puros, verificados en rojo revirtiendo el fix.

## El caso mixto de Camila: funciona
Dos unidades del mismo edificio con regímenes distintos conviven bien, porque el
tipo vive en el CONTRATO y no en el consorcio. Cubierto por test.

## Pendiente de decisión del owner
Un contrato SOLO_EXPENSAS genera comisión CERO y no se puede rendir
(montoBruto = 0 → RendicionSinCobros). Es coherente —las expensas van al
consorcio, no al dueño— pero deja abierto: ¿cómo cobra la inmobiliaria por
administrar esa unidad? Es la misma pregunta que T-21.
