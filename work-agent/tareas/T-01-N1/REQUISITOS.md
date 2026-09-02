# T-01-N1 · Nadie corre los tests. Ni el compilador.

**Origen.** Salió de verificar T-01 (contar las migraciones pendientes). Al mirar
`.github/workflows/` para ver qué se dispara solo, apareció esto.

---

## Lo que se verificó, hoy, en el código

### 1. El único workflow de CI es el deploy de la demo

`.github/workflows/deploy.yml` es lo único que hay. Corre en push a `main`, hace
`pnpm install`, `bash scripts/build-static.sh`, y publica a GitHub Pages.

**No corre `tsc`. No corre `lint`. No corre un solo test.**

Hay **725 tests escritos** en `apps/api/test/` (85 archivos). Ninguno se ejecuta solo,
nunca, en ningún momento. La única vez que corren es si una persona se acuerda.

### 2. `pnpm typecheck` en la raíz **se saltea la API**

`turbo run typecheck` corre la tarea `typecheck` de cada paquete que la tenga:

| paquete | ¿tiene script `typecheck`? |
|---|---|
| `apps/inmobiliaria` | sí |
| `apps/inquilino` | sí |
| `apps/propietario` | sí |
| `packages/ui` | sí |
| **`apps/api`** | **NO** — lo tiene con el nombre `lint` |
| `packages/shared` | no tiene ningún script |
| `packages/config` | no tiene ningún script |

Verificado con `turbo run typecheck --dry=json`, que antes del cambio listaba
`api :: <NONEXISTENT>`.

`apps/api/package.json` declara `"lint": "tsc --noEmit"`. O sea: el chequeo existe, pero
está con el nombre cambiado. Quien corre `pnpm typecheck`, ve verde, y concluye que
compila todo, **no chequeó el paquete donde vive la plata**.

(`packages/shared` sí queda cubierto de rebote: exporta `.ts` crudo, así que el `tsc` de
cualquier front que lo importe lo arrastra. No es un hueco real. Se anota para que no lo
parezca.)

### 3. Por qué esto importa hoy y no en abstracto

Hoy varios chats trabajaron en paralelo en worktrees separados y fueron mergeando a la
misma rama. Eso produjo **ocho regresiones cruzadas**, encontradas en tres pases manuales
distintos — commits `00fc8a3` (tres), `7346ca8` (dos), `4f59794` (tres).

Las ocho las encontró alguien mirando. Ninguna la encontró una máquina, porque no hay
ninguna máquina mirando. Ese es el agujero: el patrón "cada rama compila sola y la unión
rompe algo" es *exactamente* lo que una compuerta de CI ataja, y es el único tipo de bug
que ninguna de las dos ramas puede detectar por su cuenta.

### 4. De los 725 tests, ¿cuántos se pueden correr sin una base de datos?

Medido, no estimado:

- **49 de 85 archivos importan `seedBase`**, que siembra destructivamente una Postgres
  remota **compartida**. Esos no pueden correr en CI (ni acá) sin una DB propia.
- Otros **tres** dependen de una base sin pasar por `seedBase`, y hubo que descubrirlos
  corriéndolos, no leyéndolos:
  - `soporte.test.ts` y `backfill-mascotas-propiedad.test.ts` se siembran solos con
    `new PrismaClient()`. El primero lo explica en su propio encabezado: `requireUsuario`
    revalida contra la tabla en cada request, así que un JWT inventado da 401 y nunca
    llega al chequeo de rol que el archivo quiere probar. Necesita filas de verdad.
  - `health.test.ts` no escribe nada, pero uno de sus casos se llama literalmente
    *"responde ok con la DB arriba"* y afirma `body.db === 'up'`.
- Quedan **33 archivos** que corren sin ninguna base, dándoles un `DATABASE_URL` y un
  `JWT_SECRET` cualquiera: no se conectan, sólo necesitan que el `EnvSchema` de
  `src/env.ts` valide (son los dos únicos campos obligatorios).

**Resultado medido: 341 tests en verde, exit 0, en 7 segundos, sin ninguna base de datos.**
Contra los 122 segundos y 52 archivos que ni cargan de la corrida completa. Bajan de 122s
a 7s porque sin base compartida se puede volver a activar `fileParallelism`, que la config
principal apaga a propósito.

---

## Lo que se hace

1. **`apps/api/vitest.sin-db.config.ts`** — la lista de archivos no se escribe a mano: se
   calcula leyendo `test/` y descartando los que importan `seedBase`. Un test nuevo con
   base queda afuera solo, sin que nadie se acuerde de agregarlo a una lista.
2. **`apps/api/package.json`** — se agrega `test:sin-db` (para CI y para el loop local de
   36s) y `typecheck` (para tapar el hueco 2). `lint` se deja como está: hay scripts y
   quizá costumbres que lo llaman.
3. **`.github/workflows/revision.yml`** — la compuerta: `typecheck` de los cinco paquetes
   + los 344 tests. En cada push y en cada PR.

## Lo que NO se hace, y por qué

- **No se corren los tests con base en CI.** Se podría, con un service container de
  Postgres — es la forma correcta y sería un salto grande (los tests de plata están ahí).
  Pero eso es la decisión de infraestructura que está abierta en **T-28** y que no es mía.
  Queda anotado como **T-01-N1-N1**, con el detalle de lo que haría falta.
- **No se toca `deploy.yml`.** Sumarle un gate al deploy es tocar cómo se publica, y eso
  es del dueño. La compuerta nueva es un workflow aparte que no bloquea nada todavía.
- **No se agrega ninguna dependencia.**
- **No se modifica ningún test.**

## Cómo se verificó (hecho, no planeado)

- **341 tests, 33 archivos, exit 0, 7 s**, con env dummy y sin ninguna base.
- **`tsc --noEmit` da 0 en los cinco paquetes** que tienen la tarea: `api`,
  `inmobiliaria`, `inquilino`, `propietario`, `ui`.
- **`prisma generate` con `--filter api`** corre. (El paquete se llama `api` a secas, no
  `@llave/api` como los demás: la primera versión del workflow decía `@llave/api` y
  fallaba con *"No projects matched the filters"*. Se encontró corriéndolo.)
- **La compuerta ataja una regresión real de hoy.** Se revirtió el fix de
  `importacion-morosos.ts` del commit `4f59794` —una de las ocho regresiones cruzadas—
  dejando su test en su lugar: `test:sin-db` dio **exit 1 con 3 tests en rojo, en 7
  segundos**. Restaurado el fix, vuelve a exit 0. O sea: no es una compuerta decorativa,
  ataja el tipo de bug exacto que motivó la tarea.
- El YAML no tiene tabs, no tiene CRLF, y sus claves top-level son las cuatro esperadas.

## Lo que no puedo verificar

**No puedo correr GitHub Actions.** El YAML lo verifico como sintaxis y verifico cada
comando que ejecuta, uno por uno, acá. Que el runner de Ubuntu haga exactamente lo mismo
que esta máquina no lo puedo probar hasta que corra por primera vez.
