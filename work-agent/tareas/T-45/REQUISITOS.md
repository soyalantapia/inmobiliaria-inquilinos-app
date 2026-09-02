# T-45 · El home de la PWA ignora el pago informado en modo demo

**Prioridad:** 🟡 · **Experto:** FE-I

---

## Lo que decía la tarea, verificado

`BannerPagoPendiente` (`apps/inquilino/src/app/(app)/page.tsx:568-570`):

```ts
const pagoVivo = apiEnabled
  ? ((liq.pagos ?? []).find((p) => p.estado === 'INFORMADO') ?? null)
  : null;
```

En demo es siempre `null`, así que la rama ámbar *"Comprobante en revisión"* nunca se alcanza y
el home cae en *"Tenés un pago atrasado"* — a alguien que en el demo acaba de informar el pago
completo. El comentario dice *"en demo `liq.pagos` no existe (mocks) → comportamiento igual"*,
y no es igual: el pago existe, sólo que en `localStorage`. **Confirmado, línea por línea.**

## Lo que la tarea NO decía, y aparece al ir a arreglarlo

Poner `pagoVivo` en demo **no alcanza**. Tres líneas más abajo, la rama ámbar decide entre
*"Te faltan $X"* y *"Comprobante en revisión"* con:

```ts
const det = saldoDeLiquidacion(liq, resolverMontos(liq, apiEnabled).totalAPagar);
```

Y `saldoDeLiquidacion` (`lib/saldo-liquidacion.ts:48`) también lee **sólo** `liq.pagos`:

```ts
const enRevision = (liq.pagos ?? []).filter((p) => p.estado === 'INFORMADO')...
```

En demo eso da `enRevision = 0` → `faltaPagar = exigible` → el banner diría
**"Te faltan $TOTAL"**, que es tan falso como "atrasado" y encima más confuso: dice que falta
todo justo abajo del cartel que reconoce el comprobante.

O sea: arreglar sólo `pagoVivo` cumple la letra del criterio de aceptación y no el espíritu.

Y hay una ironía acá. El encabezado de `saldo-liquidacion.ts` dice que existe para ser
*"la ÚNICA fuente para las tres pantallas"*, porque antes cada una calculaba distinto y
*"dos pantallas, dos verdades sobre la misma deuda"*. Es el mismo problema que vuelve por otra
puerta: unificaron el cálculo pero la fuente de datos sigue partida en dos según el modo.

---

## Lo que se hace

**1. `saldoDeLiquidacion` deja de pedir una `Liquidacion` entera.** Del objeto sólo usa tres
cosas: `saldo`, `montoPagado` y `pagos[].{estado,monto}`. Se declara ese tipo estructural y se
tipa el parámetro con él.

No es cosmética: con la firma ancha había que **fabricar** un `PagoDeLiquidacion` completo —
doce campos, con `metodo`, `fechaTransferencia`, `decididoAt` y demás inventados— sólo para que
el compilador dejara pasar dos números. Con la firma angosta, `PagoInformado` del store local
**ya encaja tal cual**: los dos tienen `estado` con los mismos tres valores y `monto: number`.

`Liquidacion` sigue satisfaciendo el tipo nuevo, así que los dos callers existentes no cambian.

**2. El banner lee el store local en demo, post-mount.** `localStorage` no existe en el server
y el build es estático: leerlo en render rompería la hidratación. Es el mismo patrón que ya usa
`useDemoEstado`, que lo documenta en su propio comentario.

**3. Un solo `pagos` para todo el banner.** El rótulo y la cuenta de cuánto falta miran la misma
lista, en los dos modos. Que es lo que el archivo del helper decía que quería.

## Lo que NO se hace

- **No se toca `HomeReal` ni el camino de producción.** El `apiEnabled` sigue leyendo
  `liq.pagos` exactamente igual.
- **No se sincroniza entre pestañas.** Si informás el pago en otra pestaña, el home no se
  entera hasta que se remonta. La pantalla de detalle tiene la misma limitación y esto es el
  build demo. Ampliarlo sería scope que nadie pidió.
- **No se agrega ninguna dependencia.**

## Cómo se verifica

- **8 tests puros** sobre `saldoDeLiquidacion`, escritos con la forma del store local. Si
  alguien vuelve a angostar la firma a `Liquidacion`, dejan de compilar: eso es medio test.
- **Se ponen rojos al revertir:** anulando el filtro de `INFORMADO`, 5 de 8 en rojo.
- `tsc` **0 en los cinco paquetes** — parte del punto: si el tipo estructural estuviera mal,
  los dos callers existentes no compilarían.
- Compuerta de la API: **360 verdes**.

> ⚠️ **Estos 8 tests todavía no corren en CI.** `apps/inquilino` no tiene runner de vitest —
> es justo lo que está haciendo **T-32**— así que se corrieron a mano, con el binario de
> `apps/api` y un config temporal que se borró después. Quedan escritos en
> `src/lib/saldo-liquidacion.test.ts`, al lado del único otro test del paquete
> (`tipo-contrato.test.ts`), y empiezan a correr solos el día que T-32 aterrice.

## No verificado

**No se probó en el navegador.** El criterio de aceptación es visual ("el home dice Comprobante
en revisión") y eso no está comprobado abriendo la app.
