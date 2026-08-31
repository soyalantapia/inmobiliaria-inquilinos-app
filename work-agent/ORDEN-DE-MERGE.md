# Los PRs abiertos: orden de merge, probado

Hay **40 PRs abiertos**: 31 de esta sesión y **9 que ya estaban**. Se probaron los dos grupos, y
no dan lo mismo.

## Los 31 de esta sesión: mergean y el árbol queda verde

No es una estimación: se hizo el merge de verdad, en un worktree aparte, y se corrió todo sobre el
resultado.

| | |
|---|---|
| Conflictos en **código** | **1** — dos líneas de import |
| Conflictos en documentación | 5, todos *"quedate con los dos lados"* |
| `tsc --noEmit` api y panel | **0 errores** |
| Suite `sin-db` | **80 archivos / 742 tests** ✅ |
| Suite `con-db` con `UPLOADS_AMBITO=on` | **72 ok + 1 skip / 526 tests** ✅ |
| `vitest` del panel | **11 archivos / 74 tests** ✅ |
| `next build` del panel | **OK (74/74 páginas)** ✅ |

El skip es `backfill-mascotas-propiedad.test.ts`, que ya se saltea en `main`.

## 🔴 Los 9 que ya estaban: 8 conflictúan, y NO es por esta sesión

Se probó contra `main` **solo**, sin nada de esta tanda: **los ocho ya chocaban**. Están viejos.

| PR | Contra `main` solo | Con los 31 adentro |
|---|---|---|
| **#51** Corregir la vigencia de un borrador | ✅ entra | ✅ entra |
| #39 Alta de contrato en pasos | 🔴 | 🔴 (+0 archivos) |
| #41 Revisión antes de aprobar | 🔴 | 🔴 (+0) |
| #44 Aprobación con contexto | 🔴 | 🔴 (+0) |
| #45 Cobro manual del operador | 🔴 | 🔴 (+0) |
| #46 Avisar el ajuste al inquilino | 🔴 | 🔴 (+0) |
| #47 Semáforo de DNI | 🔴 | 🔴 (+`propiedad-timeline.ts`) |
| #48 Integración alta + deuda | 🔴 | 🔴 (+`propiedad-timeline.ts`) |
| #49 Corregir contrato rechazado | 🔴 | 🔴 (+0) |

Todos chocan sobre los mismos tres archivos calientes: `core.ts`, `plata.ts` y
`contratos/nuevo/page.tsx`. **Hay que rebasarlos igual**, y mergear esta tanda sólo les agrega un
archivo a dos de ellos. Cuanto más esperen, peor.

---

## El orden

Se puede mergear en cualquier orden y no se rompe nada, pero **éste minimiza los conflictos** y
respeta las dependencias reales.

### 1. Las dos con dependencia real

| # | Qué es | Por qué acá |
|---|---|---|
| **#74** | `MovimientoCaja` gana `cargoId` | **Va antes que #76.** Declara `onDelete: Restrict` explícito en `movimientos_caja.propiedadId` para frenar una deriva que ya existía en `main`. La migración de #76 fue despojada a mano de ese mismo cambio; si #76 entra primero, la deriva sigue viva. |
| **#76** | `Propietario.emailVerificadoAt` | Después de #74. |

### 2. Los apilados, en su orden

- **#78** → **#95** (#95 retira una excepción que #78 declara)
- **#80** → **#84**
- **#91** → **#92**

Los tres hijos se reapuntan solos a `main` cuando entra el padre.

### 3. El resto

`#69` · `#77` · `#72` 🟡 · `#71` 🟡 · `#87` · `#93` · `#88` · `#89` · `#90` · `#94` 🔴 · `#97` ·
`#79` · `#96` 🟡 · `#98` · `#81` · `#82` · `#86` · `#99` · `#83` 🟡 · `#73` · `#75` 🟡 · `#70` ·
`#85`

---

## Los seis conflictos, y cómo se resuelven

### 🔴 El único de código: #94 contra #90

Los dos agregan **un import** al mismo bloque de `apps/api/src/routes/core.ts`:

```
<<<<<<< HEAD
import { liqQueDefineEstado, liqVencida } from '../lib/estado-de-pago.js';
=======
import { sim } from '../lib/simbolo-moneda.js';
>>>>>>>
```

**La resolución son las dos líneas.** Nada más.

> ⚠️ **Ojo con resolverlo automático.** En la primera pasada resolví todos los conflictos con
> `git checkout --theirs`, y para éste eso **descarta el cambio de #90 en `core.ts`** — el árbol
> queda verde y **sin** la extracción de `liqVencida`. Un verde incompleto es peor que un rojo.
> Los números de arriba salen de resolverlo a mano.

### 🟡 Los cinco de documentación

El mismo caso siempre: dos PRs que agregan texto en el mismo lugar de un `.md`, sin que ninguno
borre nada del otro. **La resolución es quedarse con los dos lados.**

- `work-agent/PROMPT-UNA-TAREA-A-LA-VEZ.md` — #78, #83, #75 y #96 insertan trampas nuevas antes de
  la misma línea.
- `work-agent/BACKLOG-VERIFICADO.md` — #72 y #71 tocan entradas de tickets vecinas.

---

## Cómo se verificó

```bash
git worktree add --detach /tmp/wt origin/main
# merge de los 31 en el orden de arriba; el de código a mano, los .md por unión
```

Después, sobre ese árbol: `tsc` en api y panel, las dos suites de la API con `UPLOADS_AMBITO=on`
sobre una base recreada desde cero, el `vitest` del panel y `next build`.

**Lo que esto agrega sobre el CI:** cada PR tiene su verde, pero ese verde es *contra `main`* —
ninguno prueba el árbol con los otros treinta adentro. Esto sí.

**Lo que no prueba:** `main` no tiene branch protection, así que nada de esto se aplica solo. El
orden hay que respetarlo a mano.
