# T-14 · Pago parcial desde la PWA — VERIFICADA, sin código

rama: `feat/reunion-camila-0308` · fase: 8 · **cero líneas de código de producto**

## El veredicto

**Ya funciona, y ya funcionaba el 03/08.** El checkout tiene un selector "¿Cuánto vas a pagar
ahora?" con dos opciones —"El saldo completo" y **"Pagar un parcial"** con monto libre—, y hasta
distingue prod de demo en el copy. Verificado a mano, no sólo por los agentes:
`apps/inquilino/src/app/(full)/pago/[liqId]/checkout/page-client.tsx:756` (saldo completo) y
`:775` (parcial, con `<Input>` y clamp a `[0, saldo]` en `:733`).

Del otro lado, el back etiqueta solo: `plata.ts:1288`,
`tipo: monto >= saldoPendiente - 0.01 ? 'TOTAL' : 'PARCIAL'`.

Los tres criterios de aceptación se cumplen hoy:

| Criterio | Dónde |
|---|---|
| Puede informar menos del total | `checkout/page-client.tsx:775` + clamp `:733` |
| Entiende cuánto le queda | home `page.tsx:670` "Te queda un saldo", `:716-718` "Ya pagaste −$X"; comprobantes `:899-906` "Falta pagar" |
| La inmo lo ve como parcial | `pagos-por-validar.tsx:963-970` badge ámbar, `:1005-1017` "de $X · si lo validás queda $Y" |

**T-14 no era una tarea de construir. Era de verificar.** Y el paso 1 que el propio documento le
asignaba —"verificar el checkout"— es exactamente lo que faltaba hacer.

## La pregunta 2 de T-14, respondida: NO

*"¿Se permite pagar sólo el alquiler dejando las expensas?"* → **No, y no se construye nunca.**
El parcial se ofrece como **monto libre**, jamás como elección de concepto. Tres razones, de
peso creciente:

1. **Es lo que Camila pidió que no se haga.** `[27:16]`: *"si yo te lo separo, que tengas que
   hacer dos transferencias o entrar a dos lugares distintos… no cobro más, la gente no la
   paga."* Lo que rompe la cobranza no es la pantalla: es que el inquilino **piense** en dos
   deudas.
2. **La base no puede registrarlo.** `Pago` no tiene campo de concepto
   (`schema.prisma:1664-1719`); `TipoPago` es sólo `{TOTAL, PARCIAL}`. El único vínculo con la
   deuda es `liquidacionId`. No falta exponerlo en la UI: no existe dónde guardarlo.
3. **Y aunque pusiéramos el botón, el sistema no lo respetaría.** La imputación por concepto
   aguas abajo es **prorrateo**, no prelación:
   `alquilerCobrado = min(cobrado, montoTotal) × (montoAlquiler / montoTotal)`
   (`lib/rendicion-pendiente.ts:66`, espejado en `plata.ts:1733` y `plata.ts:227`). Si el
   inquilino paga "sólo el alquiler", esa plata **igual se reparte proporcionalmente** al rendir
   y al calcular comisión. El botón le mentiría a los dos.

Honrar de verdad "pagué el alquiler, no las expensas" sería cambiar el motor de imputación de
prorrateo a prelación, agregar concepto a `Pago`, migrar, y reescribir rendición + cierre de
caja. Eso es el corazón del flujo de pagos: justo lo que T-04 prohíbe tocar, y un rediseño
contable, no un feature de UI.

**El desglose Alquiler / Expensas / Punitorios se queda como está: informativo.** Se agregó
precisamente para responder *"¿por qué pago más que mi alquiler?"*. Un solo CTA, un solo monto,
una sola transferencia — y arriba, "¿cuánto vas a pagar ahora?".

**Lo que le llevaría a Camila:** el sistema ya hace las dos cosas que pidió y no se pisan. Paga
uno solo (T-19) y puede pagar de a poco (T-14). Lo que nunca le va a ofrecer es elegir qué
concepto paga — porque eso es lo que le rompe la cobranza a ella.

## Lo más grave que apareció — verificado a mano, tarea nueva

**Informar un pago contra una liquidación FUTURA le congela el aumento para siempre.** Los tres
eslabones, leídos uno por uno:

1. `recomputarLiquidacionesFuturas` saltea toda cuota con `cantidadPagos > 0`
   (`lib/liquidaciones.ts:366`).
2. Ese contador es `_count: { select: { pagos: true } }` — **sin filtro de estado**
   (`core.ts:3011`). Cuenta `INFORMADO` y `RECHAZADO` igual que `CONCILIADO`.
