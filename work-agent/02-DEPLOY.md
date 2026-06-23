# Deploy y operación — My Alquiler

## Railway

Proyecto **MYALQ** (`b01a1ecb-2169-46ef-b6cf-71a2d6cca234`), env **production**,
workspace Deenex. Servicios:

| Servicio | svc id | Build | Dominio |
|---|---|---|---|
| `myalquiler-back` | `bf0c4296…` | Dockerfile `apps/api/Dockerfile` | api-production-262e.up.railway.app |
| `myalquiler-front` | `f654d7a1…` | Dockerfile `apps/inmobiliaria/Dockerfile` | **admin.myalquiler.com** |
| `myalquiler-inquilino` | `e8209a59…` | Dockerfile `apps/inquilino/Dockerfile` | **app.myalquiler.com** |
| `Postgres-_cRj` | `5cac29d2…` | — | DB PROD EN USO (host interno `postgres-crj.railway.internal`) |

Otros Postgres del proyecto (`Postgres`, `Postgres-fL7g`) y `MongoDB` están sin uso.

## Cómo deployar

⚠️ Los servicios **NO están conectados a GitHub** — pushear a `main` **NO** auto-deploya.
Para desplegar:

```bash
railway up --service <svc> --environment production --detach -m "mensaje"
# y pollear railway status --json hasta SUCCESS
```

Deployar **solo los servicios que tocaste** (back / front / inquilino).

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

⚠️ `railway run --service myalquiler-back` inyecta la URL **interna**
(`postgres-crj.railway.internal`), **inalcanzable** desde tu máquina. Para conectarte
desde local usá la **URL pública** del servicio Postgres:

```bash
# Obtener la URL pública (proxy) del Postgres de prod
PUBURL=$(railway variables --service Postgres-_cRj --environment production --json \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('DATABASE_PUBLIC_URL',''))")

# Correr un script de chequeo (read-only) con el cliente Prisma local
DATABASE_URL="$PUBURL" node apps/api/check.mjs   # ej: contar duplicados, ver índices, etc.
```

(La URL pública es `thomas.proxy.rlwy.net:<puerto>` — distinta del `.env` local,
que apunta a OTRA DB de test/dev en el mismo proxy con otro puerto.)

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

## ⚠️ NO correr los tests contra DB incierta

Las suites de `apps/api` (`vitest run`) pegan a una **DB remota de Railway** y hacen
resets/seed en `beforeAll`. Si no tenés certeza 100% de que NO es prod, **no las
corras** (regla dura: nunca arriesgar prod).

## Reglas duras (del dueño — innegociables)

1. **NUNCA `prisma migrate reset` contra prod.**
2. No correr acciones irreversibles (deploy, migración de schema, borrado) **sin
   confirmarlo en el chat**.
3. No crear cuentas / data de prueba en el tenant real (Tapia Propiedades).
4. Repo `soyalantapia/inmobiliaria-inquilinos-app`. gh token **sin** workflow scope
   (no tocar `.github/workflows/`). Pushear a `main` es OK en este repo.
