# Deploy y operación — My Alquiler

## Railway

Proyecto **MYALQ** (`b01a1ecb-2169-46ef-b6cf-71a2d6cca234`), env **production**,
workspace Deenex. Servicios:

| Servicio | svc id | Build | Dominio |
|---|---|---|---|
| `myalquiler-back` | `bf0c4296…` | Dockerfile `apps/api/Dockerfile` (+ **Volume `myalquiler-back-volume` en `/data`** para uploads) | api-production-262e.up.railway.app |
| `myalquiler-front` | `f654d7a1…` | Dockerfile `apps/inmobiliaria/Dockerfile` | **admin.myalquiler.com** |
| `myalquiler-inquilino` | `e8209a59…` | Dockerfile `apps/inquilino/Dockerfile` | **app.myalquiler.com** |
| `Postgres-_cRj` | `5cac29d2…` | — | DB PROD EN USO (host interno `postgres-crj.railway.internal`) |

Otros Postgres del proyecto (`Postgres`, `Postgres-fL7g`) y `MongoDB` están sin uso.

## Cómo deployar

⚠️ Los servicios **NO están conectados a GitHub** — pushear a `main` **NO** auto-deploya.
Para desplegar:

```bash
railway up --service <svc> --detach        # back / front / inquilino — solo lo que tocaste
# (el env activo ya es production; railway environment production si hace falta fijarlo)
```

Para saber cuándo quedó live un endpoint nuevo: pollear hasta que pase de **404→401**
(route registrado pero sin token) en vez de pollear `railway status`. Ej:
`for i in $(seq 1 15); do curl -s -o /dev/null -w '%{http_code}' "$API/<ruta-nueva>"; sleep 20; done`.

**Env del back (prod):** `DATABASE_URL`, `JWT_SECRET` (64 chars), `DEMO_MODE=false`,
`PORT`, SMTP Hostinger, **`CRON_SECRET`** (para `/internal/cron/devengar`),
`CORS_ORIGINS` (incluye los dominios de los fronts), `UPLOADS_DIR` (opcional; default `/data/uploads`).

Mecánica de los Dockerfiles (fronts): `RAILWAY_DOCKERFILE_PATH=apps/<app>/Dockerfile`,
contexto = raíz del monorepo, `NEXT_PUBLIC_API_URL` se hornea como build ARG. El
Dockerfile **debe copiar `tsconfig.base.json`** (cadena tsconfig → @llave/config →
../../tsconfig.base.json). `CORS_ORIGINS` del back debe incluir los dominios de los fronts.

## Migraciones (Prisma)

El back aplica migraciones con **`prisma migrate deploy`** en el arranque del
Dockerfile (línea ~26). `migrate deploy` **solo aplica las pendientes, NUNCA resetea**
→ es seguro. Migraciones actuales:

```
20260612041401_init
20260612042419_rol_lectura
20260612042420_nucleo_completo
20260621000000_audit_unique_constraints      # unique pago(liquidacionId) WHERE INFORMADO + co_inquilinos(contratoId,email)
20260621010000_sociedad_principal_unique     # unique parcial sociedad principal-activa
```

**Índices parciales**: Prisma NO los expresa en el schema → se crean a mano con
SQL crudo en la migración (`CREATE UNIQUE INDEX ... WHERE ...`), y se documentan
con un comentario en `schema.prisma`. `migrate dev` marcará "drift" sobre esas
tablas → **es esperado, NO borrar el índice**.

### Antes de aplicar una migración con constraint nuevo

**Verificar que prod no tenga duplicados** que violen el constraint (si no, el
`migrate deploy` falla y el back no arranca → downtime). Ver "chequear prod" abajo.

## Cómo chequear / consultar la DB de prod desde local

⚠️ La DB de prod tiene **solo host interno** (`postgres-crj.railway.internal`),
**inalcanzable** desde tu máquina (`railway run` inyecta esa URL interna). La forma
confiable y verificada: correr la query **dentro del contenedor** del back, donde el
host interno SÍ resuelve, vía `railway ssh`:

```bash
railway ssh --service myalquiler-back \
  "node --input-type=module -e 'import{PrismaClient}from\"@prisma/client\";const p=new PrismaClient();console.log(await p.contrato.count());await p.\$disconnect();'"
```

(Si en algún momento se expone la URL pública del Postgres de prod —`DATABASE_PUBLIC_URL`,
host tipo `*.proxy.rlwy.net`— se puede conectar desde local con el Prisma client. Hoy
no está expuesta. NO confundir con el `apps/api/.env`, que apunta a OTRA DB de **test**.)

## Smoke test de prod (sin ensuciar el tenant real)

```bash
API="https://api-production-262e.up.railway.app"
curl -s "$API/health"                              # → {ok:true, db:"up", ...}
curl -s -o /dev/null -w "%{http_code}" "$API/liquidaciones"        # → 401 (no 500)
curl -s -X POST "$API/auth/login" -d '{}' -H "Content-Type: application/json" -w "%{http_code}"  # → 400
curl -s -o /dev/null -w "%{http_code}" https://admin.myalquiler.com   # → 200
curl -s -o /dev/null -w "%{http_code}" https://app.myalquiler.com     # → 200
```

## Verificación local antes de deployar

```bash
pnpm --filter api exec tsc --noEmit      # typecheck API
pnpm --filter api build                  # build API (tsup)
pnpm --filter @llave/inmobiliaria exec tsc --noEmit
pnpm --filter @llave/inmobiliaria build
pnpm --filter @llave/inquilino exec tsc --noEmit
pnpm --filter @llave/inquilino build
```

## Tests (DB de test, NO prod)

Las suites de `apps/api` (`pnpm --filter api test`, vitest) pegan a una **DB de test**
(host **público** `thomas.proxy.rlwy.net`, en `apps/api/.env`) y hacen reset/`seedBase`
en `beforeAll`. Es **distinta de prod** — pero la regla dura sigue: si no tenés certeza
100% de que el `DATABASE_URL` NO es prod, **no las corras**.

- **Gotcha**: si el `schema.prisma` cambió y el test DB quedó atrás (ej. faltaba la
  col `inmobiliarias.paisCodigo`), sincronizalo con `npx prisma db push --accept-data-loss`
  (es el DB de test, se re-seedea). La suite plata tiene **2-3 fallas preexistentes**
  de drift de seed (montoBruto esperado, y polución de estado por correr la suite
  repetida) — NO son regresiones.
- **E2E contra prod** (sin tocar datos reales): mintear un JWT con `JWT_SECRET`
  (usuario o inquilino) y probar con `curl` con cleanup/restore. `requireUsuario` /
  `requireContratoAcceso` no validan el id contra DB para el titular.

## Reglas duras (del dueño — innegociables)

1. **NUNCA `prisma migrate reset` contra prod.**
2. No correr acciones irreversibles (deploy, migración de schema, borrado) **sin
   confirmarlo en el chat**.
3. No crear cuentas / data de prueba en el tenant real (Tapia Propiedades).
4. Repo `soyalantapia/inmobiliaria-inquilinos-app`. gh token **sin** workflow scope
   (no tocar `.github/workflows/`). Pushear a `main` es OK en este repo.
