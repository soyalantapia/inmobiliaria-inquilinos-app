# T-24-N1 — Importar morosos históricos desde Excel

- tomada: 2026-08-19
- worktree: `../myalquiler-T-24-N1`
- rama: `feat/T-24-N1-importar-morosos` (base: `feat/T-24-morosos-historicos`)
- estado: **terminada** — código commiteado, **merge PENDIENTE** (igual que T-24)

## Commits

| | |
|---|---|
| `8f74b0a` | backend — 3 endpoints + `lib/importacion-morosos.ts` + `lib/contrato-historico.ts` (extraído) |
| `079d918` | panel — diálogo de 4 pasos en `/inquilinos` |
| `ff978ec` | **fix** — cuatro agujeros en el camino de la plata, encontrados revisando |
| `6909733` | sugerir la dirección parecida cuando la planilla no matchea |

## Verificación

- `tsc` api: **0** · `tsc` panel: **0** (y `next build` compila)
- tests puros: **158/158** en 14 archivos (**55 nuevos** en `importacion-morosos.test.ts`)
- mutaciones verificadas en rojo: el orden AR de la fecha, el guard de ventana cerrada, el
  dedup, y el guard de altura de la sugerencia de dirección
- NO se corrieron los tests que tocan DB (pegan a la Postgres de producción)
- NO hubo migraciones: el diseño stateless se eligió, en parte, para no necesitarlas

## Lo que encontró la revisión (todo corregido en `ff978ec`)

1. **Re-subir la planilla duplicaba toda la deuda.** Es el camino normal de recuperación —de 50
   entran 40, se corrigen 10 y se vuelve a subir el archivo entero— así que era cuestión de
   tiempo. `@@unique([contratoId, periodo])` no salva: cada import crea un contrato nuevo.
2. **Expensas negativas** restaban del alquiler. `"(30.000)"` también (negativo contable), y
   `"1.500 - 2.000"` se parsea como **-15.002.000**.
3. **Texto en la celda de expensas** daba null en silencio: la deuda quedaba subestimada.
4. **`"US$"` y `"U$D"` caían a PESOS.** Error de dos órdenes de magnitud.
5. **Fechas serializadas con `toISOString()`**: `xlsx` arma los Date en hora local, así que en un
   server al este de UTC el día 1 retrocedía al mes anterior. Railway corre en UTC, no muerde
   hoy, pero es una mina.

Los cuatro primeros salieron de un test scratch que dejó un subagente de la revisión adversarial
en el worktree (`zz-scratch-aritmetica.test.ts`, ya borrado). El quinto salió de probarlo a mano.

## Merge pendiente — misma razón que T-24

El repo principal seguía con **18 archivos sin commitear de otra tarea**, dos de ellos
compartidos (`core.ts`, `propiedades/[id]/page-client.tsx`). Cuando ese chat cierre:

    git merge --no-ff feat/T-24-morosos-historicos
    git merge --no-ff feat/T-24-N1-importar-morosos

En ese orden: N1 sale de la rama de T-24 y la contiene.

## Lo que el role play de Camila dejó abierto (tareas nuevas, no bloquean)

- **T-24-N3 · Deshacer una importación de morosos.** Si se equivoca, hoy no hay forma de revertir
  el lote: habría que borrar contrato por contrato, y no hay endpoint para borrar un FINALIZADO.
- **T-24-N4 · Plantilla descargable de la planilla.** El paso 1 explica las columnas en texto y el
  mapeo es flexible, así que no bloquea. Pero un `.xlsx` de ejemplo saca la duda de entrada. La
  importación de cartera tampoco lo tiene: sirve para las dos.

## Bug preexistente que NO se tocó

`propietarioCache` (`importaciones-cartera.ts:198`/`:398`): un `Map` compartido entre filas que se
llena **dentro** de la transacción de la fila. Si esa transacción hace rollback, el propietario
desaparece pero el id queda cacheado → las filas siguientes fallan por FK. Es de la importación
de cartera. Merece tarea propia.


> ⚠️ **Corrección (19/08).** Donde este documento dice que los tests "pegan a la Postgres de
> producción", es **falso**: `docs/TESTING.md` dice lo contrario — *"Esta NO es la DB de prod.
> Prod corre dentro de Railway con el host interno, inalcanzable desde tu máquina. El proxy
> público es la instancia de test/dev."* Fue una lectura al revés de la fuente citada, repetida
> de chat en chat. **La conclusión no cambia** (no se corren igual), pero por el motivo real: es
> una instancia **compartida** que el seed borra de forma destructiva, y en esta máquina no
> existe `apps/api/.env`, así que `DATABASE_URL` ni siquiera está seteada.