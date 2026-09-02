# T-19 · El alquiler y las expensas se pagan juntos — verificado de punta a punta

> *"Si yo te lo separo, que tengas que hacer dos transferencias o entrar a dos lugares distintos
> para pagarme el alquiler y las expensas, no cobro más, la gente no la paga."* — Camila

**Respuesta corta: está como ella quiere, y más de lo que pidió.** No es que el sistema ofrezca
pagar todo junto: es que **no existe la opción de pagarlo separado**. Alquiler y expensas son una
sola deuda, con un solo número, contra el que se paga una sola vez.

Verificado por `apps/api/test/pago-unificado-alquiler-y-expensas.test.ts`, que recorre el camino
completo con un contrato `ALQUILER_Y_EXPENSAS` de $500.000 de alquiler + $100.000 de expensas.

---

## Lo que se probó, en orden

1. **La cuota nace con un solo total.** Al dar de alta el contrato, el sistema genera una cuota
   con `montoAlquiler = 500.000`, `montoExpensas = 100.000` y **`montoTotal = 600.000`**. No hay
   dos cuotas.

2. **El inquilino ve una sola línea.** En la app, el período aparece **una vez**, con un saldo de
   $600.000. No hay una fila "alquiler" y otra "expensas": no hay dónde equivocarse.

3. **🔴 Pagar exactamente el alquiler NO salda la cuota.** Si transfiere $500.000, la cuota queda
   **debiendo $100.000** y sigue sin figurar como pagada. *Éste es el caso que lo demuestra:* si
   fueran dos deudas, acá habría una en cero y otra entera. Hay una sola, parcialmente pagada.

4. **Esa plata llega al dueño prorrateada.** Al rendirle al propietario, de esos $500.000 le
   corresponden **$416.666,67**, no los $500.000 completos — porque no existe "la plata del
   alquiler" separada de "la de las expensas": hay un cobro contra un total, y se reparte en
   proporción (500.000 × 500.000/600.000). Es la prueba del otro lado del mostrador.

5. **Se completa con una segunda operación y queda saldada.** Los $100.000 restantes cierran la
   cuota en $0 y la dejan en PAGADO.

**Y hasta ahora nadie lo había probado.** El devengo mixto estaba testeado como función pura, y
el circuito informar/validar estaba testeado sobre contratos de sólo alquiler. El cruce de los
dos —que es exactamente lo que Camila pregunta— no tenía cobertura.

---

## Lo que NO está resuelto, y conviene decirlo en la misma conversación

**Cobrar la expensa unificada funciona. Cargarla, no.**

El consorcio tiene su propio `expensasPeriodoActual`, y la pantalla del consorcio incluso muestra
cuánto le tocaría a cada unidad según su coeficiente. Pero ese número **no llega a ninguna cuota**:
el devengo lee las expensas del **contrato** (`Contrato.montoExpensas`), y nada las copia desde el
consorcio.

En la práctica, cuando llega la expensa del mes, Camila tiene que entrar contrato por contrato y
actualizar el monto a mano con `PATCH /contratos/:id/expensas`. Si se olvida de una unidad, esa
cuota sale con la expensa vieja: **se le cobra de menos al inquilino y la inmobiliaria le paga
igual al consorcio.** El propio código ya conoce ese riesgo y lo tiene anotado en
`apps/api/src/lib/liquidaciones.ts`.

Eso es **T-22** ("Consorcio: avisar por mail y cargar la expensa del período"), y es el que hay que
priorizar si la parte de consorcio va a usarse de verdad. La cuenta de la unidad ya está resuelta
en el front —`expensa del consorcio × coeficiente de la unidad`—; lo que falta es que ese cálculo
escriba en los contratos en vez de sólo mostrarse.

---

## Cómo mostrárselo

El test es la demostración reproducible, pero para la conversación con ella alcanza con abrir un
contrato con expensas en el panel y hacer que el inquilino informe un pago por menos del total:
se ve que la cuota queda con saldo, no que "las expensas quedaron impagas". Es el mismo hecho,
contado en su idioma.
