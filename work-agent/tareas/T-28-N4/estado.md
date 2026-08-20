# T-28-N4 · `conSaldo`: la aritmética de "cuánto falta pagar", sin tests

- tomada: 2026-08-20T15:15Z
- worktree: ../myalquiler-T-23-N4-N1
- rama: `feat/T-28-N4-saldos-puros`
- base: `origin/main`
- fase: TERMINADA

## Cómo se llegó acá

El backlog viene marcando abierto lo que otros chats ya cerraron —tres fichas seguidas
(`T-16`, `T-23-N3-N2`, `T-29-N1`) resultaron hechas—, así que esta vez la tarea se buscó **por
datos**: qué módulos de `lib/` no tiene ningún test que los importe.

Salieron siete. Dos son de plata: `saldos` (45 líneas) y `aplicar-deposito` (148). Ésta cubre
el primero.

## Por qué `conSaldo` importaba

Es de las funciones de plata más usadas del backend y **no tenía un solo test directo**. De su
resultado salen:

- la **deuda total** del contrato (`core.ts:281`),
- el **"por cobrar"** del dashboard (`metricas.ts:133`),
- cuánto se descuenta del **depósito de garantía** (`aplicar-deposito.ts:105`),
- y lo que el **inquilino ve que debe** (`plata.ts:121`).

Un error acá no se ve como un error: se ve como un número.

Es pura, así que los 14 tests corren en CI y en cualquier máquina. **No se cambió su
comportamiento** — se fijó el que ya tenía.

## Lo que queda fijado

- **El saldo nunca es negativo.** Pagar de más pasa (el inquilino redondea para arriba, o paga
  dos veces); un saldo negativo se restaría de la deuda de las otras cuotas y le bajaría la
  deuda total del contrato por una plata que no existe. El `montoPagado`, en cambio, se conserva
  tal cual: el dato de que pagó de más tiene que sobrevivir para poder devolvérselo.
- **La mora va ADENTRO del `montoTotal` devuelto.** Es un contrato con el front, que calcula
  `montoOriginal = montoTotal − montoPunitorio`. Devolver la base pelada mostraría la mora
  restada dos veces. Y el saldo la incluye: si no, una cuota pagada tarde figuraría saldada y
  la mora no se cobraría nunca.
- **Una liquidación ausente del mapa cuenta como 0 pagado, no como `undefined`.** El mapa sólo
  trae las que tienen pagos; sin el `?? 0` el saldo saldría `NaN` y se propagaría a la deuda
  total y al dashboard.
- **Redondeo a centavos** en total y saldo, y que acepte el `Decimal` de Prisma (que no es un
  `number`).
- **Conserva el resto de los campos.** Varios callers pasan la liquidación con cosas colgadas
  (`{ ...l, contrato }`) y usan el resultado directo como respuesta del endpoint.

## El hallazgo: una asimetría deliberada que no estaba escrita

`montoPagadoPorLiquidacion` **no filtra `condonado`**, y otros tres lugares sí lo hacen. Parece
una inconsistencia y no lo es:

| Quién | Condonados | Porque mide… |
|---|---|---|
| `rendicion-pendiente.ts` | los EXCLUYE | plata que entró, para rendirle al dueño |
| Portal del propietario | los EXCLUYE | la fecha real en que entró la plata |
| `whereCierreDelDia` (cierre de caja) | los EXCLUYE | el arqueo del día |
| **`saldos.ts`** | **los INCLUYE** | **lo que el inquilino DEBE** |

Condonar crea un `Pago` CONCILIADO con `condonado: true`. Para el arqueo esa plata nunca entró;
para la deuda del inquilino, ya no se debe. Las dos lecturas son correctas.

**El riesgo es que alguien "unifique la inconsistencia":** agregar `condonado: false` acá le
vuelve a cobrar al inquilino lo que la inmobiliaria le perdonó, y reaparece como deuda viva en
el dashboard. Quedó explicado en el docblock de `saldos.ts` —que es donde alguien lo va a leer
antes de tocarlo— y hay un test que lo agarra. Ese test mira el código, porque **el filtro es
una ausencia**, y una ausencia no se puede afirmar desde afuera sin una base.

## Migraciones

Ninguna. Sin cambios de comportamiento: tests y un docblock.

## Tests

- `test/saldos.test.ts` — 14 nuevos. **Mutación 6/6**: saldo negativo, base sin mora, sin
  redondeo, `undefined` en vez de 0, dejar de conservar campos, y filtrar condonados. Rojo en
  los seis.
- Suite puro: **52 archivos / 489 tests**. `tsc` en 0.

## Lo que sigue

`lib/aplicar-deposito.ts` (148 líneas) sigue sin tests que lo importen, y es plata: qué parte
del depósito de garantía se le descuenta al inquilino al cerrar el contrato. Es el candidato
siguiente natural. Los otros cinco sin cobertura no son de plata (`auditoria`,
`avisos-reclamo`, `reputacion-red`) o son de alta de contrato (`estado-inicial-contrato`,
`contrato-historico`).
