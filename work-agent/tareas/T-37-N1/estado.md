# T-37-N1 · Circuito de aprobación para el pago manual — RELEVADA, NO SE CONSTRUYE

## El veredicto: no construirla, y no es por falta de tiempo

Tres razones independientes, cualquiera de ellas alcanza:

1. **Nadie la pidió.** El propio texto de la tarea lo dice: *"nadie lo pidió en la reunión. Es una
   feature, no el arreglo de una inconsistencia."* En la reunión del 03/08 Camila habló de
   cobranza, morosos, permisos, consorcio y rendición. No de un circuito de aprobación de pagos.
2. **Mete un estado nuevo en el flujo de plata.** Un pago que nace "pendiente de aprobación" es
   un estado más en el código mejor blindado del sistema, con el que tienen que lidiar el
   devengo, la conciliación, la rendición, el cierre de caja y la mora.
3. **T-04 lo bloquea.** *"Ninguna tarea puede tocar el flujo de pagos antes de que esta cierre."*

**Y sobre todo: hoy no hay ningún problema que resolver.** El caso que la motivaba —"que una
operadora pueda cobrar en efectivo sin darle rol CAJA"— ya tiene respuesta: **el rol CAJA existe
exactamente para eso**. Construir el circuito sería agregar una segunda forma de hacer lo mismo.

## Lo que se verificó (leído, no supuesto)

| Afirmación de la tarea | ¿Cierta? |
|---|---|
| `requiereAprobacion` no se llama desde `apps/api` | ✅ `permisos.ts:186` la define; el único caller es `contratoQuedaPendiente` (`:216`), para CONTRATOS |
| `POST /pagos/manual` exige `pago.conciliar` | ✅ `plata.ts:1184` |
| La matriz prometía un circuito inexistente | ✅ ya **corregido** por otro chat: `pago.manual.cargar` quedó en `['ADMIN','CAJA']`, alineado con la realidad |

O sea que la **inconsistencia visible ya está cerrada**: la pantalla de Equipo ya no le promete a
la administradora que un OPERADOR puede cobrar.

## Lo que SÍ apareció al revisar — una trampa latente

`POST /pagos/manual` chequea **`pago.conciliar`**, no `pago.manual.cargar`, que es la capacidad
que la matriz anuncia para esa acción (`plata.ts:1184` vs `permisos.ts:150`).

**Hoy no cambia nada**: las dos tienen exactamente los mismos roles, `['ADMIN','CAJA']`. Pero son
dos listas separadas que describen el mismo permiso, y el día que alguien toque una sola —por
ejemplo, para dejar que un tercer rol confirme pagos sin poder cargarlos a mano— van a divergir
**en silencio**, y el síntoma va a ser el mismo de antes: la pantalla de Equipo diciendo una cosa
y el endpoint haciendo otra.

**El arreglo es una línea** (`'pago.conciliar'` → `'pago.manual.cargar'`) y es un **no-op
funcional hoy**. No se hizo igual, porque es un guard del flujo de pagos y T-04 dice que no se
toca. Queda listo para el día que T-04 cierre.

## Qué necesita esta tarea para reabrirse

Que **vos** decidas que lo querés: que una operadora sin rol CAJA pueda registrar cobros en
efectivo con aprobación posterior. Si la respuesta es "que use rol CAJA", esta tarea se cierra
para siempre y conviene escribirlo, porque el comentario de la matriz la sigue nombrando y va a
tentar a la próxima sesión.
