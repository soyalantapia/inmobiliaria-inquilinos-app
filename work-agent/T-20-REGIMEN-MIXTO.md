# T-20 · Consorcio con unidades de régimen mixto — verificado

**Funciona, y sin nada especial.** `tipoContrato` vive en el **contrato**, no en el consorcio, así
que un edificio puede tener una unidad alquilada y otra de sólo expensas conviviendo sin ninguna
configuración adicional. Verificado de punta a punta en
`apps/api/test/consorcio-regimen-mixto.test.ts`, con las dos unidades colgando del mismo
`Consorcio`.

- La unidad **alquilada** devenga $400.000 de alquiler y $400.000 de total.
- La unidad de **sólo expensas** devenga **$0 de alquiler** y $150.000 de total: `montoAlquilerSegunTipo`
  hace su trabajo.
- Las dos conviven en el mismo consorcio sin pisarse.

---

## La pregunta que el ticket dejó anotada, y su respuesta

> *"`montoAlquilerSegunTipo` devuelve 0 para SOLO_EXPENSAS — que es correcto, pero conviene ver
> qué hace la rendición con eso."*

**La rendición del dueño de esa unidad devuelve 409, aunque el inquilino haya pagado la expensa
completa.** Y está bien: esa plata es del consorcio, no del propietario. Rendírsela sería darle
plata que no le toca, y comisionarla sería cobrarle a la inmobiliaria sobre plata ajena — que es
exactamente lo que `lib/cierre-caja.ts` ya dice por escrito.

El contraste está en el mismo test: la unidad **alquilada del mismo consorcio** sí se rinde, y con
plata. La distinción funciona.

### ✅ El mensaje engañaba — arreglado acá mismo (T-20-a)

El 409 dice:

> *"No hay cobros nuevos del período 2026-06 para rendir a este propietario"*

Y sí hubo cobros: se cobraron los $150.000 completos. Lo que no hay es nada **rendible**. Para
Camila, parada frente a una unidad cuyo inquilino pagó todo, ese texto dice lo contrario de lo que
pasó — y el camino natural para "arreglarlo" es buscar el pago que supuestamente falta.

El 409 se lanza como excepción desde adentro de la transacción y se traduce a mensaje ~430 líneas
más abajo, donde ya no hay con qué distinguir los casos. La solución fue hacer viajar los dos
números en la excepción: lo **cobrado** del período y, de eso, la porción que es **alquiler**.

Ahora el 409 dice, cuando se cobró y nada es alquiler:

> *"Se cobraron $ 150.000 de expensas del período 2026-06, que van al consorcio: no hay alquiler
> para rendirle a este propietario"*

…y sigue diciendo *"No hay cobros nuevos"* en los otros dos casos (no se cobró nada, o ya se
rindió todo lo cobrado), donde ese texto sí describe lo que pasó. La respuesta lleva además un
`codigo` (`SOLO_EXPENSAS` / `SIN_COBROS_NUEVOS`) para que el panel pueda decidir sin parsear texto.

El test cubre **los dos** caminos: sin el segundo caso, un arreglo que reemplazara el mensaje para
todos pasaría igual y dejaría un texto de expensas sobre una unidad alquilada — la misma mentira
al revés.

---

## Lo que este relevamiento encontró de paso, y es más grande

**La plata de las expensas entra y desaparece de la vista.**

Todo el código repite —con razón— que *"las expensas van al consorcio"* como motivo para
excluirlas de la rendición y de la comisión. Pero **no hay ninguna superficie que las lleve
ahí**. El consorcio tiene su propio libro (`MovimientoConsorcio`, con categoría `COBRANZA`), y ese
libro **sólo se escribe a mano**, desde `POST /consorcios/:id/movimientos`. Nada conecta el pago
del inquilino con el consorcio al que corresponde.

O sea que hoy, con una unidad de sólo expensas:

1. Camila carga la expensa del mes **contrato por contrato** (el `expensasPeriodoActual` del
   consorcio no llega a ninguna cuota — ver `T-19-EL-PAGO-VA-UNIFICADO.md`);
2. el inquilino paga y la inmobiliaria cobra;
3. esa plata **no aparece en el libro del consorcio** salvo que alguien la cargue a mano otra vez;
4. y la rendición al dueño dice "no hay cobros".

Las tres cosas son el mismo agujero visto desde tres lugares, y las tres son **T-22**. Este
relevamiento sube su prioridad: la parte de consorcio está construida a la mitad — la estructura
(consorcios, unidades, coeficientes, libro, asambleas) existe y **la plata no la recorre**.
