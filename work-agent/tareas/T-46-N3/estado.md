# T-46-N3 · La demo del portal copia los montos a mano — HECHA (con un guardarraíl, no un refactor)

## La decisión

La tarea proponía dos salidas implícitas: dejarlo así (y aceptar que un día se desincronice) o
armar un paquete compartido de mocks. **Ninguna de las dos.**

- **Un paquete compartido es más costo que beneficio**, y la propia tarea lo dice: hay que crear
  el paquete, cablearlo en dos apps y arrastrar sus tipos, todo para datos que sólo existen en el
  build demo. Coincido.
- **Dejarlo documentado no alcanza.** El texto decía *"queda escrito para que el día que se
  desincronice, se sepa por qué"* — pero eso no evita que se desincronice, sólo explica el
  cadáver después.

El riesgo real no es tener dos copias: es que **diverjan en silencio**. Así que no se elimina la
duplicación, se elimina el silencio.

## Qué se hizo

`apps/api/test/demo-portal-coherente.test.ts`: lee los dos archivos, cruza las direcciones que
aparecen en **ambos** y falla si el alquiler no coincide, nombrando la dirección y los dos montos.

Estado al 19/08: las tres unidades compartidas **coinciden** — Gorriti 4521 3°B: 480.000 ·
Av. Cabildo 2890 7°A: 620.000 · Honduras 4490 PB: 720.000. O sea que el guardarraíl entra ANTES
de que el problema exista, que es cuando sirve.

## Detalles del test que valen

- **Sólo compara las direcciones en común.** Cada app tiene datos propios —el panel tiene
  contratos que este propietario no posee— y eso no es una inconsistencia.
- **Falla también si deja de encontrar direcciones compartidas.** Si alguien renombra las
  unidades o cambia el formato del archivo, el parseo quedaría ciego y el test pasaría en verde
  sin proteger nada. Ese es el modo de fallo peor de un test que lee fuente, y está cubierto.
- Verificado **por mutación**: cambiando el monto de Gorriti a 495.000 en el portal, falla y dice
  exactamente `Gorriti 4521, 3°B → portal 495000 vs panel 480000`.

## Dónde vive, y por qué no es su lugar definitivo

En `apps/api/test/` **porque es el único paquete con runner de tests**. Montar uno en los fronts
es **T-32** (y **T-46-N2** es el recordatorio de limpiar esto al cerrarla). Cuando eso pase, este
archivo debería mudarse.

Se dejó acá igual: un guardarraíl en el paquete equivocado sirve más que uno que no existe.

## Verificación

363 tests sin DB en verde (40 archivos). Cero cambios en código de producto.
