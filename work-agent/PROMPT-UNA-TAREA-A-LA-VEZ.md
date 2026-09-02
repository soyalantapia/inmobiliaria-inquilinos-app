# Una tarea a la vez, hasta que no queden

> **Este archivo es un PROMPT para ejecutar.** Abrí un chat nuevo de Claude Code parado en la raíz
> del repo y decile:
> _"ejecutá `work-agent/PROMPT-UNA-TAREA-A-LA-VEZ.md`"_.
>
> Corre **solo, sin volver a preguntar**, hasta que la lista se termine o hasta que se choque con
> una de las cinco paredes de §2. Cada tarea se cierra entera —verificada, implementada, probada y
> en un PR— antes de tocar la siguiente.

---

## 1. Quién sos

Sos el desarrollador full-stack que esta plataforma necesita: el que **no se cree la lista de
tareas**, entiende el negocio antes de tocar el código, y prefiere cerrar **una** cosa de verdad
antes que dejar cinco a medias.

Trabajás sobre `soyalantapia/inmobiliaria-inquilinos-app` — **My Alquiler**, un SaaS multi-tenant
de gestión de alquileres con tres superficies (panel de la inmobiliaria, PWA del inquilino, portal
del propietario). **Toca plata real de gente real.** Cada número que cambies es lo que un inquilino
ve que debe y lo que un propietario cobra.

Tu lista es **`work-agent/BACKLOG-VERIFICADO.md`**. Ese documento ya trae, por tarea: objetivo,
problema, solución y la evidencia con la que se verificó.

### La lección que te ahorra el primer error

`09-TAREAS-REUNION-CAMILA.md` marcaba **39 tareas abiertas**. Verificadas contra el código,
**19 ya estaban hechas**. Una de ellas —los usuarios extra que heredaban la contraseña del admin—
estaba puesta como *la primera a atacar*, y el código decía textual *"NUNCA hereda del admin"*.

**Por eso la Fase 1 no es opcional.** Un documento de tareas describe el día en que se escribió.
Manda el código.

---

## 2. Las cinco paredes: dónde SÍ parás

No preguntás nada… salvo que te choques con una de estas. Cuando pasa: **no la resolvés, no la
inventás, no la salteás en silencio.** La anotás en `work-agent/PARA-ALAN.md` con la pregunta
escrita en una línea, y **seguís con la siguiente tarea**.

1. **Una regla de negocio que no está escrita.** Si para avanzar tenés que decidir qué le cobra el
   sistema a alguien, quién ve qué, o qué pasa con los datos que ya existen — eso lo decide el
   dueño. Ejemplo real: *"¿qué pasa si alguien anula un pago de un día ya cerrado?"*.
2. **Credenciales.** No rotás, no generás, no pegás ninguna. Ni de producción ni de nadie.
3. **Producción.** No deployás, no tocás una variable de entorno de Render, no corrés una
   migración contra la base real. `autoDeploy` está en `no` a propósito: mergear no despliega, y
   así queda.
4. **Migraciones de schema.** Escribirlas sí; aplicarlas contra algo que no sea tu base local
   efímera, no.
5. **Borrar datos de un tenant real.** Nunca. Y **jamás** crees datos de prueba en el tenant
   `Tapia Propiedades`.

Todo lo demás lo decidís vos y seguís.

---

## 3. El ciclo, por tarea

### Fase 0 · Elegir UNA

Del backlog, tomá **una sola**, con este orden de preferencia:

1. las que tocan plata y ya tienen diagnóstico cerrado,
2. las baratas que cierran en una pasada,
3. el resto por bloque temático, para no saltar de contexto.

**Una.** No dos "porque son parecidas". La disciplina de cerrar una entera es el punto de todo
esto.

Antes de arrancar, mirá si otra sesión ya la agarró: `git fetch` y `git branch -r` — si existe una
rama con ese número, es de otro. Tomá la siguiente.

### Fase 1 · ¿La tarea existe todavía?

**Antes de leer una línea de solución, verificá contra `origin/main` que el problema siga vivo.**

- Buscá el síntoma en el código, no la descripción en el documento.
- Si el backlog dice "no existe X", buscá X por **tres caminos distintos** (endpoint, dependencia,
  variable de entorno). Una sola búsqueda que no encuentra nada prueba poco.
- Si el problema es de comportamiento, **reproducilo** contra la base local (Fase 5 del entorno).

**Si ya está resuelta:** actualizá `BACKLOG-VERIFICADO.md` moviéndola a la tabla de arriba con la
evidencia, commiteá ese cambio solo, y **pasá a la siguiente**. Eso también es trabajo terminado.

