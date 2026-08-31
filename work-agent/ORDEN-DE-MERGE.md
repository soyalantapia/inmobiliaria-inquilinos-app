# Los 16 PRs abiertos: orden de merge, probado

**Los 16 mergean sin un solo conflicto de código, y el árbol resultante está en verde.** No es una
estimación: se hizo el merge de verdad, en un worktree aparte, y se corrieron las dos suites sobre
el resultado.

| | |
|---|---|
| Conflictos en código | **0** |
| Conflictos en documentación | 4, todos "quedate con los dos lados" |
| `tsc --noEmit` sobre el árbol mergeado | **0 errores** |
| Suite `sin-db` | **78 archivos / 729 tests** ✅ |
| Suite `con-db` con `UPLOADS_AMBITO=on` | **66 archivos ok + 1 skip / 489 tests** ✅ |

El skip es `backfill-mascotas-propiedad.test.ts`, que ya se saltea en `main`.

---

## El orden

Se puede mergear en cualquier orden y no se rompe nada, pero **este orden minimiza los conflictos
de documentación** (los deja en 4 y todos triviales) y respeta las dos dependencias reales.

### Primero: las dos que tienen dependencia real

| # | Qué es | Por qué va acá |
|---|---|---|
| **#74** | `MovimientoCaja` gana `cargoId` | **Va antes que #76.** Declara `onDelete: Restrict` explícito en `movimientos_caja.propiedadId` para frenar una deriva que ya existía en `main`. La migración de #76 fue despojada a mano de ese mismo cambio; si #76 entra primero, la deriva sigue viva y la próxima migración la vuelve a arrastrar. |
| **#76** | `Propietario.emailVerificadoAt` | Después de #74. |

### Después: el resto, en este orden

| # | Qué es | Choca con |
|---|---|---|
| **#69** | T-61 · el ajuste posterior a una renovación | — |
| **#77** | T-73 · aislar el test de emisión del OTP | — |
| **#72** | T-51 · los mails de demo a `@example.com` | 🟡 backlog |
| **#71** | T-34 · borrar `payment-hero.tsx` | 🟡 backlog |
| **#78** | T-11 · CARGA no cambia el login del inquilino | — |
| **#79** | T-19 · el pago va unificado | — |
| **#80** | T-20 · consorcio de régimen mixto | — |
| **#84** | T-20-a · el 409 de la rendición | **apilado sobre #80** — se reapunta solo a `main` cuando #80 entra |
| **#81** | T-13 · las cuentas ya estaban adentro de caja | — |
| **#82** | T-22 · relevamiento del consorcio | — |
| **#83** | T-23-N3-N1 · la migración ya estaba aplicada | 🟡 prompt |
| **#73** | T-21-N3-N1 · la contradicción ya no existe | — |
| **#75** | prompt · la base local acumula entre tareas | 🟡 prompt |
| **#70** | `PARA-ALAN.md` · las preguntas del cierre de caja | — |

---

## Los cuatro conflictos, y cómo se resuelven

Los cuatro son **el mismo caso**: dos PRs que agregan texto en el mismo lugar de un `.md`. Ninguno
borra nada del otro. **La resolución siempre es quedarse con los dos lados.**

**`work-agent/PROMPT-UNA-TAREA-A-LA-VEZ.md`** — #78, #83 y #75 insertan una trampa nueva justo
antes de la misma línea (*"El CI reporta, no frena"*). Las tres viñetas van, en cualquier orden.

**`work-agent/BACKLOG-VERIFICADO.md`** — #72 y #71 tocan entradas de tickets vecinas y la misma
línea de la tabla de arriba. Las dos ediciones van.

---

## Cómo se verificó

```bash
git worktree add --detach /tmp/wt origin/main
cd /tmp/wt
# merge de los 16 en el orden de arriba, resolviendo los 4 .md por unión
```

Después, sobre ese árbol: `tsc --noEmit`, la suite `sin-db` completa y la suite `con-db` completa
con `UPLOADS_AMBITO=on`, sobre una base recreada desde cero y migrada con `prisma migrate deploy`.

**Lo que esto agrega sobre el CI:** cada PR tiene su propio verde, pero ese verde es *contra `main`*
— ninguno prueba el árbol con los otros quince adentro. Esto sí.

**Lo que esto NO prueba:** el job `build` (que compila los fronts con `next build`) no se corrió acá;
lo corre la CI de cada PR y los 16 lo tienen en verde. Y `main` no tiene branch protection, así que
nada de esto se aplica solo: el orden hay que respetarlo a mano.
