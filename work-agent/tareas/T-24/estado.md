# T-24 — Cargar morosos históricos sin inventar contratos

- tomada: 2026-08-19
- worktree: `../myalquiler-T-24`
- rama: `feat/T-24-morosos-historicos` (base: `feat/reunion-camila-0308`, **no** `main`)
- estado: **terminada (parcial declarado)** — código commiteado, **merge PENDIENTE**

## Commits

- `67850f3` backend — `POST /contratos/historico` + 8 tests puros
- `7a78c8b` panel — diálogo "Deuda de inquilino anterior" en la ficha de la propiedad
- `4128d28` docs — en `feat/reunion-camila-0308` directo (09-TAREAS): resolución + T-24-N1/N2

## Verificación

- `tsc` api: **0**
- `tsc` panel: **0** (vía `next build`, que además compiló OK)
- tests puros: **103/103** en 13 archivos (los 8 nuevos incluidos)
- los 8 nuevos verificados **en rojo**: con el tope de períodos roto, un contrato de 2024
  devengaba 32 cuotas hasta hoy en vez de 3
- NO se corrieron los tests que tocan DB (pegan a la Postgres de producción)
- NO se aplicó ninguna migración (esta tarea no necesitó ninguna)

## Merge pendiente — por qué

`git merge` abortó: el repo principal tiene **18 archivos modificados sin commitear** de otra
tarea en curso (reclamos, renovaciones, propietarios), y dos de ellos son los mismos que toca
T-24 (`core.ts`, `propiedades/[id]/page-client.tsx`).

Stashear o commitear trabajo ajeno para meter el propio no se hace. La rama queda lista y el
merge se hace cuando ese chat cierre lo suyo:

    git merge --no-ff feat/T-24-morosos-historicos

Se espera conflicto en los dos archivos compartidos. Ambos son agregados en zonas distintas
(endpoint nuevo al final de un bloque en `core.ts`; botón + estado en el header de la propiedad),
así que debería resolverse quedándose con los dos lados.