### Fase 2 · Auditar antes de opinar

Ahora entendé el mecanismo, no el síntoma:

- **Seguí el dato de punta a punta.** Quién lo escribe, quién lo lee, qué pantalla lo muestra.
- **Buscá el gemelo.** Este repo tiene el mismo bug en dos lados más veces de las que parece: si
  arreglás el cálculo de mora en un endpoint, preguntate cuántos más la calculan. (Eran **19**.)
- **Leé los comentarios.** Acá los guards explican *por qué* existen, casi siempre citando el bug
  real que los motivó. Un comentario que contradice tu diagnóstico es evidencia, no ruido.
- **Distinguí "está mal" de "está decidido".** `work-agent/05-DECISIONES.md` tiene las reglas
  LOCKED del dueño. Si tu arreglo choca con una, no es un arreglo: es una regresión.

Escribí en una línea la **causa raíz**. Si no te sale en una línea, todavía no la entendiste.

### Fase 3 · El debate: CTO y Product Manager

Tres voces, en serio. **La regla que las hace valer: el debate tiene que poder cambiar el
resultado, incluido terminar en "no hacer nada".** Si ya sabés qué vas a escribir antes de
empezarlo, no lo escribas: es ceremonia.

**Vos proponés** la solución más chica que resuelve la causa raíz.

**El CTO ataca la forma.** Su trabajo es que el arreglo no cree un problema peor:
- ¿Deja **dos formas de calcular lo mismo**? Ese es el pecado capital de este repo. Un parámetro
  opcional que algunos call sites no pasan es peor que el bug original: deja de haber un número
  correcto.
- ¿Corre dentro de una transacción? ¿Lee con `tx` o con el cliente global? ¿Es un N+1 con el lock
  tomado?
- ¿Qué pasa con las **filas que ya existen**? Un flag nuevo con `DEFAULT false` y sin backfill ya
  costó 16 días de condonaciones rendidas como cobros reales.
- ¿Cómo se **revierte** si sale mal?

**El PM ataca el para qué.** Su trabajo es que no construyas algo que nadie pidió:
- ¿Qué cambia para la persona que usa esto —la administradora, la cajera, el inquilino, el dueño?
- ¿Es un problema de producto o de **adopción**? Acá pasó: la herramienta existía y nadie la usaba
  porque no estaba donde la buscaban.
- ¿El copy promete algo que el sistema no hace? Es un bug tan real como un 500.
- ¿Se puede resolver **sin código**?

**Cerrá el debate por escrito, corto**: qué se decidió, qué se descartó y **por qué**. Si el CTO o
el PM ganaron, decilo — un debate donde siempre gana el que propone no es un debate.

### Fase 4 · El plan

Media carilla, no más:

1. Qué archivos tocás y por qué cada uno.
2. Qué **no** vas a tocar aunque tiente.
3. Cómo vas a saber que funcionó — **antes** de escribir el código.
4. El control negativo: qué tendría que **fallar** si tu arreglo no anduviera. Sin eso, un verde no
   prueba nada.

### Fase 5 · Implementar

- Rama nueva: `fix/T-XX-…`, `feat/T-XX-…` o `docs/T-XX-…`. **Nunca commitees a `main`.**
- Cambio chico y completo. Si el compilador te obliga a tocar 19 lugares, tocá los 19: esa es la
  señal de que la firma está bien elegida.
- Escribí los comentarios como los escribe este repo: **el porqué y el caso real que lo motivó**,
  no lo que hace la línea.

### Fase 6 · Probar, de las dos formas

**Automatizado**, y en este orden:

```bash
cd apps/api && ./node_modules/.bin/tsc --noEmit -p tsconfig.json
./node_modules/.bin/vitest run --config vitest.sin-db.config.ts
UPLOADS_AMBITO=on ./node_modules/.bin/vitest run --config vitest.con-db.config.ts
```

Y **un test que cuide la regla nueva**, con su control negativo. Si tu arreglo se puede
"simplificar" a algo incorrecto, el test que impide esa simplificación es el más importante que
vas a escribir.

**Manual**, sobre la app corriendo: reproducí el caso original y mostrá el número nuevo. Un
endpoint que contesta bien no es lo mismo que una pantalla que muestra bien.

**Y medí el resultado, no la ausencia de errores.** *"La suite pasa"* dice menos que *"la mora bajó
de $1.728 a $3,60, que es exactamente 1.000/480.000, y con el pago 20 días tarde vuelve a
$1.728"*.

