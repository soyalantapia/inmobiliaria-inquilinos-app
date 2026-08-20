# T-01-N1-N5 · El panel muestra números de rendición que no son los de la rendición

**Prioridad:** 🟠 plata mostrada + fecha inventada
**Origen:** barrido adversarial de T-01-N1. Los dos salieron marcados como deuda vieja —no son
regresiones del merge— y quedaron sin registrar. Se revalidaron hoy contra el código: siguen.

Son dos cosas distintas con el mismo síntoma: **el panel cuenta una historia y la rendición
cuenta otra**, sobre la misma plata y el mismo propietario.

---

## 1. 🟠 La plata: el panel prorratea sobre un total que incluye la mora; el server no

`apps/inmobiliaria/src/lib/api/hooks.ts:1177-1178`:

```ts
const cobradoLiq = Math.min(l.montoPagado, l.montoTotal);
const alquilerCobradoLiq = l.montoTotal > 0 ? cobradoLiq * (l.montoAlquiler / l.montoTotal) : 0;
```

con el comentario *"El cap deja afuera la mora — que no se rinde al propietario"*.

**No la deja afuera.** El `montoTotal` que llega al panel viene decorado por `conSaldo`
(`apps/api/src/lib/saldos.ts`), que le suma el punitorio calculado on-read. El propio tipo del
panel lo dice tres líneas más arriba, en `hooks.ts:1032`:

> `/** Mora al día incluida en montoTotal/saldo (0 si no hay). */`

El server, en cambio, capea contra la base **sin** mora — `plata.ts` usa
`Number(liq.montoTotal)` tomado directo de la fila, y la mora nunca se persiste. Su comentario
lo dice explícito: *"capeada a la base (montoTotal sin mora)"*.

Dos denominadores distintos para la misma cuenta. Medido:

| caso | server (lo que se rinde) | panel (lo que muestra) | |
|---|---|---|---|
| pago total, sin mora | 100.00 | 100.00 | coinciden |
| pago **parcial** con mora | 50.00 | **45.45** | difieren |
| con expensas y mora | 100.00 | **90.91** | difieren |

Mientras no hay mora coinciden, que es por qué nadie lo vio. En cuanto hay un atraso, el panel
le muestra a la inmobiliaria **menos alquiler cobrado del que la rendición efectivamente le va
a pagar al propietario**.

**Qué se cambia.** El panel usa la misma base que el server: `montoTotal − montoPunitorio`. El
panel ya recibe `montoPunitorio` por separado (`hooks.ts:1032-1033` lo declara justamente para
esto), así que el dato está y no hay que pedirle nada nuevo al API.

## 2. 🟡 La fecha: el historial de rendiciones muestra una fecha inventada

`apps/inmobiliaria/src/lib/api/use-rendiciones.ts:49` declara `createdAt?: string`, y dos
pantallas lo consumen así:

```ts
rendidoAt: r.createdAt ?? `${r.periodo}-01`
```

- `apps/inmobiliaria/src/app/(app)/propietarios/page.tsx:71`
- `apps/inmobiliaria/src/components/historial-propietario-dialog.tsx:81`

**El modelo `Rendicion` no tiene `createdAt`.** Tiene `rendidoAt`, y el API nunca manda
`createdAt`. O sea el `??` gana **siempre** y la fecha que ve la inmobiliaria es el **día 1 del
período**, no el día en que se rindió.

No es cosmético: es el dato con el que alguien contesta *"¿cuándo le pagaste a Silvana?"*. Una
rendición del período julio hecha el 12 de agosto se muestra como 1 de julio.

**Qué se cambia.** `createdAt` → `rendidoAt`, que es el campo que existe y que el API ya manda.
Se deja el `??` como red, pero deja de ser el camino normal.

---

## Lo que NO se hace

- **No se toca el server.** El cálculo del server es el correcto y es el que mueve la plata de
  verdad; el que estaba mal es el espejo.
- **No se cambia el contrato del API.**
- **No se agrega ninguna dependencia.**

## Cómo se verifica

- **10 tests puros** sobre la porción de alquiler. No comparan contra números escritos a mano:
  replican la fórmula del server y exigen que el panel dé **lo mismo**, en cinco combinaciones
  de mora, expensas y pago parcial. Si la del server cambia, se nota acá.
- **Se ponen rojos al revertir:** anulando el cap, 2 de 10 en rojo.
- **La fecha la agarra `tsc`:** volviendo el campo a `createdAt` salen dos errores TS2339, uno
  por cada pantalla que lo consume.
- `tsc` **0 en los cinco paquetes**, **391 tests verdes** en la compuerta.

> ⚠️ Los 10 tests **no corren en CI**: `apps/inmobiliaria` no tiene runner (T-32). Se corrieron
> a mano con el binario de `apps/api` y un config temporal que se borró. Hubo que agregarle al
> tsconfig del panel el mismo `exclude` de `*.test.ts` que ya tenían inquilino y propietario —
> sin él, el primer test del paquete rompe `pnpm typecheck` porque vitest no es dependencia
> suya. Queda anotado en **T-46-N2**, que lleva la cuenta de los tres excludes a borrar.

## No verificado

**No se probó en el navegador.** Los dos cambios son de números y fechas que se ven en pantalla
y no se comprobaron abriendo el panel.
