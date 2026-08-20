# T-19
- tomada: 2026-08-19T13:43:42Z
- worktree: ../myalquiler-T-19
- base: feat/reunion-camila-0308
- fase: 0
- fase: 8 — TERMINADA
- commit: 2f0dc36 · rama docs/T-19-pago-unificado (worktree ../myalquiler-T-19)

## Qué quedó hecho
work-agent/T-19-PRUEBA-PAGO-UNIFICADO.md — evidencia lista para mostrarle a Camila.
Verificado línea por línea: la cuota nace con montoTotal = alquiler + expensas
(liquidaciones.ts:96); el único camino de pago del inquilino es POST /pagos/informar
contra la liquidación (plata.ts:1129); los endpoints de consorcio son todos del panel
(requireUsuario), ninguno cobra al inquilino; /boletas no es un pago.
El inquilino ve desglose + UN "Total a pagar" ((app)/page.tsx:702-718).

## Cero cambios de código
Es tarea de verificación. No había nada que arreglar: ya funciona como ella quiere.

## Qué NO se verificó
La prueba en vivo (alta ALQUILER_Y_EXPENSAS → devengo → pago). Exige crear datos en
el tenant real, prohibido por la regla 4. Conviene hacerla con ella delante.

## Veredicto de Camila (fase 7)
"Bueno, mostrámelo." — el documento no le alcanza; necesita verlo en pantalla.
Por eso el paso pendiente es la demo en vivo, no más documentación.
