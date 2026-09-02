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

### 🟡 Pero el mensaje engaña

El 409 dice:

> *"No hay cobros nuevos del período 2026-06 para rendir a este propietario"*

Y sí hubo cobros: se cobraron los $150.000 completos. Lo que no hay es nada **rendible**. Para
Camila, parada frente a una unidad cuyo inquilino pagó todo, ese texto dice lo contrario de lo que
pasó — y el camino natural para "arreglarlo" es buscar el pago que supuestamente falta.

**No se cambió acá**, y a propósito: el 409 se lanza como excepción desde adentro de la
transacción y se traduce a mensaje ~430 líneas más abajo, sin acceso a lo cobrado. Distinguir
*"no cobramos nada"* de *"cobramos, pero es del consorcio"* implica llevar ese dato hasta el
handler, que es más que un cambio de copy.

**T-20-a (sugerido):** que el 409 de la rendición distinga los dos casos. Texto propuesto para el
segundo: *"Se cobraron $X de expensas, que van al consorcio: no hay alquiler para rendirle a este
propietario."*

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
