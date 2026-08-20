# T-28-N1 · Cerrar la cobertura de plata que T-28 dejó afuera

- tomada: 2026-08-20T12:10Z
- worktree: ../myalquiler-T-28-N1
- rama: `feat/T-28-N1-tests-plata`
- base: `origin/main` (9a6fc6d)
- fase: TERMINADA

## Por qué existe esta tarea

T-28 se cerró "parcial" con este motivo escrito en su `estado.md`:

> Los 5 endpoints que lista T-28 necesitan tests de INTEGRACIÓN, y en este entorno no se
> pueden correr: **pegan a la Postgres de producción** y seedBase hace reset/seed.

**Esa premisa es falsa**, y es la misma que yo propagué a ~10 archivos y ya corregí en otro
lado. `docs/TESTING.md` dice lo contrario: prod corre dentro de Railway con host interno
(`*.railway.internal`), **inalcanzable** desde una máquina de trabajo. Y desde el 19/08 existe
`docker-compose.test.yml`: una Postgres local, efímera, en tmpfs, que no comparte nadie.

O sea que el bloqueo por el que se abandonó la cobertura **no existía**.

## Lo que se hizo

**1. Se verificó que la base de test efímera funciona.** Era lo que `docs/TESTING.md` pedía
explícitamente ("NO SE PUDO VERIFICAR EN ESTA MÁQUINA: el daemon de Docker no estaba
corriendo. La primera persona que lo corra, que confirme o corrija acá"). Confirmado: levanta,
las **57 migraciones aplican desde cero**, y el suite corre.

**2. Se corrió el suite COMPLETO por primera vez en meses.** 94 archivos, 786 tests, 22
minutos, contra base real: **780 pasan**, 5 fallan, 1 skip. Antes de esto nadie sabía si los
~60 archivos de integración del repo estaban en verde o en rojo.

**3. Se encontró y arregló un bug de plata VIVO en producción** (lo de abajo).

**4. `apps/api/test/descobrar-cargo.test.ts`** — 5 tests de integración sobre
`POST /cargos/:id/descobrar`, uno de los 5 endpoints que T-28 listaba sin cobertura.

## El bug: `descobrar` dejaba la plata en la caja

`saldar` registra un `MovimientoCaja` de tipo `INGRESO_EXTRA` cuando se marca un cargo como
cobrado. **`descobrar` limpiaba `saldadoAt` y no lo tocaba.**

Lo que lo volvía caro es que el comentario que justificaba esa asimetría —*"la rendición al
propietario filtra `tipo: 'GASTO'`, así que un INGRESO_EXTRA no le altera la liquidación al
dueño"*— **fue cierto y dejó de serlo**: hoy la rendición levanta explícitamente
`tipo: 'INGRESO_EXTRA'` con `descontadoEnRendicion: false` y **se lo acredita al propietario**.
Alguien sumó los ingresos a la rendición después y nadie volvió a mirar ese razonamiento.

Entonces:

- **Cobrado → Deshacer**: el inquilino vuelve a deber la plata **y** al dueño se le acredita
  igual. Las dos mitades se contradicen.
- **Cobrado → Deshacer → Cobrado**: **dos** `INGRESO_EXTRA` por una sola cobranza, los dos
  rendibles. Una reparación de $180.000 se le rinde dos veces.

No es hipotético: el botón *Deshacer* está a un click de *Cobrado*, y el corte anti-doble-cobro
de `imputarCostoReclamo` **manda al operador a ese camino** cuando quiere reimputar un reclamo
cuyo cargo ya se cobró.

### El fix

En `descobrar`: buscar el `INGRESO_EXTRA` que dejó `saldar` y borrarlo en la misma transacción
que limpia `saldadoAt`. Si esa plata **ya se le rindió** al propietario → **409**, sin tocar
nada: borrar el movimiento dejaría a la rendición apuntando (por `IngresoRendido.refId`) a una
fila inexistente, y el neto rendido no se podría reconstruir.

Se miran **las dos** señales de rendido: `descontadoEnRendicion` y el ledger `IngresoRendido`.
En multi-dueño la marca recién se pone cuando las partes cubren el total, así que un movimiento
rendido **a medias** la tiene en `false` y sólo lo delata el ledger.

**El 409 no necesita cambios de front:** `cargos-contrato-card.tsx` ya envuelve `descobrar` en
try/catch y muestra `e.message` en un toast, y `apiFetch` propaga el `message` del server tal
cual. Verificado — es justo el patrón que T-40 y T-43 tuvieron que arreglar dos veces.

### Verificación por mutación (lo que hace que estos tests valgan)

Con el fix revertido y **base limpia**, 4 de los 5 tests se ponen en rojo. El quinto
("descobrar un cargo que nunca se cobró") pasa en los dos casos, que es correcto: no ejercita
el bug. Sin esta comprobación los tests no probarían nada.

> Nota de método: la primera versión limpiaba **al final** de cada test. Un test que falla
> nunca llega a su limpieza, así que la primera corrida en rojo envenenó a las siguientes y los
> casos empezaron a fallar por residuo. La limpieza va en `beforeEach`. Quedó escrito en el
> archivo para que no se repita.

## Limitación conocida, y por qué no la cerré

**`MovimientoCaja` no tiene `cargoId`.** El único vínculo con el cargo es el TEXTO de la
descripción, así que el fix reconstruye la misma cadena que escribe `saldar` y acota por
contrato + tipo + monto + moneda, borrando uno solo.

Es correcto en el caso normal, pero **dos cargos con el mismo concepto, mismo monto y misma
moneda en el mismo contrato son indistinguibles**. El arreglo de fondo es una FK `cargoId` en
`MovimientoCaja` — y eso es cambio de schema, que **CLAUDE.md §0 obliga a consultar**. Queda
anotado como T-28-N1-N1, no lo tomé por mi cuenta.

## Migraciones

Ninguna.

## Tests

- `apps/api/test/descobrar-cargo.test.ts` — 5 nuevos, verdes, verificados por mutación.
- Alrededor, en verde con el cambio: `plata.test.ts` (29), `imputar-reclamo-ya-cobrado.test.ts`
  (6), `saldar-deuda-concurrencia.test.ts` (1).
- Suite puro: 42 archivos / 403 tests. `tsc --noEmit` en 0.

## Tareas nuevas detectadas

- **T-28-N1-N1** (BE + DATA, 🟡): `MovimientoCaja` sin `cargoId`. Ver arriba. Necesita
  migración → decisión del dueño.
- **T-28-N1-N2** (BE, 🟠): `multi-alquiler.test.ts` falla **en base limpia** — no es
  contaminación de estado. Ver la ficha en `09-TAREAS-REUNION-CAMILA.md`.
- **T-28-N1-N3** (QA, 🟡): quedan 3 de los 5 endpoints de T-28 sin cobertura
  (`/caja/cierre`, `/internal/cron/devengar`, `/mis-cargos`). Ahora **sí se pueden testear**:
  el bloqueo era falso. El mapa de invariantes de los tres ya está hecho.
