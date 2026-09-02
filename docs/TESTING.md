# Testing — My Alquiler

> Cómo correr y escribir tests (vitest + `app.inject` + `seedBase`), la DB de test, y
> el patrón E2E-contra-prod. ⚠️ Nunca correr los tests contra una DB incierta.

---

## Base de test local y efímera (recomendado)

> Escrito el 19/08/2026 en T-23-N1. **✅ VERIFICADO el 20/08/2026 (T-28-N1): anda.** Levanta
> sano, las **57 migraciones aplican desde cero** y el suite completo corre contra ella: **94
> archivos, 786 tests, 22 minutos, 780 en verde**, 5 rojos y 1 skip. Era la primera corrida
> entera en meses.
>
> Dos cosas que conviene saber antes de correrlo:
>
> - **Además de `DATABASE_URL` hace falta `JWT_SECRET`.** Sin ella, `buildApp()` corta con un
>   `ZodError` de env antes de tocar la base. Cualquier string largo sirve.
> - **Se pueden crear varias bases en el mismo contenedor** y correr suites en paralelo sin
>   pisarse — `seedBase` resetea la base entera, así que dos corridas contra la misma se
>   arruinan mutuamente:
>   ```bash
>   docker exec myalquiler-postgres-test psql -U postgres -c "CREATE DATABASE mi_corrida;"
>   ```
> - **Los 5 rojos son 4 + 1.** Cuatro son los asserts de `core.test.ts`, y son los explicados más
>   abajo: cuentan filas de TODO el tenant, y aunque la base arranque virgen, los 93 archivos que
>   corren antes le van agregando filas. No es regresión.
>   **El quinto sí lo es:** `multi-alquiler.test.ts` falla **también corriéndolo solo, contra una
>   base recién creada**. Ficha propia: T-28-N1-N2.

Hasta ahora la única base disponible era la remota del proxy de Railway, que **la comparten
todos los procesos** y que `seedBase` reescribe: correr los tests se llevaba puesto a
cualquiera que estuviera trabajando contra ella. Y sin `apps/api/.env` ni siquiera arrancan —
fallan con un ZodError de env antes de tocar la red, que es el motivo por el que durante meses
figuraron como "no se pueden correr". Se pueden: ver la sección de abajo.

```bash
pnpm --filter api test:db:up
export DATABASE_URL='postgresql://postgres:postgres@localhost:55432/myalquiler_test'
cd apps/api && ./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/vitest run
pnpm --filter api test:db:down     # borra el volumen: la próxima arranca limpia
```

> ### ⚠️ No corras dos suites completas a la vez (T-28-N2, 20/08)
>
> La suite entera se corrió dos veces seguidas contra esta misma base efímera:
>
> | | duración | resultado |
> |---|---|---|
> | 1ª (máquina libre) | **881 s** | 809/810 · 1 falla real |
> | 2ª (con otra suite en paralelo) | **5433 s** | 3 suites caídas |
>
> Las tres de la segunda vuelta fueron **de entorno, no de código**: una murió con
> `Hook timed out in 420000ms` y `Can't reach database server at localhost:55432`. El
> contenedor quedó sano —sin OOM, sin reinicios— y **las tres pasan solas en 46 s**. Lo que
> las volteó fue la contención: 6× más lento alcanza para que los timeouts de conexión
> empiecen a saltar.
>
> Si ves fallas raras de infraestructura, **antes de debuggear el código corré los archivos
> caídos en aislamiento**. Si pasan, era la máquina.

> ### Si ves una tormenta de 401 en UN archivo, mirá el login antes que los permisos
>
> Todos los casos de un archivo fallando con `expected 401 to be 200` casi nunca es un problema
> de permisos: es que el `/auth/login` del `beforeAll` no devolvió token, cada request salió con
> `Bearer undefined`, y el síntoma aparece lejos de la causa.
>
> Pasó en la primera corrida de los 125 archivos: `ecosistema-profesionales.test.ts` dio 7 rojos
> así y **pasaba 7/7 corriendo solo** (15 s contra los 116 s que tardó bajo carga).
>
> Para eso está **`test/_login.ts`**: `loginTest(app, email, password)` chequea el 200, exige el
> token y, si falla, el mensaje dice si fue el rate limit de `/auth/login` (30 en 15 min) o un
> usuario que otro archivo dejó inutilizable. **Usalo en los archivos nuevos.** Los ~25 que
> todavía hacen `login.json().token` a pelo están en T-28-N2-N2.

