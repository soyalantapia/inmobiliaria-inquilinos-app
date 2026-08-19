# T-24-N1 · Importar morosos históricos desde Excel

## 1. El problema, en una frase

T-24 dejó a Camila pudiendo cargar morosos históricos **de a uno**. Tiene 50. Son 50
formularios.

## 2. Las citas

- `[50:04]` *"Yo ahora tengo 50 morosos. Cuando yo inicie, ¿puedo cargar un moroso que no tiene
  contrato y no tiene vigencia?"*
- `[53:43]` Acuerdo con Alan: *"En inquilinos poner para importar."*
- `[53:35]` *"No voy a cargar cinco veces un inquilino en una sola misma propiedad."* — la queja
  original nunca fue al modelo de datos, fue **al trabajo manual**. T-24 resolvió el modelo;
  esta tarea resuelve el trabajo.

## 3. Estado actual — VERIFICADO

Relevamiento en 4 frentes con un verificador escéptico por frente: **0 hechos refutados**, 16
matices (números de línea corridos, sobre todo). Lo que salió:

| Pieza | Qué hace hoy | Sirve para morosos? |
|---|---|---|
| `importaciones-cartera.ts` (499 líneas) + `lib/importacion-cartera.ts` | Wizard de 3 pasos con estado en `ImportacionCartera` (SUBIDO→MAPEADO→CONFIRMADO). Una transacción por fila, reanudable, con reclamo atómico de 15 min | **El chasis sí, el commit no** |
| `crearContratoDesdeFila` (`:432`, `:446`) | **Siempre** `propiedad.create` + `inquilino.create`. El dedup por dirección es un **RECHAZO** (estado DUPLICADO), nunca un match | ❌ Es el inverso exacto de lo que hace falta |
| `devengarDesde` (`:485-492`) | Se fija en `max(fechaInicio, mes actual)` y se persiste, **justamente para que el cron no cree meses pasados como VENCIDO** | ❌ Deuda pasada es el objetivo acá |
| `CAMPOS_IMPORTACION` | 15 campos de contrato. **Ninguno de deuda, saldo, mora ni período adeudado** | ❌ Hay que definir otros |
| `lib/monto.ts` → `parsearMonto` | Fuente única de montos AR/US, ya compartida con el matching bancario | ✅ Se reusa tal cual |
| `normalizarHeader` / `normalizarDireccion` | lowercase + NFD + strip diacríticos + colapso de separadores | ✅ Se reusan tal cual |
| `buscarOCrearPersona` | Find-or-create DNI → email → crear, compartido con el alta manual | ✅ Se reusa tal cual |
| `POST /contratos/historico` (T-24) | Crea el contrato FINALIZADO que no ocupa la propiedad | ✅ **Es el commit correcto por fila** |

**Conclusión: el pipeline de cartera resolvió la parte cara (subir, mapear, previsualizar,
reportar por fila) pero su paso de escritura hace lo contrario de lo que esta tarea necesita.**

## 3b. Bug preexistente encontrado de paso (NO se toca acá)

`propietarioCache` (`importaciones-cartera.ts:198`/`:398`) es un `Map` compartido entre filas que
**se llena DENTRO de la transacción de la fila**. Si esa transacción hace rollback, el propietario
creado desaparece pero su id queda cacheado → las filas siguientes referencian un `propietarioId`
inexistente y fallan por FK. Es de la importación de cartera, no de esto. Va como tarea aparte.

## 4. Lo que ya existe y hay que reusar, no reescribir

`importaciones-cartera.ts` ya resolvió la parte cara de esto: subir un archivo, mapear columnas
con nombres que no controlamos, deduplicar, y reportar qué fila falló y por qué. Escribir un
segundo importador desde cero sería el anti-patrón explícito del proyecto ("reemplazar una
librería bien establecida por código custom más limpio", pero peor: por código propio duplicado).

La decisión de diseño de fondo, entonces, no es *cómo hago un importador* sino **dónde engancho
la deuda histórica en el importador que ya hay**.

## 5. Las tres decisiones, tomadas

**(a) Se EXTRAE la creación del contrato histórico a `lib/contrato-historico.ts`.** ✅
La carga de a uno y la importación comparten exactamente la misma aritmética. Si viviera
duplicada, tarde o temprano una crearía cuotas distintas que la otra — y es plata que alguien
va a reclamar. Mismo criterio con el que `buscarOCrearPersona` ya es compartido entre el alta
manual y la importación de cartera.

**(b) NO es un modo dentro de `importaciones-cartera.ts`: es un pipeline aparte.** ✅
Un flag habría metido un `if (tipo)` en **cada** paso —campos, validación, commit, dedup— de una
máquina de 500 líneas llena de comentarios sobre bugs de duplicación en carteras reales de
clientes. El riesgo de romper un flujo que hoy funciona no compensa ahorrar un archivo. Lo que
sí se reusa es todo lo puro: `parsearMonto`, `normalizarHeader`, `normalizarDireccion`,
`buscarOCrearPersona`, y la forma del wizard.

**(c) El flujo es STATELESS: no persiste una `ImportacionCartera`.** ✅
Ese modelo existe para **reanudar** cargas de cientos de filas donde cada una crea propiedad +
propietario + inquilino + contrato + liquidaciones. Una planilla de morosos es un orden de
magnitud más chica y más barata por fila. Además, agregarle una columna `tipo` a esa tabla habría
pedido una migración sobre producción — que en este entorno no se puede aplicar, así que la
feature habría nacido muerta hasta que alguien la corriera a mano.

Consecuencia aceptada y acotada: la matriz parseada viaja de vuelta al server en validar y
confirmar. Por eso el tope es de **500 filas** y no 2000 — el body limit por defecto de Fastify
es 1 MiB, y un 413 opaco a mitad del wizard sería peor que un tope explícito. Las filas que
vuelven del cliente se **re-parsean y re-validan** en el servidor: la preview es un preview, no
una autorización.

## 6. Criterios de aceptación

- **AC-1** · Camila sube una planilla con N morosos históricos y quedan cargados.
- **AC-2** · Reporte por fila: cuáles entraron, cuáles fallaron y **por qué**, sin que una fila
  mala tire abajo toda la importación.
- **AC-3** · Dedup de personas **dentro de la misma planilla**: si el mismo DNI aparece en dos
  filas (dos deudas distintas del mismo señor), es UNA Persona con dos contratos históricos, no
  dos Personas.
- **AC-4** · Dedup contra lo que ya existe: si el DNI ya está en la cartera, se une a esa ficha.
  El resumen final dice cuántas se unieron y cuántas se crearon.
- **AC-5** · La propiedad **nunca** cambia de `contratoActualId` ni de estado, aunque la planilla
  traiga cinco filas de la misma propiedad.
- **AC-6** · Multi-tenant: toda fila resuelve propiedad y persona scopeadas por `inmobiliariaId`.
- **AC-7** · Mismo gate de permisos que `POST /contratos/historico`: ADMIN u OPERADOR. Está
  creando deuda a escala.
- **AC-8** · Se puede ver qué se va a importar **antes** de confirmar (si el importador actual ya
  tiene preview, reusarlo; si no, no inventar uno nuevo en esta tarea).
- **AC-9** · `tsc` en 0 y tests puros verdes, incluidos los nuevos.

## 7. Qué NO se puede romper

- La importación de cartera existente (contratos ACTIVO): es el mismo código.
- `POST /contratos/historico` y sus 8 tests.
- El alta normal de contratos y su 409 cuando la propiedad está ocupada.
- El devengo: un contrato histórico nace FINALIZADO y el cron no lo toca.
