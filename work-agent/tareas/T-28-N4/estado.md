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

---

## Segunda parte: `aplicar-deposito` (mismo día)

El candidato que este mismo documento dejaba anotado. `aplicarDepositoADeuda` es el cierre de
cuentas de una baja: la garantía del inquilino cancela lo que debe y **el resto se le devuelve**.
Arrastra una historia fea, escrita en su propio docblock — antes marcaba el depósito como
NETEADO, cobraba la penalidad y **no tocaba una sola liquidación**: la garantía se consumía, la
deuda quedaba intacta sumando punitorios, y el panel mostraba un neto que el backend nunca
ejecutaba.

Se extrajo **`planDeImputacion(cuotas, disponible)`**: entra la lista de cuotas con su saldo (ya
con mora, que la calcula el caller porque necesita el esquema) y lo disponible, sale el plan de
a qué cuota y por cuánto. Las queries y las escrituras se quedaron donde estaban. **No cambia el
comportamiento.**

**16 tests puros.** La invariante que más importa es la de conservación: **`aplicado + sobrante`
tiene que dar `disponible`, siempre**. Si no cierra, o se le retiene plata a alguien que se está
yendo, o se regala la de la inmobiliaria. Además: nunca imputar más que el saldo de una cuota
(dejaría crédito en una y deuda viva en la siguiente), nunca más que lo disponible, orden de la
más vieja primero, las cuotas futuras no se tocan (el ex-inquilino no ocupó ese mes) y la
tolerancia de un centavo para dar una cuota por saldada.

### Mutación 6 de 7 — y la séptima es un resultado, no una falla

Sacar el `break` de `if (restante <= 0)` **no pone ningún test en rojo**, y está bien que así
sea: con `restante` en 0 la iteración siguiente calcula `imputa = 0` y el `continue` la saltea
igual. **El `break` es una optimización, no una garantía**, y no hay diferencia observable que
un test pueda agarrar.

Escribir un test que "lo cubriera" habría sido cubrir la nada. Se dejó anotado en el código, que
es lo que sirve: para que nadie lo trate como si sostuviera una invariante al tocar la
aritmética de arriba.

Suite puro tras las dos partes: **53 archivos / 505 tests**. `tsc` en 0.

---

## Tercera parte: `contrato-historico` — la deuda que se carga a mano

El módulo que crea la deuda de un inquilino **que ya se fue**: el pedido textual de la clienta
cero (cargar los morosos viejos sin inventarles un alquiler vigente). Tiene **dos callers que no
pueden divergir** —la carga de a uno desde la ficha de la propiedad y la importación masiva
desde Excel—; si crearan cuotas distintas, son plata que alguien va a reclamar.

**No tiene aritmética que extraer: es todo escritura.** Pero sus invariantes son de *forma de las
filas que escribe*, y eso se verifica con un cliente de transacción falso que anota lo que se le
manda — el mismo instrumento del test del cron. 15 tests, sin base.

Las tres que más duelen, y ninguna es teórica:

1. **El contrato nace `FINALIZADO`.** El devengo barre `estado: 'ACTIVO'`, así que las cuotas
   creadas acá son las únicas que va a tener. Si naciera ACTIVO, a un moroso de hace tres años
   **le seguiría creciendo la deuda sola, todos los meses, para siempre**.
2. **`Inquilino.email` queda en `null`, aunque venga uno.** Ese campo es la llave de login de la
   PWA y no filtra por estado del contrato. Acá la fila la tipea un operador de memoria o sale
   de una celda de Excel: un email mal tipeado **le abre a un tercero la deuda de otra persona**.
   El email sí va a la `Persona`, que sirve para dedup y no habilita login por sí sola.
3. **No reclama la propiedad.** El moroso de hace tres años vivió donde hoy vive otro: tocar
   `contratoActualId` le rompería el contrato vigente al inquilino de hoy. Y ése es el caso
   NORMAL, no el borde.

Más el DNI normalizado **en los dos lugares** (de `Inquilino.dni` sale la clave de dedup: si la
carga de a uno guardara `30.111.222` y la masiva `30111222`, el aviso de "este DNI ya está en tu
cartera" no saltaría y la misma deuda entraría dos veces), que un DNI vacío quede en `null` y no
en cadena vacía, y que el tipo de contrato se derive de las expensas.

**Mutación 7/7**, incluida la de reclamar la propiedad —que se verifica por *ausencia*, así que
se inyectó un `propiedad.update` para comprobar que el test lo agarra—.

Suite puro tras las tres partes: **56 archivos / 540 tests**. `tsc` en 0.

## Estado del relevamiento

De los siete módulos de `lib/` sin cobertura que abrieron esta tarea quedan cuatro, y **ninguno
es de plata**: `auditoria` (32), `avisos-reclamo` (115), `reputacion-red` (179) y
`estado-inicial-contrato` (164) — este último es el único que vale mirar, porque valida el
estado inicial de un alta y de ahí salen 400 que el operador ve.

---

## Cuarta parte: `estado-inicial-contrato` — el alta de un contrato EN CURSO

El último del relevamiento que valía. Al dar de alta un contrato con fecha de inicio pasada, el
devengo genera todos los períodos vencidos **como si nadie hubiera pagado nunca**; este helper
aplica lo que la inmobiliaria confirma en el wizard (cuáles se pagaron, cuáles a medias, cuáles
se deben). Si se equivoca, el contrato entra a producción con la deuda mal **desde el minuto
cero** — y esa deuda es lo que se le reclama a una persona real.

**15 tests** con `tx` falso, sin base.

### El caso que más valía está en las FECHAS

Los pagos sintéticos se fechan en el **vencimiento de su cuota**, no en `new Date()`. El
comentario del código cuenta qué pasó cuando no era así (bug de caja del 07/07): esa plata vieja
caía en el **cierre de caja de HOY** como "cobrado hoy" —el dueño veía ingresos que nunca
aprobó— y al inquilino le llegaba *"te validamos el pago de &lt;mes viejo&gt;"* como actividad
reciente. Quedan fijados los tres campos (`fechaTransferencia`, `informadoAt`, `decididoAt`) y
que **cada cuota use su propio vencimiento**, no todas el mismo.

### Las validaciones que frenan un alta inconsistente

- **Período repetido** → sin esto se crearían DOS pagos sintéticos para la misma cuota, y la
  cuenta corriente arrancaría con el doble de lo pagado.
- **Período que todavía no venció** → el estado inicial es historia, no futuro; marcarlo pagado
  adelantaría plata que nadie cobró.
- **PARCIAL sin monto** → un pago sintético de 0 dejaría la cuota PARCIAL sin nada pagado.
- **PARCIAL que cubre el total** → obliga a marcarlo Pagado, para que estado y saldo no se
  contradigan.
- **Mora negativa recortada a 0** → si no, un dato mal tipeado *baja* la deuda.

**Mutación 8/8.**

Suite puro tras las cuatro partes: **57 archivos / 555 tests**. `tsc` en 0.

## Relevamiento cerrado

De los siete módulos de `lib/` sin cobertura, quedan tres y **ninguno toca plata**: `auditoria`
(32 líneas), `avisos-reclamo` (115) y `reputacion-red` (179). La veta de plata sin tests que
abrió este relevamiento **está agotada**.
