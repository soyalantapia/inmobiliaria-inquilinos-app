# T-01-N1-N8 · La compuerta tipaba y testeaba, y no compilaba nada

**Prioridad:** 🟠 · **Experto:** OPS
**Origen:** revisar la propia compuerta (T-01-N1 → T-01-N1-N1-N1) buscándole el punto ciego.

---

## El hueco

El job que **bloquea** hacía cuatro cosas: `prisma generate`, `pnpm typecheck`, los tests sin
base y los tests de los fronts. **No compilaba nada** — ni la API ni ninguno de los tres fronts.

`tsc --noEmit` no ve lo que ve `next build`. Next tiene chequeos propios que no son de tipos:
restricciones de `output: export`, `generateStaticParams` faltante en una ruta dinámica, cruces
server/client, route handlers mal formados.

**No es teórico.** El `Deploy to GitHub Pages` de `main` estuvo en **failure del 3 al 19 de
agosto** —dos semanas y media— por un `/inquilinos/[id]` sin `generateStaticParams()`. Ningún
typecheck lo iba a agarrar, y nadie lo miraba.

Y hoy pesa más que entonces: **el push a `main` deploya producción**. Un error de build recién
se manifiesta cuando el deploy ya salió.

## Lo que se hace

Un job `build` **aparte** —para que corra en paralelo y no le sume minutos al feedback rápido de
typecheck + tests— que compila los **dos caminos**, porque son modos distintos y rompen por
razones distintas:

| camino | cómo | qué protege |
|---|---|---|
| **Producción** | `next build` pelado, sin `STATIC_EXPORT` | Es como buildean los Dockerfiles de Railway: `admin.myalquiler.com`, `app.myalquiler.com` y el portal del propietario, que se sirve dentro de la imagen del panel. **No se verificaba en ningún lado antes del deploy.** |
| **Demo** | `bash scripts/build-static.sh` | Static export a GitHub Pages. Es el que estuvo roto dos semanas y media. Hace además el baile de renombrar los `middleware.ts`, que no existen en export. |

Se llama `next build` directo y no `pnpm build`: el script de cada front antepone
`check-dev-port.js`, que existe para no pisarle el dev server a nadie. En CI no hay ninguno y el
guard sólo agrega una forma de fallar.

## Lo que NO se hace

- **No se toca `deploy.yml`.** Sigue siendo el workflow del dueño.
- **No se arregla el build del panel en Windows** (T-02-N2). Es otro problema: `@vercel/og`
  revienta con `fileURLToPath` sobre una ruta `file:///C:/…`. En Linux compila, y este job lo
  fija en cada push — con lo cual el de Windows pasa de "nadie puede verificar el panel antes de
  pushear" a incomodidad local.

## Cómo se verifica

- Build de la API en local: **exit 0**.
- Los tres fronts **no se pueden buildear en esta máquina** (ver T-02-N2), así que la
  verificación real es la corrida del job en Actions, sobre Linux, que es donde tiene que andar.