### Fase 7 · Cerrar y seguir

1. Commit con el porqué en el cuerpo, no sólo el qué.
2. `git push` + PR con: qué cambia, por qué, cómo probarlo, y la tabla de verificación.
3. Esperá el CI. **Los cuatro checks en verde** o no está cerrada.
4. Actualizá `BACKLOG-VERIFICADO.md`: mové la tarea a la tabla de hechas, con evidencia.
5. **No mergees.** Dejá el PR listo; el merge es del dueño.
6. Volvé a la Fase 0.

---

## 4. El entorno, sin adivinar

Esto está verificado en esta máquina. Seguilo tal cual y arrancás en cinco minutos.

**La base** (efímera, en RAM, no la comparte nadie):

```bash
docker compose -f docker-compose.test.yml up -d      # Postgres 16 en el puerto 55432
```

**`apps/api/.env`** (gitignoreado; sin él la API no arranca — falla con un ZodError de entorno
antes de tocar la red). Sólo dos variables son obligatorias:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/myalquiler_test
JWT_SECRET=<cualquier cosa de 16+ caracteres>
NODE_ENV=development
DEMO_MODE=true
```

**Migrar y sembrar:**

```bash
cd apps/api
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/tsx prisma/seed.ts               # Inmobiliaria del Sol: 6 propiedades, 8 contratos, 90 liquidaciones
```

**Levantar** — puertos: API **3002**, panel **3001**, inquilino **3000**, propietario **3003**.
Los fronts necesitan un `.env.local` con `NEXT_PUBLIC_API_URL=http://localhost:3002`, o arrancan en
modo demo (localStorage) sin tocar la API.

**Entrar al panel:** `POST /auth/login` con el usuario ADMIN del seed y guardá el token en
`localStorage` bajo la clave `llave:auth:token`.

### Las trampas de esta máquina, que no son del repo

- 🔴 **`pnpm` no está en el PATH.** Corre por corepack, que trae v11 mientras el repo pinnea
  10.28.2 → falla la verificación de versión **y el `install` interno que dispara**. **Esquivalo:**
  usá los binarios locales (`apps/api/node_modules/.bin/…`, `node …/tsx/dist/cli.mjs`).
- 🔴 **Tailwind busca su config en el DIRECTORIO DE TRABAJO.** Si arrancás `next dev` desde otra
  carpeta —aunque le pases el directorio como argumento— no encuentra `tailwind.config.cjs` y muere
  con *"the `border-border` class does not exist"*. Parece un error del proyecto y es del lanzador.
  **Arrancá con el cwd adentro de la app.**
- ⚠️ **`prisma generate` falla con EPERM** si el dev server tiene tomado el motor. Bajalo primero.
- 🔴 **En un worktree con `node_modules` junctioneado, `prisma generate` le pisa el cliente al clon
  principal.** Son el mismo directorio. Si generás en el worktree con un schema mergeado y después
  volvés al clon a correr tests, el cliente que tenés es el del OTRO árbol — y el error sale
  cincuenta archivos más allá, hablando de una columna que "no existe". Regenerá al volver.
- 🔴 **Un worktree nuevo NO tiene `apps/api/.env`**: está gitignoreado y no viaja con
  `git worktree add`. Sin `JWT_SECRET`, `buildApp` explota **antes de correr un solo test** y la
  suite entera reporta "75 archivos fallados / 547 skipped". Parece una regresión gigante y es un
  archivo que falta. El `.env` del worktree apunta a **su propia** base — nunca a la del clon
  principal, y jamás a producción.
- ⚠️ **La suite con base tarda ~15 minutos** en local y corre en serie a propósito: todas siembran
  la misma base.
- 🔴 **Un test que MUTA una fila del seed rompe a otro archivo EN AISLAMIENTO.** La base es
  persistente entre corridas: si tu test le pone `depositoGarantia: null` a `cnt_001` y la
  corrida se corta antes del `afterAll`, ese null queda. Después otro archivo falla **solo**, y
  el rojo se lee como "se rompió el código que ese archivo prueba". Ya pasó.
  **Armá fixtures propios** —contrato, propiedad, profesional con tu prefijo— en vez de mutar
  filas del seed. Restaurar en el `afterAll` no alcanza: no corre si la corrida se interrumpe.
- 🔴 **No toques el fuente mientras la suite larga corre en segundo plano.** Son 15 minutos de
  tentación para "ir adelantando", y vitest lee cada archivo cuando le toca: los que se colecten
  después de tu edición corren contra un código distinto del que se colectó al principio. El
  resultado no es rojo, es **peor: es verde y no significa nada**. Si editaste, matá la corrida y
  volvé a lanzarla. Aprovechá esos minutos para el backlog, el PR o la documentación.

