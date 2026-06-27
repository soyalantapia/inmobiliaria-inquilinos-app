# Testing — My Alquiler

> Cómo correr y escribir tests (vitest + `app.inject` + `seedBase`), la DB de test, y
> el patrón E2E-contra-prod. ⚠️ Nunca correr los tests contra una DB incierta.

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
  - **Inquilinos titulares** 1:1 con su contrato; ej. `mariela.sosa@gmail.com` → `cnt_001`.
  - Plata: liquidaciones (`liq_*`), pagos a validar (`pag_*`), caja/`movimientoCaja` (`mov_*`), una `rendicion` seed (`ren_001`) y su `gastoRendido`, aprobaciones pendientes, más los dominios de Fases 4-6 (`seedOperacion` / `seedAnuncios` / `seedInquilinoMundo`).
  - Devuelve `{ inmobiliariaId }`.

### Backdoors de demo (solo con `DEMO_MODE=true`)

- `POST /auth/demo` → sesión de inquilino de **Mariela Sosa**.
- OTP de inquilino: `POST /auth/otp/request` + `POST /auth/otp/verify` con el código fijo **`000000`**.
- PIN de usuario: `1234` (`POST /auth/pin/verify`).

## Cómo escribir un test nuevo con fixtures propios

Cuando el dato que necesitás no está en el seed, sembralo vos en `beforeAll` con un **prefijo de id** propio y limpialo en `afterAll`. Modelo: `apps/api/test/rendicion-multiowner.test.ts`.

```ts
const P = 'mo_';  // prefijo para identificar y limpiar tus fixtures
const prisma = new PrismaClient();

async function limpiar() {
  // Borrá en orden inverso de dependencias (hijos antes que padres)
  await prisma.gastoRendido.deleteMany({ where: { refId: `${P}gasto` } });
  await prisma.rendicion.deleteMany({ where: { propietarioId: { in: [`${P}ownA`, `${P}ownB`] } } });
  await prisma.movimientoCaja.deleteMany({ where: { id: `${P}gasto` } });
  await prisma.contrato.deleteMany({ where: { id: `${P}cnt` } });
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