> ### Dos chats no pueden correr la suite a la vez
>
> `docker-compose.test.yml` fija el nombre del contenedor y el puerto, así que el segundo que
> levante o choca por nombre, o —peor— se engancha a la base del primero y se la reescribe con
> `seedBase` a mitad de su corrida. Si vas a correr la suite con otra sesión activa, levantá tu
> propia Postgres en otro puerto:
>
> ```bash
> MSYS_NO_PATHCONV=1 docker run -d --name mi-suite >   -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=myalquiler_test >   -p 127.0.0.1:55440:5432 --tmpfs /var/lib/postgresql/data postgres:16-alpine >   -c fsync=off -c synchronous_commit=off -c full_page_writes=off
> ```
>
> (`MSYS_NO_PATHCONV=1` es obligatorio en Git Bash: sin eso convierte `/var/lib/...` a una ruta
> de Windows y docker rechaza el mount.)

Detalles en `docker-compose.test.yml`. Puerto **55432** para no pisar un Postgres propio; la
base vive en `tmpfs` (RAM) así que desaparece al bajar el contenedor, que es justo lo que se
quiere de una base de test. `prisma/guard-db.ts` ya reconoce `localhost` como base de test.

---

## Con base remota: la suite de integración, y cuánto tarda de verdad

> Verificado el 19/08/2026 corriendo los tests, no leyéndolos.

Dos tareas anteriores anotaron que la suite de integración "no se puede correr acá". **Se
puede.** Lo único que faltaba era `apps/api/.env` — que está gitignoreado, así que en un
checkout nuevo no existe y todo falla con un ZodError de env *antes* de tocar la red, que es
exactamente el síntoma que se leyó como "no se puede".

```bash
cd apps/api && ./node_modules/.bin/vitest run test/portal-aislamiento.test.ts
```

El `.env` mínimo necesita `DATABASE_URL`, `JWT_SECRET`, `PORT` y `NODE_ENV`. **La URL sale de
Railway, no del chat ni de un archivo del repo:** `railway variables --service <base-de-test>`
y se copia `DATABASE_PUBLIC_URL` (la privada sólo resuelve dentro de la red de Railway).

> ⚠️ **Que apunte a la base de TEST.** `seedBase` reescribe el tenant de demo entero. Contra
> producción, esto no es un test: es una pérdida de datos.

### Corrida completa del 20/08: los 53 archivos de integración, por lotes

Primera vez que se corrieron todos. Resultado: **7 archivos en rojo, y NINGUNO era un bug de
la aplicación introducido por un cambio reciente.** Vale la pena la lista, porque las causas se
repiten y las tres primeras se disfrazan de "se rompió el código":

| Causa | Archivos | Cómo se veía |
|---|---|---|
| El devengo automático escribiendo en la base compartida | `conciliar-informado-huerfano`, `deposito-aplica-deuda`, `inquilino-mundo` | un 23505, un depósito que se imputaba entero, "expected 12 to be 1" |
| Contar filas del seed a mano en una base que nunca se limpia | `core.test.ts` | "expected 29 to be 8" |
| Fixture viejo respecto del código | `certificado-antiguedad` | 401 desde que existe la revalidación de tokens |
| La base de test se cayó a mitad de la corrida | `renovacion-decision`, `pago-tipo-parcial`, `pago-monto-centavos` | todo *skipped*, y un archivo colgado 74 minutos |
| Limpieza vieja respecto del código | `multi-alquiler` | FK RESTRICT de `eventos_contrato` |

**La única excepción, y sí era real:** `saldar-deuda-concurrencia` daba 500. No era
contaminación ni flake —se reprodujo aislado y con la base sana—: la transacción toma un lock
pesimista y se quedaba sin los 5 segundos de default de Prisma, tirando un P2028 que el
operador veía como "Error interno". El invariante de plata nunca se rompió (un solo pago), así
que el 500 no era un doble cobro: era la espera.

> La moraleja operativa es corta: **antes de investigar un rojo de integración, mirá si el
> escenario cambió abajo del test.** Cuatro de los siete eran eso.
### Lo que hay que saber antes de tirar `vitest run` a secas

- **La suite completa son ~94 archivos y tarda horas, no minutos.** Cada test hace ida y
  vuelta contra un Postgres remoto —~6s por test— y `fileParallelism` está en `false` a
  propósito, porque todos comparten la misma base. Correrla entera de una sentada no es
  viable en una sesión: **se corre por lotes**, por área.
