# El alquiler y las expensas ya se cobran juntos

> **Para mostrarle a Camila en la próxima sesión.** Es la respuesta a lo que planteó el 03/08,
> que no es un pedido de feature sino un **miedo**: que el sistema le separe el cobro.

---

## Lo que dijo

`[27:16]`:

> *"Tengo gente inquilina nuestra con mucha deuda ¿por qué? Porque le separamos las partes. Si
> yo te doy un monto total 550, vos me transferís 550 y está todo unificado. Ahora si yo te lo
> separo, que tengas que hacer dos transferencias o entrar a dos lugares distintos para pagarme
> el alquiler y las expensas, **no cobro más, la gente no la paga**. Nos hemos dado cuenta: la
> gente no paga las expensas cuando lo dividimos."*

## La respuesta corta

**My Alquiler ya lo cobra unificado.** El inquilino ve **un solo monto** y hace **una sola
transferencia**. No existe ningún camino en el sistema por el que se le cobren las expensas
aparte.

El miedo viene de cómo funciona el sistema que usa hoy, no de éste.

---

## Cómo se ve del lado del inquilino

En su app ve el **desglose**, para entender de qué se compone lo que paga:

```
  Alquiler                                    $ 500.000
  Expensas                                    $ 100.000
  Punitorios · 5 días de atraso                $ 12.500
  ─────────────────────────────────────────────────────
  Total a pagar                               $ 612.500
```

Y abajo **un solo botón de pago, por el total**. El desglose es informativo; lo que se paga es
uno.

`apps/inquilino/src/app/(app)/page.tsx:702-718`

---

## Por qué es así por dentro (para el que quiera verificarlo)

**1 · La cuota nace con todo junto.** Cuando el sistema devenga el mes, guarda una sola fila con
el total ya sumado:

```ts
// apps/api/src/lib/liquidaciones.ts:93-96
montoAlquiler: alquiler,
montoExpensas: expensas,
montoTotal:    alquiler + (expensas ?? 0),
```

`montoAlquiler` y `montoExpensas` se guardan **sólo para poder mostrar el desglose y para
calcular la comisión** (que sale del alquiler, no del total — decisión LOCKED §1). Lo que se
cobra es `montoTotal`.

**2 · Hay un solo camino para pagar.** El único endpoint por el que un inquilino informa un pago
es `POST /pagos/informar` (`apps/api/src/routes/plata.ts:1129`), y va **contra la cuota**, no
contra un concepto. No existe un "pagar expensas" separado: se verificó endpoint por endpoint.

**3 · El módulo de consorcio no le cobra al inquilino.** Los endpoints de consorcio
(`apps/api/src/routes/operacion.ts:1196-1766`) administran el edificio: unidades funcionales,
movimientos, asambleas, servicios comunes, inventario. **Todos son del panel de la
inmobiliaria** (`requireUsuario`). Ninguno es un canal de cobro hacia el inquilino.

**4 · Lo único que el inquilino sube aparte son las boletas de luz y gas** (`GET/POST /boletas`),
que **no son un pago**: son el comprobante de un servicio que paga él por su cuenta.

---

## El caso mixto también funciona

Camila `[29:21]`: *"Tengo dos edificios donde tengo cinco departamentos nada más propios, lo
demás solo cobro [expensas]."*

Eso también está contemplado. Cada contrato tiene un **tipo**
(`Contrato.tipoContrato`, `apps/api/prisma/schema.prisma:77-79`):

| Tipo | Qué cobra la app |
|---|---|
| `ALQUILER` | sólo el alquiler |
| `ALQUILER_Y_EXPENSAS` | los dos, **en un solo monto** |
| `SOLO_EXPENSAS` | sólo las expensas |

Como el tipo vive en **el contrato** y no en el consorcio, dos unidades del mismo edificio pueden
tener regímenes distintos sin ninguna configuración especial. Es exactamente el caso de sus dos
edificios.

⚠️ **Pero `SOLO_EXPENSAS` tiene un hueco del lado de la app del inquilino**: el backend lo maneja
bien, pero la PWA todavía le habla de "alquiler" a alguien que sólo paga expensas. Está anotado
como tarea **T-21** y no afecta al caso de este documento.

---

## Qué falta para dar esto por cerrado

Lo de arriba está **verificado leyendo el código**, línea por línea. Lo que falta es la prueba
en vivo, que es la que de verdad la va a convencer:

1. Cargar un contrato `ALQUILER_Y_EXPENSAS` de prueba.
2. Dejar que devengue el mes.
3. Entrar como el inquilino y mostrarle la pantalla: **un monto, un botón**.
4. Informar el pago y validarlo desde el panel.

**No se pudo hacer acá** porque exige crear datos en el tenant real, que las reglas del proyecto
prohíben. Conviene hacerlo con ella delante en la próxima sesión: es más convincente que
cualquier documento.
