# Los PRs abiertos: orden de merge, probado

Hay **50 PRs abiertos**: 36 de esta sesión y **14 que ya estaban**. Se probaron los dos grupos, y
no dan lo mismo.

## Los 36 de esta sesión: mergean y el árbol queda verde

Merge real, en un worktree aparte, y todo corrido sobre el resultado.

| | |
|---|---|
| Conflictos en **código** | **1** — dos líneas de import |
| Conflictos en documentación | 5, todos *"quedate con los dos lados"* |
| `tsc --noEmit` api y panel | **0 errores** |
| Suite `sin-db` | **80 archivos / 742 tests** ✅ |
| Suite `con-db` con `UPLOADS_AMBITO=on` | **73 ok + 1 skip / 530 tests** ✅ |
| `vitest` del panel | **14 archivos / 96 tests** ✅ |
| `next build` panel y PWA | **OK** ✅ |

El skip es `backfill-mascotas-propiedad.test.ts`, que ya se saltea en `main`.

## 🔴 Los 14 que ya estaban: 11 conflictúan, y NO es por esta sesión

Se probaron contra `main` **solo**, sin nada de esta tanda.

| Entran limpios | Ya chocaban con `main` |
|---|---|
| **#7** páginas legales · **#38** instalar app · **#51** corregir borrador | #4 · #5 · #37 · #39 · #41 · #44 · #45 · #46 · #47 · #48 · #49 |

**Hay que rebasarlos igual**: estaban rotos antes. Todos chocan sobre los mismos archivos
calientes —`core.ts`, `plata.ts`, `contratos/nuevo/page.tsx`—, y **#37 es el peor, con 11
archivos**. Cuanto más esperen, peor.

---

## El orden

Se puede mergear en cualquier orden sin romper nada, pero éste minimiza conflictos y respeta las
dependencias.

### 1. La única dependencia real

**#74 va antes que #76.** #74 declara `onDelete: Restrict` explícito en
`movimientos_caja.propiedadId` para frenar una deriva que ya existía en `main`; la migración de
#76 fue despojada a mano de ese mismo cambio. Si #76 entra primero, la deriva sigue viva.

### 2. Los apilados, en su orden

- **#78 → #95** (#95 retira una excepción que #78 declara)
- **#80 → #84**
- **#91 → #92 → #101 → #102 → #103**

Los hijos se reapuntan solos a `main` cuando entra el padre.

### 3. El resto

`#69` · `#77` · `#87` · `#93` · `#88` · `#89` · `#90` · `#94` 🔴 · `#104` · `#97` · `#79` ·
`#96` 🟡 · `#98` · `#72` 🟡 · `#71` 🟡 · `#81` · `#82` · `#86` · `#100` · `#99` · `#83` 🟡 ·
`#73` · `#75` 🟡 · `#70` · `#85`

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

> ⚠️ **Ojo con resolverlo automático.** Resolver con `git checkout --theirs` **descarta el cambio
> de #90 en `core.ts`**: el árbol queda verde y **sin** la extracción de `liqVencida`. Un verde
> incompleto es peor que un rojo. Los números de arriba salen de resolverlo a mano.

### 🟡 Los cinco de documentación

Siempre el mismo caso: dos PRs que agregan texto en el mismo lugar de un `.md`, sin que ninguno
borre nada del otro. **Quedate con los dos lados.**

- `PROMPT-UNA-TAREA-A-LA-VEZ.md` — #78, #83, #75 y #96 insertan trampas nuevas antes de la misma
  línea.
- `BACKLOG-VERIFICADO.md` — #72 y #71 tocan entradas de tickets vecinas.

---

## Cómo se verificó

```bash
git worktree add --detach /tmp/wt origin/main
# merge de los 36 en el orden de arriba; el de código a mano, los .md por unión
```

Después, sobre ese árbol: `tsc` en api y panel, las dos suites de la API con `UPLOADS_AMBITO=on`
sobre una base recreada desde cero, el `vitest` del panel y `next build` de los dos fronts.

**Lo que esto agrega sobre el CI:** cada PR tiene su verde, pero ese verde es *contra `main`* —
ninguno prueba el árbol con los otros treinta y cinco adentro. Esto sí.

**Lo que no prueba:** `main` no tiene branch protection, así que nada de esto se aplica solo.