- **Los timeouts mienten.** Un `timeout 1500` que corta a la mitad devuelve exit 0 y parece
  verde. Si el resumen no dice `Test Files N passed (N)` con el N que esperabas, no terminó.
- **`certificado-antiguedad.test.ts` da rojo (401) y es preexistente** — confirmado
  corriéndolo con y sin los cambios de la sesión. No lo rompió nadie de los que pasó por acá.
- **Poné `CRON_DEVENGO=off` en tu `apps/api/.env`.** Si no, tu API local devenga sobre la base
  COMPARTIDA cada 6 horas y al arrancar, y le va agregando liquidaciones a los contratos del
  seed. Eso rompe todo test que afirme una cuenta exacta, y el rojo NO se parece a lo que es:
  el 20/08 dejó `conciliar-informado-huerfano` con un 23505 al chocar el
  `@@unique([contratoId, periodo])`, y `deposito-aplica-deuda` viendo 100.000 de deuda donde su
  fixture pone 70.000 — que se lee como "se rompió el cálculo del depósito". No se rompió nada:
  cambió el escenario abajo del test.
- **Ya NO hace falta una base virgen para `core.test.ts`.** Sus cuatro asserts contaban filas
  con el número del seed hardcodeado (`toBe(8)`), y eso sólo se sostiene en una base limpia:
  `seedBase` sólo hace upsert, nunca borra lo que sobra. Ahora cuentan **contra la base**
  (`prisma.contrato.count({ where: { inmobiliariaId } })`), que afirma algo más fuerte —que el
  endpoint devuelve exactamente las filas del tenant, ni una de más ni una de menos— y no
  depende de cuánta basura haya. Queda un piso `toBeGreaterThanOrEqual` con el número del seed.

---

## Sin base: `test:sin-db` (lo que se puede correr en cualquier lado)

**Verificado el 20/08/2026 sobre `2f75958`, el commit que está en producción: 41 archivos,
395 tests, todos en verde.** Sin Docker, sin Postgres y sin tocar nada compartido.

```bash
cd apps/api && corepack pnpm db:generate
DATABASE_URL='postgresql://nadie:nada@127.0.0.1:1/no_existe' \
JWT_SECRET='cualquier-cosa-larga-que-no-se-usa' \
corepack pnpm test:sin-db
```

**Las dos variables no son opcionales, y ahí está la trampa.** `vitest.sin-db.config.ts` separa
los tests por *"¿necesita una base viva?"*, y varios de los que quedan del lado corrible llaman a
`buildApp()`, que valida el entorno con zod **antes** de tocar la red. Sin ellas, tres tests de
`sonar-correlacion.test.ts` fallan con un `ZodError: DATABASE_URL Required` que **parece código
roto y no lo es**. Los valores pueden apuntar a la nada: nadie se conecta.

**Y `db:generate` también es obligatorio en un checkout nuevo.** Sin él, 7 suites ni cargan:
`Cannot find module '.prisma/client/default'`. El cliente de Prisma es generado, no viene en el
repo.

> Si alguna vez da rojo sin haber tocado código, **antes de investigar el test, confirmá estas
> dos cosas.** Las dos veces que dio rojo acá fue por entorno, ninguna por el código.

---

## Cómo correr los tests

Los tests viven en `apps/api/test/*.test.ts` y corren con Vitest:

```bash
pnpm --filter api test          # vitest run (una pasada)
pnpm --filter api test:watch    # vitest en watch
```

Config en `apps/api/vitest.config.ts`:

- `environment: node`, `include: ['test/**/*.test.ts']`.
- `fileParallelism: false` — **todas las suites comparten la misma DB**, así que corren en serie para no pisarse.
- `testTimeout: 60_000` y `hookTimeout: 420_000` — el `beforeAll` siembra contra una DB **remota** (Railway), necesita aire.

### Contra qué DB

No hay DB local: los tests pegan a la misma Postgres de Railway que define `DATABASE_URL` en `apps/api/.env`, vía el **host público** `thomas.proxy.rlwy.net:23651` (base `railway`). `loadEnv()` (`apps/api/src/env.ts`) parsea ese `.env` a mano (sin dotenv) y solo setea vars que no estén ya en el entorno.

> **Esta NO es la DB de prod.** Prod corre dentro de Railway con el host **interno** (`*.railway.internal`), inalcanzable desde tu máquina. El proxy público es la instancia de **test/dev**. Aun así, el seed es destructivo-idempotente: confirmá que tu `DATABASE_URL` apunta al proxy antes de correr.