3. Rechazar **no borra** el Pago: lo pasa a `RECHAZADO` (`plata.ts:495-497`). El contador queda
   `> 0` para siempre.

Y `POST /pagos/informar` valida que la *fecha de transferencia* no sea futura (`plata.ts:1186`)
pero **no valida el período de la liquidación**: busca la liq por `id + contratoId` y nada más
(`:1191`).

Resultado: informar $1 contra el mes que viene deja esa cuota al alquiler viejo de forma
permanente, aunque la inmobiliaria lo rechace. Toca el mismo endpoint que modifiqué en T-16
(`PATCH /contratos/:id/monto`). **Registrado como T-33; el arreglo queda del otro lado de T-04.**

## Se puede hacer ya (no toca pagos)

1. Cerrar T-14 en el documento con este veredicto. ✅ hecho.
2. Guión de una sola demo que cierre T-14 y T-19 juntas: son la misma pantalla.
3. **Averiguar qué valor tiene `NEXT_PUBLIC_API_URL` en el entorno donde Camila probó el 03/08.**
   Es la pregunta más barata y más importante que quedó abierta: demo y prod se comportan
   **distinto** en el parcial, así que sin ese dato cualquier lectura de lo que ella vio es
   especulación. Puede además acotar las hipótesis de T-04.

## Cola priorizada para el día que T-04 cierre

1. El input del monto muestra los dígitos crudos y clampea recién al salir (`:728` vs `:733`):
   con saldo $50.000, tipear `999999` deja el input mostrando 999999 e informa 50000, sin aviso.
2. El checkout es el único outlier que no usa el helper `saldoDeLiquidacion` de T-15
   (`:367-370`). Deuda de consistencia; en prod la divergencia no es alcanzable porque el guard
   de `:295-359` corta antes.
3. El toast del panel al conciliar un parcial no menciona el saldo restante en prod
   (`pagos-por-validar.tsx:117-126`), en demo sí (`:582-607`).
4. **La mora se devenga siempre sobre `montoTotal`, nunca sobre el saldo** (`plata.ts:1242`,
   `:1428`, `:88`, `aplicar-deposito.ts:99`). Como el parcial es —según Camila— *lo más
   frecuente*, esto es el caso normal, no un borde. Puede ser la regla contractual querida:
   **es decisión de negocio, va con Camila delante, no es un fix**.
5. `aplicarDepositoADeuda` es el único de los cinco caminos que crean un Pago `CONCILIADO` sin
   `FOR UPDATE` sobre la liquidación (`aplicar-deposito.ts:83-141`).
6. Un co-inquilino con permiso sólo-`VER` puede informar $1 y, por el índice único de
   `INFORMADO`, trabarle el pago al titular (`plata.ts:1130` + `guards.ts:217-220`). El front lo
   gatea, el back no. El permiso laxo **es decisión explícita del dueño** (`plata.ts:1126-1128`);
   lo no mitigado es el efecto de bloqueo.
7. Al dar de baja un contrato, una cuota futura en `PARCIAL` sobrevive al `deleteMany`
   (`core.ts:1536-1546`) y queda como deuda de un ex-inquilino.

**NO tocar aunque T-04 cierre:** la serialización de parciales (índice único
`UNIQUE(liquidacionId) WHERE estado='INFORMADO'`). Es lo que garantiza que ningún pago entra sin
que alguien lo mire — la garantía que Camila necesita justo después del susto de los $850. Si la
espera duele, la salida es validar más rápido, no aflojar el candado.

## Lo que NO se verificó

- **Nada se ejecutó.** Todo es lectura estática: ni la app, ni tests, ni la base.
- No se confirmó que el índice único parcial exista **realmente en prod** (se creó por SQL crudo
  en `migrations/20260621000000_audit_unique_constraints/migration.sql:14`). Conviene chequearlo
  en la misma pasada de T-04.
- No se verificó si la UI de la PWA expone alguna liquidación **futura** con link al checkout.
  Por API el hueco de T-33 es alcanzable con seguridad; por UI, sin verificar.
- No se verificó si al conciliar un parcial se le notifica el saldo al inquilino.
- No se verificó qué número exacto imprime la columna de la tabla `/pagos` del panel para un
  contrato en `PARCIAL` (`hooks.ts:1527-1528` sugiere que es el alquiler del contrato, no el
  saldo). O sea: no se sabe qué número estaba mirando Camila.
- **No hay runner de tests en ninguno de los dos fronts** (sólo `apps/api` tiene script `test`).
  El clamp del monto no se puede testear hoy. Eso es **T-32** y bloquea cualquier fix futuro del
  checkout.
