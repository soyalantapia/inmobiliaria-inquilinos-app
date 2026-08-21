# T-01-N1-N15 — Los límites del guard de prorrateo, y la documentación que quedó mintiendo

**Origen:** barrido `invariantes-ejecutables` sobre el árbol, disparado después de T-01-N1-N14.

## De qué se trata

T-01-N1-N14 unificó la regla de prorrateo en `packages/shared/src/prorrateo.ts` y dejó un test
que falla si aparece otra copia. El barrido posterior levantó tres cosas. **Una era cierta y ya
no lo es, y las otras dos NO eran bugs.** Lo que sí quedó para arreglar es la documentación que
esos cambios dejaron desactualizada, y el punto ciego del guard, que era real y no estaba dicho.

## Hallazgos, uno por uno, con el veredicto verificado

### 1. "El test prometido no existe" — CIERTO AL LEERLO, YA NO

El barrido leyó el árbol **mientras yo lo estaba cambiando**. Verificado contra el remoto:

```
git ls-tree -r --name-only origin/main | grep -c "prorrateo-sin-copias"  →  1
```

No hay nada que hacer. Se anota porque es el modo de fallar típico de un barrido concurrente:
un hallazgo verdadero en el instante de la lectura y falso diez minutos después.

### 2. `dashboard-helpers.ts:61` comisiona sin capear — NO ES BUG, ES DELIBERADO

```ts
const comisionMes = Math.round(cobrado * COMISION_DEFAULT);
```

Sin cap y sin prorrateo, con tasa fija. Está **documentado como decisión** en
`lib/api/hooks.ts:1557`: *"En el demo se mantiene el 0.08 fijo (parity byte-for-byte)"*, y
`:1583` dice que el camino con API espeja a propósito al `calcularDashboardStats` del demo.
Cambiarlo rompería la paridad que alguien eligió sostener. **No se toca.**

### 3. `cierre-caja.ts:191` no tiene rama PARCIAL — NO ES BUG, ES INALCANZABLE

```ts
if (liq.periodo === mes && liq.estado === 'PAGADO') {
  cobradoMes += liq.montoTotal;
  alquilerCobradoMes += liq.montoAlquiler;   // entero, sin capear ni prorratear
}
```

Parece que un pago parcial aporta 0. Pero la única fuente de esas liquidaciones es
`generarLiquidaciones`, que emite **`PAGADO | PENDIENTE | VENCIDO` y nunca `PARCIAL`**
(`mock-data.ts:1058-1068`), y sus **cinco** callers la usan cruda, sin overlay que le cambie el
estado. Sin PARCIAL no hay pago partido que dropear.

> **Pero la seguridad acá descansa en el GENERADOR, no en el consumidor.** Eso es una premisa
> tácita, y las premisas tácitas son justo lo que este trabajo viene convirtiendo en tests.

## Qué se hace

1. **Tripwire ejecutable** (`apps/inmobiliaria/src/lib/cierre-caja.test.ts`): fija que
   `generarLiquidaciones` no emite `PARCIAL`. El día que alguien enriquezca el demo con un pago
   parcial —algo razonable de querer hacer— `efectivoEnMano` empezaría a contar ese mes como 0
   de alquiler cobrado **en silencio**. Con esto se entera por un rojo que le dice qué usar.
2. **Decir el punto ciego del guard** en `prorrateo-sin-copias.test.ts`: busca el *esqueleto* de
   la fórmula, así que una copia que aplique la regla por omisión se le escapa entera. Se anotan
   los dos candidatos revisados **con su evidencia**, para que nadie los persiga de nuevo.
3. **`invariantes-plata.md`**: la tabla del invariante #1 apunta a tres líneas y tres fórmulas
   inline que ya no existen. Se marca en vez de reescribirse, porque el punto es ese: tres
   números de línea a mano, los tres podridos en semanas.
4. **`alquiler-cobrado.test.ts`**: el docstring decía que `formulaDelServer` "replica lo que hace
   `plata.ts`". Ya no — `plata.ts` es un consumidor más del helper compartido.

## Lo que NO se hace

- No se toca `dashboard-helpers.ts` (decisión deliberada ajena).
- No se toca `cierre-caja.ts` (la rama es inalcanzable; agregarla sería código muerto, y el
  tripwire avisa si deja de serlo).

## Verificación

- Los tests corren y pasan.
- El tripwire se verifica **en rojo** forzando a `generarLiquidaciones` a emitir un `PARCIAL`.
- `tsc` en 0 en los paquetes tocados.

---

## Hallazgo 4 (apareció verificando, y es sobre mi propio trabajo)

**`pnpm test:sin-db` no era self-contained: daba 3 rojos en un worktree limpio.**

Al correr la partición en un worktree recién creado, 3 tests de `sonar-correlacion.test.ts`
—que no toqué— fallaron con `ZodError: DATABASE_URL Required, JWT_SECRET Required`.

Varios de esos tests hacen `buildApp()`, y `src/env.ts` valida el entorno con zod **al
importarse**. Sin esas dos variables tira antes del primer assert.

**Por qué nunca se notó:** los dos únicos lugares donde se corría lo tapaban.

| Dónde | Qué lo tapaba |
|---|---|
| CI, job `revision` | inyecta las dos variables a mano (`revision.yml:35-37`) |
| Worktree de trabajo | tiene un `apps/api/.env` sin trackear |

Un worktree limpio no tiene ninguno de los dos. O sea: **cualquiera que clone hoy y corra la
suite rápida se come 3 rojos que no tienen nada que ver con su cambio.** Ése es exactamente el
rojo que entrena a la gente a ignorar los rojos, y lo dejé yo al armar la partición.

**Arreglo:** `vitest.sin-db.config.ts` declara un `ENTORNO_MINIMO` con los mismos valores
inservibles que ya usaba CI. No pisa lo que venga del entorno (`process.env.X ?? default`), así
que un `.env` local sigue mandando. La URL apunta al puerto 1 de loopback a propósito: si algún
día un test de esta partición intenta conectarse de verdad, falla rápido y ruidoso en vez de
encontrar una base y ensuciarla.

**Verificación:** `sonar-correlacion.test.ts` pasa 28/28 en un worktree **sin** `.env`.

---

## Hallazgo 5 — la verificación en el orden equivocado (error de proceso, mío)

El primer push de esta tarea **rompió CI** en `revision`, con tres errores TS18048 en
`test/modo-cobranza-pago-en-vuelo.test.ts` — un archivo que no toqué.

No fue un merge conflictivo ni un test flaky. Fue el orden:

```
tsc --noEmit   → 0        # ✅ verificado
git rebase origin/main    # ⬅️ la base cambió ACÁ
git push                  # ❌ pusheé algo que nunca typechequeé
```

Entre mi `tsc` y mi `push`, el PR #56 (`chore/typecheck-tests`) encendió
`noUncheckedIndexedAccess` para `test/`. Mi rama heredó la severidad **sin** heredar
`cbfd4c04`, el commit que arregla el archivo que esa severidad rompe. `main` nunca estuvo rojo:
allá los dos commits llegaron juntos.

> **La regla que sale de acá: en este repo el `tsc` verde vale para el árbol que tenías, no para
> el que vas a pushear.** Con ~40 chats en paralelo la base se mueve entre dos comandos. La
> verificación va **después** del último rebase, no antes — y si rebaseás de nuevo, se repite.

Se rebaseó sobre `main` actual y se reverificó en ese orden: `tsc` 0 en los 5 paquetes,
**653/653** sin base, los tres fronts en verde.