## Patrón `seedBase` + `app.inject`

Cada suite de integración monta la app en memoria y la siembra en `beforeAll`:

```ts
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);            // idempotente (upserts) → se puede repetir
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
});

afterAll(async () => { await app.close(); });
```

Claves del patrón:

- **`buildApp(envOverrides)`** (`apps/api/src/app.ts`) arma la instancia Fastify **sin escuchar** (mismo builder que usa el server real). Pasale `NODE_ENV: 'test'` (apaga el logger) y `DEMO_MODE: 'true'` (habilita los backdoors de demo, ver abajo).
- **`app.inject({ method, url, payload, headers })`** hace requests HTTP sin abrir un socket. Helper típico: `const auth = () => ({ authorization: \`Bearer ${token}\` })`.
- **`seedBase(prisma)`** (`apps/api/prisma/seed.ts`) siembra el tenant demo **"Inmobiliaria del Sol"** con ids exactos del mock del front. Lo que deja:
  - **Usuarios del panel** (password `delsol123`, PIN `1234`): `roberto@delsol.com` (`ADMIN`), `luciana@delsol.com` (`OPERADOR`), `camila@delsol.com` (`CARGA`).
  - **Propietarios** `own_001`…`own_005`, **propiedades** `prp_001`…`prp_006` (con `participaciones` de cotitularidad), **contratos** `cnt_001`…`cnt_008`.
  - **Inquilinos titulares** 1:1 con su contrato; ej. `mariela.sosa@example.com` → `cnt_001`.
  - Plata: liquidaciones (`liq_*`), pagos a validar (`pag_*`), caja/`movimientoCaja` (`mov_*`), una `rendicion` seed (`ren_001`) y su `gastoRendido`, aprobaciones pendientes, más los dominios de Fases 4-6 (`seedOperacion` / `seedAnuncios` / `seedInquilinoMundo`).
  - Devuelve `{ inmobiliariaId }`.

### Backdoors de demo (solo con `DEMO_MODE=true`)

- `POST /auth/demo` → sesión de inquilino de **Mariela Sosa**.
- OTP de inquilino: `POST /auth/otp/request` + `POST /auth/otp/verify` con el código fijo **`000000`**.
- PIN de usuario: `1234` (`POST /auth/pin/verify`).

## Cómo escribir un test nuevo con fixtures propios

## 🔴 Antes de sospechar del código: la DB de test está sucia

La DB de test es **COMPARTIDA** entre sesiones y la suite corre con `fileParallelism:
false`. Una corrida que muere antes de su `afterAll` —Ctrl-C, un kill, la sesión que se
cae— deja sus fixtures adentro, y eso rompe suites **ajenas** con fallas que parecen bugs
del código. Síntomas típicos, todos ya vividos:

| Falla | Qué es en realidad |
|---|---|
| `core.test.ts`: "devuelve los 8 del seed" → recibió 10 | contratos de otra corrida |
| `consorcios.test.ts`: `Unique constraint failed on (codigoReferido)` | su tenant B anterior nunca se borró |
| `multi-alquiler.test.ts`: 409 "ya está en tu cartera" | un inquilino sobreviviente |
| `Can't reach database server` | saturación de conexiones, no código: re-corré |
| `expected ['Morales','Repro']` (o cualquier nombre del seed cambiado) | una corrida renombró una fila del seed. `seedBase()` ya restaura los datos de referencia; si persiste, corré `test:clean` |
| Un test asegura un comportamiento **ya eliminado a propósito** (ej. el PIN) | el test quedó viejo, no el código. Actualizalo, no "arregles" el código |
| Falla que sólo pasa en tu máquina y no en prod | **tu DB de test está atrasada de migraciones** — ver abajo |

### La DB de test se atrasa de migraciones y parece un bug de producto

Pasó de verdad: `multi-alquiler.test.ts` empezó a dar 409 "ya está en tu cartera",
reproducía en aislado con la base limpia, y parecía una regresión P1 **en producción**.
No lo era: a la DB de test le faltaban **7 migraciones** (algunas aplicadas a mano con
`prisma db execute`, que corre el SQL pero **no anota la fila** en `_prisma_migrations`).
El índice único viejo de `inquilinos(inmobiliariaId,email)` seguía vivo ahí y en prod no.

```bash
npx prisma migrate deploy          # desde apps/api, contra la DB de test
```

