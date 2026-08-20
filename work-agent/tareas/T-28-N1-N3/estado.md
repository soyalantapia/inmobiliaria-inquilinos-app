# T-28-N1-N3 · Los flujos de plata que faltaban, cubiertos SIN base

- tomada: 2026-08-20T13:00Z
- worktree: ../myalquiler-T-28-N1
- rama: `feat/T-28-N1-N3-cierre-puro`
- base: `origin/main` (79c07d6)
- fase: TERMINADA (2 de 3 endpoints; el tercero necesita base y queda anotado)

## Restricción de entorno

**Sin Docker, por pedido explícito.** Así que nada de tests de integración esta vuelta: todo lo
que sigue corre con `pnpm test:sin-db`, en cualquier máquina y en CI.

Resultó no ser una limitación grande: los dos riesgos más caros de los tres endpoints que
faltaban son **aritmética y orquestación**, no base de datos. Lo que sí queda afuera son los
filtros del `where` de Prisma, que no se ven sin una base.

## 1. `GET /caja/cierre` — la aritmética salió del handler

Era el arqueo que la cajera tiene en la mano al cerrar el día, y **no tenía un solo test**: toda
su cuenta vivía inline en un handler que necesita Postgres, o sea del lado que no corre nunca.

Se extrajo a **`apps/api/src/lib/cierre-caja.ts`**. No es armar una capa —es un archivo con un
solo llamador—: lo que se gana es que **seis invariantes de plata** pasan al carril que corre
siempre. La query se quedó en el handler y **el contrato del endpoint no cambia** (mismo shape;
lo confirma el tipo `CierreCaja` de `use-pagos.ts`, que habría roto el typecheck).

De paso se borró la fórmula de comisión **duplicada inline**, que ahora importa
`tasaComisionDeParticipaciones` de `lib/ganancia-contrato.js`. Eso mete al cierre bajo un test
que ya existía (`propietario-baja-logica.test.ts`, que fija que la baja lógica de un propietario
NO baja la comisión) sin escribir una línea nueva.

**15 tests puros** en `test/cierre-caja.test.ts`. Las seis reglas que fijan:

| Regla | Qué cuesta que se caiga |
|---|---|
| Prorrateo alquiler/total | Comisionar las expensas: al 8%, ~$8.000/mes de más por contrato |
| Cap del pago a `liqTotal` | Comisionar la mora, y dejar de cuadrar contra la rendición |
| Guarda `liqTotal > 0` | `NaN` → `null` en el JSON: el día cierra sin comisión y **nada falla** |
| Redondeo a centavos | Drift contra la rendición, que persiste en `Decimal(14,2)` (ya pasó) |
| Buckets por moneda | Sumar ARS con USD: un número que no existe |
| `multiMoneda` | Si el flag miente, el front muestra el total plano de un día mixto |

**Verificación por mutación: 6 de 6 detectadas.** Rompí cada invariante de a una y el suite se
puso en rojo en las seis. Script en el scratchpad de la sesión; sin esto los tests no probarían
nada.

## 2. `POST /internal/cron/devengar` — el aislamiento de fallos, con un Prisma falso

Es el de mayor blast radius del repo: recorre los contratos ACTIVO de **todas** las
inmobiliarias y lo dispara el cron cada 6 h. **Ya pasó una vez** que un contrato con datos raros
tiraba la función entera: los siguientes no se devengaban y el barrido de vencidos no corría,
para todos los clientes. Lo único que lo evita es un try/catch por contrato que **ningún test
ejercitaba**.

Se cubre **sin base**: la orquestación es lógica, así que se le pasa un cliente Prisma falso de
objetos planos. El truco para saber qué contrato se está procesando es que
`devengarSiSigueActivo` hace `` tx.$queryRaw`... WHERE id = ${contrato.id} FOR UPDATE` ``, y como
es un template tag el id llega como primer valor interpolado.

**5 tests** en `test/devengo-aislamiento-fallos.test.ts`: que un contrato roto no frene a los de
**otra** inmobiliaria, que el fallo se reporte en `fallidos` en vez de tragarse, que el barrido
de vencidos corra igual, que su caída no tumbe el devengo, y un control sin fallas.

**Verificación por mutación: 3 de 3 detectadas.**

## 3. `GET /mis-cargos` — NO se hizo

Lo que importa ahí es el **aislamiento multi-tenant** (que un inquilino no vea cargos de otro
contrato ni de otra inmobiliaria) y eso vive en el `where` de Prisma: no hay aritmética que
extraer y un test puro no lo ve. Necesita integración → queda en **T-28-N1-N3-N1**.

## Migraciones

Ninguna.

## Tests

- `test/cierre-caja.test.ts` — 15 nuevos, mutación 6/6.
- `test/devengo-aislamiento-fallos.test.ts` — 5 nuevos, mutación 3/3.
- Suite puro completo: **46 archivos / 432 tests**, verde. `tsc` en 0 en los 5 paquetes.

## Tareas nuevas detectadas

- **T-28-N1-N3-N1** (QA, 🟡): `GET /mis-cargos` sigue sin cobertura; necesita base.
- Lo mismo para los filtros del `where` de `/caja/cierre` — excluir `PROPIETARIO_DIRECTO`,
  excluir condonados, aislamiento por inmobiliaria y el rango del día civil argentino. La
  aritmética ya está cubierta; **los filtros no**, y dos de ellos ya rompieron una vez.
