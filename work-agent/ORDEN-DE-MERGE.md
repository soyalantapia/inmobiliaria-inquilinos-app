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

---

# Segunda corrida: ahora son 45 (01/09, madrugada)

Entraron **9 PRs más** —los arreglos de la tercera auditoría (#105 a #113)— y se volvió a
mergear **todo desde cero** sobre `main`. `main` no se movió desde la corrida anterior, así
que esto reemplaza a los números de arriba, no los complementa.

| | |
|---|---|
| PRs mergeados | **45** (#69 a #113) |
| Conflictos en **código** | **2** |
| Conflictos en documentación | varios, todos *"quedate con los dos lados"* |
| `tsc --noEmit` api · panel · PWA · portal | **0 errores** en los cuatro |
| Suite `sin-db` | **81 archivos / 748 tests** ✅ |
| Suite `con-db` con `UPLOADS_AMBITO=on` | **79 ok + 1 skip / 563 tests** ✅ |
| `vitest` del panel | **16 archivos / 117 tests** ✅ |
| `next build` panel y PWA | **OK** ✅ |

El skip sigue siendo `backfill-mascotas-propiedad.test.ts`, que ya se saltea en `main`.

## 🔴 La corrida encontró un defecto que ninguna rama veía

`el-default-de-mora-viaja-con-su-moneda.test.ts` (de **#108**) tipaba `monedaOriginal` como
`'ARS' | 'USD'`, pero `Inmobiliaria.monedaDefault` es `String` en el schema. **`tsc` en rojo.**

No lo agarró el CI de esa rama porque el typecheck se había corrido **antes** de escribir ese
archivo, y después sólo se corrió el test: **vitest transpila sin chequear tipos**, así que el
test pasaba en verde con `tsc` roto. Ya está arreglado y pusheado a #108.

Es el argumento de este documento en una línea: **cada PR tiene su verde contra `main`, y
ninguno prueba el árbol con los otros cuarenta y cuatro adentro.**

## Los dos conflictos de código

### 1 · `apps/api/src/routes/core.ts` — #94 contra #90

El mismo de la corrida anterior. #90 saca `liqVencida` y `liqQueDefineEstado` a
`lib/estado-de-pago.js`; #94 agrega el import de `lib/simbolo-moneda.js`. Chocan en el bloque
de imports.

**Resolución: los DOS imports, y las funciones inline NO vuelven.**

> ⚠️ Resolver con `git checkout --theirs` **descarta el cambio de #90**: el árbol queda verde
> y **sin** la extracción. Un verde incompleto es peor que un rojo.

Verificación después de resolver: `grep -c "function liqVencida" apps/api/src/routes/core.ts`
tiene que dar **0**.

### 2 · `apps/inmobiliaria/src/lib/auditoria-labels.ts` — #106 contra #113 (nuevo)

Los dos agregan valores al enum `TipoEventoAuditoria` y su rótulo en castellano: #106 suma
`CONTRATO_DADO_DE_BAJA`, #113 suma `EQUIPO_REINCORPORADO` y `EQUIPO_ROL_CAMBIADO`. Tres hunks,
en `TIPO_LABEL` y en `TIPO_VARIANT`.

**Resolución: los dos lados, en los tres hunks.** Son entradas independientes de un mapa.

Verificación después de resolver: los **tres** valores tienen que aparecer **dos veces** cada
uno (una en `TIPO_LABEL` y otra en `TIPO_VARIANT`).

Las migraciones **no** chocan (son archivos distintos) y el `schema.prisma` tampoco: los
valores se insertaron en anclas distintas del enum a propósito.

## Sobre por qué esto importa: el test que lo obliga

`auditoria-labels.test.ts` **lee el `schema.prisma` real** y exige un rótulo en castellano por
cada valor del enum. Si el conflicto se resuelve mal —quedándose con un solo lado— ese test se
pone rojo y nombra el valor que falta. Es la red que hace que este conflicto no se pueda
resolver a medias en silencio.

## 🔴 #77 va PRIMERO, y ahora hay evidencia

El flake que arregla #77 —`portal-propietario-e2e.test.ts`, el caso "el código igual se emite"—
se llevó **tres de las seis corridas rojas del 01/09**, y **dos de las tres fueron en ramas que
sólo tocan un `.md`**:

| rama | conteo |
|---|---|
| `docs/dos-promesas-que-el-codigo-no-cumple` (#99) — **sólo `.md`** | esperaba 1, vio **3** |
| `docs/orden-de-merge-verificado` (#85) — **sólo `.md`** | esperaba 1, vio **2** |
| `fix/la-mora-fantasma-que-queda-cobrable` (#108) | esperaba 1, vio **3** |

Que dos ramas de sólo documentación lo disparen cierra la pregunta de si hay un defecto de
producto atrás: no lo hay. (Las otras tres rojas del día sí fueron defectos reales, míos, y ya
están arreglados: el `tsc` de #108 y el rótulo faltante de #106.) Las escrituras del OTP salieron del camino del request a propósito
(para que el reloj no delate qué emails existen), y las del test de temporización aterrizan
**después** del `deleteMany` del caso siguiente.

**Hasta que #77 entre, el verde de cualquier otro PR es "verde salvo que toque".** Con 59 PRs
abiertos, eso es tiempo de alguien mirando un rojo que no es suyo.

## El orden, actualizado

**#77 primero** (ver arriba). Después, los 36 de antes mantienen su orden, y los 9 nuevos van
al final, entre ellos:

`#105` (informe) · `#107` · `#109` · `#110` · `#111` · `#112` · `#108` · `#106` → `#113`

- **#106 antes que #113**, o al revés: da igual, pero **adyacentes**. Los dos tocan el enum de
  auditoría y sus rótulos; ponerlos juntos concentra la resolución en un solo momento.
- **#94 después de #90**, como en la corrida anterior.
- El resto no tiene dependencias entre sí.

## Una trampa nueva del procedimiento

La primera corrida de `con-db` en el worktree dio **75 archivos fallados** y parecía una
regresión enorme. No lo era: al worktree le faltaba `apps/api/.env` —está gitignoreado, así que
no viaja con `git worktree add`— y sin `JWT_SECRET` **`buildApp` explota antes de correr un
solo test**. 547 tests "skipped" no son 547 tests que pasan.

**Antes de creerle a una corrida en un worktree, hay que mirar cuántos tests corrieron de
verdad.** Y el `.env` del worktree tiene que apuntar a **su propia** base, nunca a la del clon
principal ni —jamás— a la de producción.


---

# Tercera corrida: 53 (01/09, tarde)

Entraron los 8 de T-28 y las trampas del prompt (#114 a #121). `main` sigue sin moverse, así
que esto reemplaza a los números de arriba.

| | |
|---|---|
| PRs mergeados | **53** (#69 a #121) |
| Conflictos en **código** | **2** — los dos ya documentados arriba |
| Conflictos en documentación | 6, todos *"quedate con los dos lados"* |
| `tsc --noEmit` api · panel · PWA · portal | **0** en los cuatro |
| Suite `sin-db` | **82 archivos / 758 tests** ✅ |
| Suite `con-db` con `UPLOADS_AMBITO=on` | **84 ok + 1 skip / 594 tests** ✅ |
| `vitest` del panel | **16 archivos / 117 tests** ✅ |
| `next build` panel · PWA · portal | **OK** en los tres ✅ |

**Ningún conflicto nuevo.** Los 8 PRs de T-28 son casi todos archivos de test nuevos, que por
definición no chocan; los dos que tocan fuente (#115 en `saldos.ts` y `resumenes-bancarios.ts`)
no coinciden con ningún otro.

El crecimiento de la red, que es el punto de T-28: la suite con base pasó de **563 a 594**
tests, y la sin base de **748 a 758**.

## El orden, con los nuevos

`#77` **primero** (el flake). Después los 36 originales en su orden, después los 9 de la
tercera auditoría, y al final los de T-28, que no dependen de nada entre sí:

`#116` (informe) · `#115` · `#117` · `#118` · `#119` · `#120` · `#121` · `#114`

**#115 conviene antes que los cinco de test**: es el único que toca fuente, y los tests que
vienen después corren sobre el `saldos.ts` ya corregido.
