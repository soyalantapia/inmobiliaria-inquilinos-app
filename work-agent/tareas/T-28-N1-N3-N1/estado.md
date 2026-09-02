# T-28-N1-N3-N1 · Los filtros del cierre de caja, fijados sin base

- tomada: 2026-08-20T14:35Z
- worktree: ../myalquiler-T-23-N4-N1
- rama: `fix/T-28-N1-N3-N1-filtros-cierre`
- base: `origin/main` (62f646c)
- fase: TERMINADA (la mitad del cierre; `/mis-cargos` sigue afuera)

## El punto: esta tarea la había dado por bloqueada, y no lo estaba

Yo mismo escribí, al cerrar T-28-N1-N3, que estos filtros *"viven en el `where` de Prisma: no
hay aritmética que extraer y un test puro no lo ve"*. **Es falso.** Lo que no se puede sin base
es verificar qué DEVUELVE Postgres; pero la **construcción del `where`** es una función como
cualquier otra, y ahí es donde ocurrieron las dos roturas históricas — alguien borró un filtro.

Así que se extrajo `whereCierreDelDia(inmobiliariaId, fecha)` a `lib/cierre-caja.ts`: entra el
tenant y la fecha, sale el objeto que se le pasa a Prisma. El test afirma sobre ese objeto.

## Qué queda fijado

**Los cuatro filtros del arqueo.** Dos de ellos ya rompieron en producción, y los dos fallan del
mismo modo traicionero: no explotan, **inflan**. El arqueo queda más alto de lo que entró y la
comisión se cobra sobre plata que la inmobiliaria nunca tocó — nadie lo nota mirando la
pantalla, porque un número más grande no se ve mal.

| Filtro | Qué pasa si se cae |
|---|---|
| `condonado: false` | Se cuenta como cobrada una deuda perdonada, y se comisiona sobre el perdón |
| `contrato.modoCobranza: 'INMOBILIARIA'` | Entra la plata que el inquilino transfirió al CBU del dueño (B1) |
| `inmobiliariaId` | Pagos, inquilinos y direcciones de **otra** inmobiliaria en la pantalla de arqueo |
| `estado: 'CONCILIADO'` | Entran pagos apenas informados, que todavía no validó nadie |

**Y el día civil argentino**, que es aritmética pura y sutil: un pago conciliado a las 23:30 hora
local se guarda como 02:30Z del día siguiente. Con un rango UTC ingenuo cae en el arqueo
equivocado — el de la cajera no cuadra y el del día siguiente aparece inflado con plata de ayer.
También queda fijado que el rango es **semiabierto**: con `lte` en vez de `lt`, un pago exacto a
las 03:00:00.000Z se contaría en los cierres de **dos** días.

Hay además un test al revés de los otros: que el `where` **no acumule filtros de más**. Un filtro
extra haría desaparecer plata que sí entró, y fijar la forma exacta obliga a que agregar uno sea
una decisión consciente y no un descuido.

## Qué prueba y qué NO — sin maquillaje

Prueba **la consulta que armamos**, no lo que Postgres devuelve. Si Prisma interpretara
`contrato: { modoCobranza }` distinto de lo que creemos, esto no lo vería. No sustituye a un test
de integración; agarra lo que pasó las dos veces, que es **que alguien borre un filtro**.

## Migraciones

Ninguna. El contrato del endpoint no cambia: mismo `where`, sólo que construido en otro lado.

## Tests

- `test/cierre-caja-filtros.test.ts` — 12 nuevos. **Mutación 7/7**: borré cada filtro, cambié
  `lt` por `lte`, usé el día UTC y arranqué el día a las 00:00Z. Rojo en los siete.
- Suite puro: **51 archivos / 475 tests** en verde. `tsc` en 0.

## Un tropiezo que vale anotar

El script de mutación restauraba con `git checkout -- <archivo>` y **se comió mi propio trabajo**:
el archivo estaba trackeado y mis funciones nuevas todavía sin commitear, así que la primera
"restauración" las borró antes de la primera mutación (las siete dieron "patrón no encontrado" —
un falso verde disfrazado de error). Si el script hubiera comparado por igualdad en vez de por
presencia del patrón, habría reportado 7/7 detectadas sobre un archivo vacío.

**Regla:** commitear ANTES de mutar, o respaldar a un archivo temporal. Nunca usar `git checkout`
como red cuando lo que estás protegiendo no está commiteado.

## Lo que sigue afuera

`GET /mis-cargos` — su garantía es el aislamiento multi-tenant, que es un `where` con el id del
inquilino y no tiene aritmética ni forma que valga la pena fijar por separado. Ése sí necesita
integración de verdad.
