# T-28-N2 — Correr, por primera vez, los 94 archivos de test del API

- tomada: 2026-08-20
- worktree: `../myalquiler-T-28-N2`
- rama: `test/T-28-N2-correr-los-52`
- estado: **terminada** — la suite pasa entera
- commits: `b302a60` (el fix), `a8485fa` (T-28-N3), + este

## Qué se hizo

T-28-N1 dejó armada una Postgres efímera local (`docker-compose.test.yml`, tmpfs, puerto 55432,
que no comparte nadie). Lo que faltaba era lo obvio: **correrla**. Hasta hoy sólo se ejecutaban
**45 de 97** archivos —los que no tocan base—; los otros **52 nunca habían corrido**, incluidos
los de plata (T-28) y el de aislamiento de tenant del portal (T-23-N1).

Se levantó Docker, se aplicaron las 13 migraciones sobre una base vacía y se corrió todo.

## El resultado

**810 tests, todos en verde.** Con una falla real, encontrada y arreglada.

| corrida | duración | resultado |
|---|---|---|
| 1ª | 881 s | 809/810 · **1 falla real** |
| 2ª (base limpia, con otra suite en paralelo) | 5433 s | 3 suites caídas — **todas de entorno** |

### La falla real: `multi-alquiler.test.ts` (arreglada en `b302a60`)

No fallaba su lógica: fallaba el `afterAll`, y tenía **dos capas**.

1. Borraba los contratos que crea, pero desde **T-29** el alta escribe una fila en
   `eventos_contrato` por cada uno. Ningún FK de `Contrato` cascadea ⇒
   `eventos_contrato_contratoId_fkey`. **El test no cambió: cambió lo que el alta hace.**
2. Al tapar eso, murió seis líneas más adelante con `contratos_propiedadId_fkey`, porque
   `contratoIds` salía **sólo de los inquilinos** — cualquier contrato de esas propiedades que
   no matcheara por esa vía quedaba sin borrar, incluido el residuo de la corrida anterior que
   murió a mitad del borrado. Ahora los contratos se deducen de los dos lados y se unen.

### Las tres de la segunda vuelta: entorno, no código

`expediente-permisos`, `link-magico-vigencia` y `propietario-cimiento`. Una murió con
`Hook timed out in 420000ms` y `Can't reach database server at localhost:55432`.

Se verificó en vez de suponerlo: el contenedor quedó **Up (healthy)**, sin OOM y con
`restarts=0`; la corrida fue **6× más lenta** que la primera (otro chat corriendo su propia
suite); y **los tres pasan en aislamiento: 16/16 en 46 s**. Quedó escrito en `docs/TESTING.md`,
con la regla práctica: ante una falla rara de infra, correr el archivo solo antes de debuggear.

## De paso, confirmado para T-01

**Las trece migraciones pendientes se aplicaron limpias sobre una base vacía, dos veces**
(`All migrations have been successfully applied`). La auditoría de T-01-N2 decía que ninguna
podía fallar; ahora está probado corriéndolas, no leyéndolas.

## Lo que quedó abierto

- **T-28-N3** — 22 modelos cuelgan de `Contrato` y ninguno cascadea. El fix de arriba tapa el
  agujero puntual; la clase de bug sigue viva y explota lejos de su causa.
- **1 test salteado**: `backfill-mascotas-propiedad`, que necesita `psql` en el PATH y un
  Postgres donde crear bases. No está en esta máquina. Su salteo **imprime el motivo**, así que
  no es mudo. Se evaluó destrabarlo con un shim vía `docker exec` y se descartó: apunta a otro
  puerto (55433) y habría que reescribirle los argumentos — máquinaria con sus propios modos de
  falla por un solo test.