Antes de reportar una regresión de producción, **verificá contra prod** (solo lectura):
si la migración figura en su `_prisma_migrations`, el bug es de tu entorno.
⚠️ Al consultar `pg_indexes` filtrá por `schemaname`: la DB de test tiene además schemas
de worktrees (`wt_feat`, `wt_cmp`) y los índices aparecen duplicados.

Antes de abrir el código, corré:

```bash
pnpm --filter @llave/api test:clean
```

Borra los tenants `ZZ-TEST-*` enteros y, del tenant del seed, todo lo que no tenga un id
estable del seed (`cnt_001`, `prp_002`…). Al terminar imprime los conteos y avisa si no
dan 8/6/5/7. Nunca corre contra producción: aborta si la `DATABASE_URL` huele a prod.

La otra mitad de la regla: **verificá que tu test falla SIN el fix**. Un test que pasa
antes y después no protege nada.

Cuando el dato que necesitás no está en el seed, sembralo vos en `beforeAll` con un **prefijo de id** propio y limpialo en `afterAll`. Modelo: `apps/api/test/rendicion-multiowner.test.ts`.

```ts
import { borrarContratosDeTest } from '../prisma/borrar-contratos-de-test.js';
const P = 'mo_';  // prefijo para identificar y limpiar tus fixtures
const prisma = new PrismaClient();

async function limpiar() {
  // Borrá en orden inverso de dependencias (hijos antes que padres)
  await prisma.gastoRendido.deleteMany({ where: { refId: `${P}gasto` } });
  await prisma.rendicion.deleteMany({ where: { propietarioId: { in: [`${P}ownA`, `${P}ownB`] } } });
  await prisma.movimientoCaja.deleteMany({ where: { id: `${P}gasto` } });
  // El contrato NO se borra a mano: le cuelgan 33 modelos y ninguno cascadea.
  await borrarContratosDeTest(prisma, [`${P}cnt`]);
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: `${P}prop` } });
  await prisma.propietario.deleteMany({ where: { id: { in: [`${P}ownA`, `${P}ownB`] } } });
  await prisma.propiedad.deleteMany({ where: { id: `${P}prop` } });
}

beforeAll(async () => {
  const { inmobiliariaId } = await seedBase(prisma);  // tenant base
  await limpiar();                                     // idempotencia: borrá restos de corridas previas
  // ...crear fixtures con inmobiliariaId...
});
afterAll(async () => { await limpiar(); await app.close(); await prisma.$disconnect(); });
```

Reglas:

- **Siempre seteá `inmobiliariaId`** (= el que devuelve `seedBase`). Todo es multi-tenant; sin el tenant correcto los guards y los joins no ven el dato.
- **`limpiar()` se llama dos veces**: al principio (por si una corrida anterior abortó) y al final.
- **Nunca borres un `Contrato` a mano.** Usá `borrarContratosDeTest(prisma, ids)` de
  `apps/api/prisma/borrar-contratos-de-test.ts`: al contrato le cuelgan 22 hijos y 10 nietos y
  **ninguna FK cascadea**, así que un `contrato.deleteMany` pelado muere con `P2003` en cuanto
  el alta escriba un hijo que tu teardown no conoce. Ya pasó dos veces —`multi-alquiler` y
  `limpiar-test-db`— y las dos el rojo salió lejos de la causa (T-28-N3). El helper NO borra
  propiedades, personas ni propietarios: eso sigue siendo tuyo.
- **Ids con prefijo** (`mo_prop`, `mo_ownA`…) para no chocar con los ids del seed ni con otras suites (recordá: comparten DB).

Campos requeridos de los modelos clave (mínimos para crear, según los fixtures reales):

- **Propiedad**: `inmobiliariaId`, `direccion`, `ciudad`, `provincia`, `tipo` (`DEPARTAMENTO`/`CASA`/`LOCAL`).
- **Propietario**: `inmobiliariaId`, `nombre`, `apellido`, `cuit`, `email`, `telefono`, `comisionPct`; `cbuAlias` opcional (sin él no se puede rendir).
- **ParticipacionPropietario**: `inmobiliariaId`, `propiedadId`, `propietarioId`, `porcentaje`.
- **Contrato**: `inmobiliariaId`, `propiedadId`, `monto`, `fechaInicio`, `fechaFin` (`Date`), `diaPago`, `indiceAjuste` (`ICL`/`IPC`/`FIJO`/…), `frecuenciaAjusteMeses`, `estado` (`ACTIVO`/`BORRADOR`/…), `modoCobranza`.
- **Liquidacion**: `inmobiliariaId`, `contratoId`, `periodo` (`'2026-05'`), `montoAlquiler`, `montoTotal`, `fechaVencimiento` (`Date`), `estado` (`PAGADO`/`VENCIDO`/`PENDIENTE`).
- **MovimientoCaja**: `inmobiliariaId`, `propiedadId`, `tipo` (`'GASTO'`), `categoria` (`PLOMERIA`/`EXPENSAS`/`ELECTRICIDAD`/…), `descripcion`, `monto`, `fecha` (`Date`), `cargadoPor`.

