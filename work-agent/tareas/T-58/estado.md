# T-58 · La mora fija del tenant se aplicaba sin mirar la moneda del contrato

- rama: `fix/bugs-motor-cobranza`
- fase: TERMINADA

## El bug

Un default `MONTO_FIJO = 5000` cargado pensando en pesos —la pantalla que lo carga ni siquiera
pide moneda— se heredaba **1:1** a un contrato en USD:

    alquiler US$ 800 + mora US$ 5.000 = US$ 5.800 exigibles.

Cinco mil dólares de punitorio sobre un alquiler de ochocientos, y eso es lo que la PWA le
reclama al inquilino, lo que topea `POST /pagos/informar` y lo que muestra el panel.

## Cómo se resolvió la objeción que lo tenía frenado

La ficha decía: *"O se hace en los 21 [call sites] y se corre la suite completa, o no se hace"*,
porque con un campo opcional los que no lo pasaran seguirían con el comportamiento viejo y
quedarían **moras distintas según qué endpoint las calcule** — peor que el bug.

**Se hizo el campo REQUERIDO.** `ContratoConMora.moneda` no es opcional, así que el compilador
enumeró los call sites incompletos uno por uno. No hay forma de olvidarse de ninguno: `tsc`
pasó de 21 errores a 0 a medida que se completaban los `select`.

Tocados: **21 selects** del default del tenant (`+ monedaDefault`) y **10** del contrato
(`+ moneda`), en 8 archivos.

**No hizo falta migración**: `Inmobiliaria.monedaDefault` ya existía con default `'ARS'`.

## La regla

Si el esquema viene del **default del tenant** y es `MONTO_FIJO`, se hereda **sólo si la moneda
del contrato coincide**. Si no, `SIN_MORA`.

- **Los porcentajes se siguen heredando siempre.** Se aplican sobre la base, que ya está en la
  moneda del contrato. Cortarlos habría sido un bug nuevo del lado opuesto: dejar sin mora a
  todos los contratos en dólares de un tenant que cobra por porcentaje. Hay un test que lo fija.
- **El override del contrato manda igual.** Si la inmobiliaria pactó una mora fija con ESE
  inquilino, está expresada en la moneda de ese contrato: no hay nada que adivinar.
- **Sin contrato tampoco se hereda**: no se conoce la moneda, y heredar a ciegas es el caso que
  esto evita.

**Por qué `SIN_MORA` y no una conversión:** no hay cotización en el sistema. Inventarla sería
cambiar un número equivocado por otro, y encima uno que se mueve todos los días. Cobrar de menos
se corrige cargándole la mora al contrato; cobrar US$ 5.000 de más **ya se le reclamó a una
persona**.

## ⚠️ Cambia lo que se cobra, en producción

Un contrato en una moneda distinta a la del tenant que hoy hereda un `MONTO_FIJO` **pasa a tener
mora cero**. La dirección es la correcta —se dejaba de cobrar de más— pero es un cambio real
sobre inquilinos reales. El caso es raro (hace falta tenant con `MONTO_FIJO` default + contrato
en otra moneda + sin mora propia) y catastrófico cuando ocurre.

Si algún contrato así debía tener mora, la forma correcta es **cargársela al contrato**, en su
moneda.

## Tests

`test/mora-cascada.test.ts` — 7 casos nuevos (17 en total). **Mutación 3/4.**

La cuarta no se detecta y es un resultado, no una falla: sacar la guarda `monedaDefault != null`
no cambia nada, porque `contrato.moneda` es un string no nulo y `'ARS' === undefined` ya da
false. Es redundante hoy. Se deja —documentada como tal— porque si `moneda` se vuelve opcional
en alguno de los dos lados, `null === null` heredaría el monto fijo a ciegas. Forzar un test que
castee a ese estado imposible sería testear una mentira.

Suite puro completo: **75 archivos / 696 tests**. `tsc` 0.