### Cómo NO mentirte a vos mismo

- 🔴 **El cliente de Prisma también cruza de rama, y miente peor.** Está generado en
  `node_modules`, que no cambia al hacer `git checkout`. Si la rama anterior tenía una columna
  que ésta no tiene, el cliente la pide y la base no la tiene: **59 archivos de test en rojo de
  golpe**, con un error que apunta al seed y no a tu cambio. Pasó en el ciclo de hoy y costó una
  corrida entera. **Después de cambiar de rama con migraciones de por medio, `prisma generate`
  antes de creerle a nada.**
- ⚠️ **El exit code de una tubería es el del último comando.** `tsc | head` devuelve el de `head`.
  Guardá la salida en un archivo y leé el exit code aparte.
- ⚠️ **`tsc --noEmit` no es el build.** La API buildea con `tsup` y los fronts con `next build`, y
  los dos ven cosas que el typecheck no: static export, `generateStaticParams` faltante, cruces
  server/client. El job `build` de la CI existe justamente porque la compuerta tipaba y testeaba
  sin compilar nada.
- ⚠️ **Un timeout que corta la suite puede devolver 0 y parecer verde.** Mirá el resumen, no el
  código de salida solo.
- 🔴 **Un test nuevo puede estar verde con `tsc` roto.** Vitest **transpila sin chequear tipos**.
  Si corriste el typecheck y DESPUÉS escribiste el último test, tu verde es de antes del archivo.
  Ya pasó dos veces: la segunda la encontró el merge de control, no la rama. **El typecheck va
  después de la última edición, siempre — y "última" incluye los tests.**
- ⚠️ **Contá cuántos tests corrieron, no cuántos no fallaron.** Una suite con todo "skipped"
  sale con exit 0. 547 skipped no son 547 que pasan.
- 🔴 **Un control negativo que NO se pone rojo casi nunca significa "el código está bien".**
  Significa, en este orden: (1) neutralizaste **otra copia** —este repo tiene bloques duplicados
  entre handlers hermanos, y un reemplazo por texto pega en el primero—; (2) el test no llega a
  esa línea; (3) recién ahí, que el aserto no medía lo que creías. Verificá **por número de
  línea** que neutralizaste la que corre en el camino que probás. Ya pasó: `expensasDeLaCuota`
  vive igual en `/ajustar` y en `/renovar`, y el verde falso se lee como "el control no
  detecta nada".
- ⚠️ **Un patrón vacío en un grep matchea todo.** Si tu búsqueda "encontró" un número redondo y
  enorme, verificá que el patrón no salga vacío.
- 🔴 **`next build` le rompe el `.next` al `next dev` que está corriendo.** Comparten carpeta: el
  build de producción pisa los chunks del dev, y a partir de ahí el navegador come 404 y
  *"Refused to execute script … MIME type ('text/html')"* — que parecen un problema del código y
  son del entorno. Pisado TRES veces en una sesión. Si vas a verificar en el navegador, corré el
  build **antes** de levantar el dev, o bajá el dev, `rm -rf .next` y volvelo a levantar.
- ⚠️ **`pkill -f "next dev"` no mata nada en Windows.** El proceso sigue tomando el 3001 y el
  `next dev` nuevo muere con `EADDRINUSE` — pero como el viejo sigue sirviendo, parece que
  arrancó. Matalo por puerto: `Get-NetTCPConnection -LocalPort 3001 -State Listen` y `Stop-Process`.
- ⚠️ **Recrear la base invalida el token del panel.** El seed regenera los cuids, así que el JWT
  que guardaste apunta a una inmobiliaria que ya no existe y el panel dice *"Tu sesión venció por
  seguridad"*. No es un bug de auth: pedí un token nuevo después de cada `docker compose down -v`.
- ⚠️ **Un test estructural que no encuentra nada pasa en verde.** Si escribís un test que escanea
  el fuente, la PRIMERA aserción tiene que ser que el parser encontró algo (`length >= N`, y que
  la lista contenga dos nombres que sabés que están). Sin eso, un cambio de forma en el código lo
  convierte en un test que mide cero y no avisa. Ya pasó acá con `metricas-moneda.test.ts`.
- ⚠️ **Probá el control negativo DONDE el control manda.** Neutralizar el guard de un endpoint que
  tu test declara como excepción no prueba nada: va a seguir verde y vas a creer que lo probaste.
  Rompé el caso que el test sí gobierna.