## Gotcha: sincronizar la DB de test si cambió el schema

La DB de test/dev **no aplica migraciones sola** al correr Vitest. Si tocaste `apps/api/prisma/schema.prisma` (campo/modelo/enum nuevo) y no sincronizaste, las suites van a fallar con errores de columna/tabla inexistente (Prisma `P2022`/`P2021`) en el `beforeAll`.

Sincronizá **antes** de correr los tests:

```bash
pnpm --filter api exec prisma db push   # empuja el schema a la DB de DATABASE_URL (sin migración formal)
pnpm --filter api exec prisma generate  # regenerá el cliente si cambiaron tipos
```

`db push` apunta a `DATABASE_URL` (el proxy de Railway), así que confirmá que estás sobre la base de test, no prod. Para flujo formal de migraciones se usa `db:migrate` (`prisma migrate dev`); para prod, el Dockerfile corre solo `migrate deploy`.

## Patrón E2E contra prod (mintear JWT + curl)

Para smoke-tests contra la API desplegada (sin pasar por login/OTP), se mintea un JWT con el **mismo `JWT_SECRET` que usa el server** y se pega con `curl`. El payload tiene que matchear lo que esperan los guards (`apps/api/src/auth/guards.ts`):

- Usuario de panel (`requireUsuario`): `{ kind: 'usuario', userId, inmobiliariaId, rol }`.
- Inquilino (`requireInquilino`): `{ kind: 'inquilino', inquilinoId, inmobiliariaId, contratoId }`.

`@fastify/jwt` firma HS256 con `JWT_SECRET`. Minteo standalone (mismo algoritmo) más cleanup:

```bash
API=https://<api-prod>.up.railway.app
SECRET="$JWT_SECRET"   # exportá el MISMO secreto que tiene el server en Railway

# Mintear un token de usuario ADMIN (ajustá userId/inmobiliariaId reales)
TOKEN=$(JWT_SECRET="$SECRET" node -e '
  const jwt = require("@fastify/jwt/node_modules/jsonwebtoken") ;
  console.log(jwt.sign(
    { kind:"usuario", userId:"<userId>", inmobiliariaId:"<tenant>", rol:"ADMIN" },
    process.env.JWT_SECRET, { expiresIn:"10m" }))')

# Smoke
curl -fsS "$API/health"
curl -fsS "$API/contratos" -H "authorization: Bearer $TOKEN" | jq 'length'
```

Reglas para E2E contra prod:

- **Solo lectura por defecto.** Si probás mutaciones, hacelo sobre un tenant/registro descartable y **borralo en un bloque de cleanup** (igual que `limpiar()` en los tests), o envolvé el script en `trap '...' EXIT` para que el cleanup corra aunque falle.
- **No commitees el secreto.** `JWT_SECRET` sale del entorno (Railway), nunca hardcodeado.
- El token expira (`TOKEN_TTL` en `auth.ts`); minteá uno corto (`expiresIn: '10m'`) por corrida.

---

Archivos de referencia (todos absolutos):
- `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/apps/api/vitest.config.ts`
- `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/apps/api/prisma/seed.ts`
- `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/apps/api/test/rendicion-multiowner.test.ts` (fixtures propios), `core.test.ts`, `auth.test.ts`, `health.test.ts`
- `/Users/alannaimtapia/dev/inmobiliaria-inquilinos-app/apps/api/src/app.ts` (`buildApp`), `src/env.ts` (`loadEnv`), `src/auth/guards.ts` (shapes de payload), `src/routes/auth.ts` (firma JWT)

Nota: confirmá el id del paquete `jsonwebtoken` resuelto por `@fastify/jwt` en el ejemplo E2E (o agregá `jsonwebtoken` como devDependency) — no figura como dependencia directa en `apps/api/package.json`.

