# T-21 · Requerimientos — "solo expensas" en la PWA del inquilino

## 1. El problema, en una frase

A una persona que **sólo paga expensas** (el alquiler lo arregla el propietario por fuera), la
app del inquilino le habla de un alquiler que no paga: le muestra **"Alquiler $0"** en el
desglose, **"Alquiler actual $0"** como titular de su contrato, y le ofrece **negociar una deuda**
que no tiene ese tamaño.

## 2. La cita que lo respalda

Camila `[30:04]`: el alquiler lo arregla el propietario directo con el inquilino, y la
inmobiliaria sólo administra el consorcio.
Alan `[30:08]`: *"No sería un contrato, no hay un contrato de alquiler. Es un pago mensual que
tiene que pagar. Tengo que pensarlo bien esto."*

## 3. Estado actual verificado (archivo:línea, abierto hoy)

**El backend está construido y el documento acierta:**

| Afirmación | Verificado |
|---|---|
| `GET /mi-contrato` expone `tipoContrato` | `apps/api/src/routes/inquilino-mundo.ts:570` ✅ |
| …y también `montoExpensas` | `inquilino-mundo.ts:569` ✅ |
| `montoActual` sale de `contrato.monto`, que para SOLO_EXPENSAS es **0** | `inquilino-mundo.ts:568` ✅ |
| La PWA no menciona `tipoContrato` en ningún lado | `grep -rn "tipoContrato\|SOLO_EXPENSAS" apps/inquilino/src` → **0 resultados** ✅ |

**El hueco es el mapeo, no el endpoint.** `ContratoApi`
(`apps/inquilino/src/lib/api/hooks.ts:44-69`) **sí** declara `montoExpensas` pero **no**
`tipoContrato`; y el objeto que `useMiContrato` devuelve (`hooks.ts:96-112`) **descarta los dos**.
El tipo `Contrato` de la PWA (`apps/inquilino/src/lib/types.ts:138-160`) no tiene ninguno de los
dos campos. O sea: el server manda el dato y el cliente lo tira a la basura.

**Lo que el ocupante ve hoy, en concreto:**

1. `app/(app)/page.tsx:705` — `<DesgloseFila label="Alquiler" value={…montoAlquiler} />` se
   renderiza **siempre**, mientras la fila de Expensas de al lado (`:706`) es condicional a
   `> 0`. Resultado: **"Alquiler $0"** arriba de "Expensas $X".
2. `app/(full)/pago/[liqId]/page-client.tsx:414` — misma fila incondicional en el detalle del pago.
3. `app/(app)/contrato/page.tsx:109` y `:381` — **"Alquiler actual"** con `montoActual` en 3xl.
   Para este contrato dice **$0**, y es el número más grande de la pantalla.
4. `app/(full)/pago/[liqId]/checkout/page-client.tsx:374,441` — **defecto de lógica, no de copy**:
   `alquilerVigente = contrato?.montoActual ?? liq.montoAlquiler`. `??` sólo cae en null/undefined,
   **no en 0**, así que para SOLO_EXPENSAS queda en `0` y la condición `saldo > alquilerVigente * 1.2`
   se cumple con **cualquier** saldo. Un ocupante que debe un mes de expensas recibe el banner de
   "tu deuda es alta, podés pactar un plan".
5. `components/nav-bar.tsx:159` — entrada **"Mis alquileres"** (el switcher de contratos).

**Modo demo:** `contratoMock` (`apps/inquilino/src/lib/mock-data.ts`) es un alquiler normal y no
declara `tipoContrato`. `demo-estado.ts` conmuta estados de pago (`al-dia` / `a-tiempo` /
`atrasado`), no tipos de contrato.

## 4. Comportamiento esperado

Para un contrato `SOLO_EXPENSAS`:

- El desglose del monto **no muestra la fila "Alquiler"** (no muestra "$0").
- El encabezado del contrato dice **"Expensas por mes"** con el monto de expensas, no
  "Alquiler actual $0".
- El banner de deuda alta usa **el monto que realmente devenga** (las expensas), no 0.
- La navegación no lo llama "alquiler".

Para un contrato normal, **todo queda exactamente como está hoy**.

## 5. Alcance

**Entra:**
- Cablear `tipoContrato` y `montoExpensas` desde `/mi-contrato` hasta las pantallas.
- Ajustar las 5 superficies listadas arriba.
- Mock de demo coherente (declarar el tipo, sin inventar un modo nuevo).

**NO entra:**
- **La pregunta de la comisión** (*¿cómo cobra la inmobiliaria por administrar una unidad de solo
  expensas?*). Es una decisión de negocio del dueño, no de código. Se documenta, no se resuelve.
- Cambiar la URL `/mis-alquileres` (rompe links guardados; sólo se toca el rótulo visible).
- Tocar el modelo de datos, el devengo o la rendición. Ya existen y funcionan.
- El panel de la inmobiliaria. T-21 es la PWA.

## 6. Criterios de aceptación

- **AC-1** · Con `tipoContrato: 'SOLO_EXPENSAS'`, el home **no** renderiza la fila "Alquiler"; sí
  renderiza "Expensas" con su monto. Con `'ALQUILER'`, el home renderiza las dos filas igual que hoy.
- **AC-2** · Mismo comportamiento en el detalle del pago (`pago/[liqId]`).
- **AC-3** · La pantalla de contrato de un SOLO_EXPENSAS titula **"Expensas por mes"** con
  `montoExpensas`, y **nunca** muestra "$0" como monto principal.
- **AC-4** · En el checkout, `alquilerVigente` cae a `liq.montoAlquiler` cuando `montoActual` es 0
  (no sólo cuando es null), y para un SOLO_EXPENSAS el umbral del banner usa el monto devengado.
  Un saldo de un período no dispara el banner de deuda alta.
- **AC-5** · `tipoContrato` y `montoExpensas` viajan de `/mi-contrato` al tipo `Contrato` de la PWA;
  un contrato sin `tipoContrato` (dato viejo) se comporta como `'ALQUILER'`.
- **AC-6** · `tsc --noEmit` en 0 en `apps/inquilino` y `apps/api`.
- **AC-7** · El build demo (`apiEnabled === false`) sigue mostrando exactamente lo de hoy.

## 7. Impacto en plata / permisos / multi-tenant

**Ninguno en plata**: no se toca ningún cálculo de importes, ni el devengo, ni la conciliación,
ni la rendición. El único cambio con aritmética es el **umbral** del banner de negociación, que
no mueve un peso — sólo decide si se muestra un texto.

**Ninguno en permisos ni multi-tenant**: no se tocan guards ni queries; `tipoContrato` ya venía
en la respuesta del endpoint, que ya valida al inquilino.

**Consecuencia de negocio ya existente (no la introduce este cambio, se documenta):** con
`SOLO_EXPENSAS` el `montoAlquiler` devengado es 0 → `montoBruto` de la rendición da 0 →
`POST /rendiciones` corta con `RendicionSinCobros`. Un contrato de solo expensas **no se rinde
nunca** y la comisión sobre él es **cero**. Puede estar bien (las expensas van al consorcio, no al
dueño), pero deja abierta la pregunta del punto 5.

## 8. Qué NO se puede romper

- El contrato de alquiler normal: las dos filas del desglose, "Alquiler actual", el banner de
  deuda alta con su umbral de 1.2×.
- El modo demo (`apiEnabled === false`), que no pasa por `useMiContrato` en API mode.
- Los contratos viejos que no manden `tipoContrato`: tienen que seguir viéndose como alquiler.
- El switcher `/mis-alquileres`: la URL no cambia.