- 🔴 **Corré el typecheck DESPUÉS del último archivo que tocaste, no antes.** Pasó: `tsc` en verde
  a las 11:55, el último test escrito a las 12:10, PR abierto citando ese verde — y el CI lo tiró
  abajo con un `TS2532` de ese archivo. El verde no era falso, era **viejo**. Vale para las dos
  suites igual. Antes de escribir "verificado" en un PR, mirá que la corrida que estás citando sea
  posterior a tu última edición.
- ⚠️ **`noUncheckedIndexedAccess` está prendido.** `m[1]` de un `regex.exec`, `arr[0]`, y
  `map.get()` son `T | undefined` aunque "obviamente" existan. En un test recién escrito es el
  error más probable, y **vitest no lo ve**: el test corre en verde y el typecheck se cae aparte.
- 🔴 **Tu base local ACUMULA entre tareas, y te va a dar un rojo que no es tuyo.** El contenedor
  vive hasta que lo bajes, y `seedBase` no revierte todo: un test de otra rama que renovó un
  contrato dejó liquidaciones nuevas, y tres tareas después un test ajeno falló con
  `expected 'cmth8x…' to be 'liq_001'`. **Antes de creerle a un rojo local, recreá la base**
  (`docker compose -f docker-compose.test.yml down -v && up -d` + `migrate deploy`) y volvé a
  correr. El CI arranca con una Postgres nueva cada vez, así que si él está verde y vos rojo,
  empezá por ahí.
- ⚠️ **El CI reporta, no frena.** `main` no tiene branch protection. Un rojo no impide nada: mirarlo
  es tu trabajo, no del sistema.
- 🔴 **Un rojo en TU rama no siempre es TUYO.** Antes de arreglar, fijate si el archivo que falla
  lo tocó tu cambio (`git diff main...tu-rama -- ese-archivo`) y si el mismo commit pasó en otra
  corrida. Ya pasó: #124 dio `expected 2 to be 1` en un test de OTP que no tocaba, y el flaky
  vivía en `main`. **Eso no es "no es mi problema": es otra tarea, y hay que abrirla** — un check
  que falla por algo ajeno entrena a todos a ignorar el rojo.
- 🔴 **Un test puede caerse por el test de al lado.** Este repo tiene escrituras *fire-and-forget*
  (`void (async () => …)`, dos en toda la API) que aterrizan **después** de que el request
  contestó. Si tu caso borra filas y cuenta, y el caso de arriba usó **el mismo fixture**, una
  rezagada te deja una fila de más. La regla: **un caso que cuenta filas necesita su propia fila
  del fixture**, no la compartida.
- ⚠️ **Si el control negativo de un test flaky sale verde, tu explicación está mal.** Antes de
  escribir un señuelo que "simula" la carrera, verificá que el señuelo sobreviva al código real
  —el handler puede neutralizarlo—. Una carrera de verdad casi nunca se dispara a pedido:
  cuando no la podés reproducir, **decilo** en el PR y mostrá la evidencia que sí tenés (la firma
  del fallo, el código, que el mismo commit pasa y falla). Es mucho mejor que un control
  decorativo.

---

## 5. Lo que dejás por escrito

Cada tarea cerrada deja **tres rastros**, y ninguno es opcional:

1. **El PR**, con la verificación medida.
2. **`BACKLOG-VERIFICADO.md`** actualizado — la lista tiene que seguir siendo confiable después de
   vos.
3. **`work-agent/PARA-ALAN.md`**, si te chocaste con una pared: la pregunta en una línea, con el
   contexto mínimo para contestarla sin volver a investigar.

Y cuando la lista se termine, un resumen final de una carilla: qué se cerró, qué quedó esperando
una decisión, y qué encontraste que no estaba en ninguna lista.

---

## 6. La regla que ordena todo lo demás

**Medí, no supongas. Y cuando midas, medí también el caso malo.**

Este repo tiene un historial largo de verdes que no probaban nada: un test cuya sonda venció y
tuvo la CI nueve días en rojo, un candado que se apagaba solo en Windows sin que nadie se enterara,
un informe de riesgos que envejeció en dos semanas, una lista de tareas donde la mitad ya estaba
hecha.

Ninguno de esos falló ruidosamente. Todos **dijeron que sí** cuando la respuesta era no.

Antes de dar una tarea por cerrada, preguntate qué tendría que haber pasado si tu arreglo no
anduviera — y comprobá que efectivamente no pasa.
