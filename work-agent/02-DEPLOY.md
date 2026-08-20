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

### Último deploy (2026-07-04)

✅ Los **3 servicios** (`myalquiler-back`, `myalquiler-front`, `myalquiler-inquilino`)
deployados vía `railway up`, **exit 0** cada uno ("Deploy complete"). HEAD == `origin/main`
== **535d15d**, árbol git **limpio**. **Ambos modos andan / demo intacta.**

- Migración **`20260703110000_avatar_credito_importacion`** aplicada en prod (la API booteó
  healthy con el schema nuevo).
- 4 rutas nuevas registradas en `apps/api/src/app.ts` (líneas 79-92): `miPerfilRoutes`,
  `visitasPublicasRoutes`, `resumenesBancariosRoutes`, `importacionesCarteraRoutes`. Vivas
  en prod (401 sin auth, 404 token inválido).

## Cómo deployar

> ## 🔴 CORRECCIÓN 20/08/2026 — esto estaba al revés, y es lo más importante de la página
>
> Decía que los servicios **no** estaban conectados a GitHub y que pushear a `main` **no**
> deployaba. **Es falso.** Los tres servicios tienen
> `Source repo: soyalantapia/inmobiliaria-inquilinos-app` (verificado contra la API de Railway,
> `get_service_config`).
>
> **Pushear a `main` deploya producción solo, sin pedir nada.** Se comprobó el 20/08: el push de
> `94d4000` disparó los tres deploys a las 01:09:45 UTC —el mismo segundo, el mismo SHA— y con
> ellos **trece migraciones**, una de las cuales borró datos de forma irreversible.
>
>
> | servicio | deployment del 20/08 | estado |
> |---|---|---|
> | `myalquiler-back` | `1d6f9d4b` | SUCCESS |
> | `myalquiler-front` | `7b75cfb7` | SUCCESS |
> | `myalquiler-inquilino` | `8873507e` | SUCCESS |
>
> Y las migraciones tampoco se aplican a mano: el `CMD` del Dockerfile del back corre
> `pnpm db:deploy && exec node dist/index.js`, así que corren ANTES de levantar y si fallan el
> contenedor no arranca. Por eso nunca puede quedar código nuevo contra un esquema viejo — y
> por eso también el push se lleva las migraciones puestas sin preguntar.
>
> Consecuencia práctica: **`git push origin main` ES el deploy.** No es un paso previo seguro.
> Todo lo que haya que revisar antes de tocar producción, hay que revisarlo antes del push, no
> entre el push y un `railway up` que nunca va a hacer falta.

El deploy normal es automático: **push a `main`**. Lo de abajo (`railway up`) sirve para forzar
un deploy sin pasar por git — por ejemplo para probar el working tree — y hay que usarlo sabiendo
lo que sube:

```bash
railway up --service <svc> --detach        # back / front / inquilino — solo lo que tocaste
# (el env activo ya es production; railway environment production si hace falta fijarlo)
```

⚠️ **`railway up` sube el WORKING TREE, no solo lo commiteado.** Antes de deployar,
**verificá que el árbol esté limpio** (`git status`) — si hay cambios sin commitear se van a
prod igual, aunque no estén en ningún commit. La regla es: commiteá primero, confirmá árbol
limpio, después `railway up`.

Y ojo con la otra mitad: como el push a `main` **sí** auto-deploya, un `railway up` desde un
árbol sucio queda **pisado** por el siguiente merge a `main`, en silencio. Si algo se subió así
y hace falta que sobreviva, tiene que terminar commiteado.

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
20260703110000_avatar_credito_importacion    # inquilinos.imageUrl + creditos_detectados(conciliado,pagoId 1:1→pagos) + tabla importaciones_cartera + enum EstadoImportacion. Aplicada en prod 2026-07-04
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

### ⚠️ En Windows el build del panel falla y NO es un problema del deploy

`pnpm --filter @llave/inmobiliaria build` termina en rojo en esta máquina con:

```
Error occurred prerendering page "/inicio/opengraph-image-b368cs"
TypeError: Invalid URL ... at fileURLToPath ... @vercel/og/index.node.js:18988
```

**Es un bug de Windows dentro del `@vercel/og` que Next 14 trae bundleado, no del repo.**
Esa línea hace `fileURLToPath(join(import.meta.url, "../noto-sans-v27-latin-regular.ttf"))`,
y `join` es `path.join`, que no sabe de URLs:

| plataforma | resultado del join | `new URL(...)` |
|---|---|---|
| win32 | `.\file:\repo\...\noto-sans.ttf` | **Invalid URL** ← lo que ves |
| posix | `file:/repo/.../noto-sans.ttf` | parsea, pathname `/repo/...` |

El parseo de URL es de spec y no depende del sistema operativo, así que **en el contenedor
de Railway (node:22-slim) no puede fallar**. Verificado el 20/08/2026 corriendo la
expresión exacta con `path.win32.join` y `path.posix.join`.

Qué NO es evidencia de lo contrario:

- Que `admin.myalquiler.com/inicio/opengraph-image` dé 404 hoy. Lo da porque lo que está
  arriba es anterior a `b50c511`, el commit que agregó la imagen — no porque el build la
  haya rechazado.
- Que el workflow de GitHub Pages esté verde. Ese build es `STATIC_EXPORT=1` y pasa por
  `scripts/build-static.sh`, que **renombra el `middleware.ts`** antes de compilar. Correr
  `STATIC_EXPORT=1 next build` a mano sin ese paso falla por otra cosa (`Can't resolve
  '@clerk/nextjs/server'`) y no compara nada.

**Si el deploy del panel a Railway alguna vez falla acá, eso sí es real** y hay que mirarlo:
el Dockerfile corre `next build` sin `STATIC_EXPORT`, que es exactamente el camino que
prerenderiza esta ruta.

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

---

## Qué hay arriba — 20/08/2026

Deploy automático disparado por el push del merge `94d4000` a `main`.

| servicio | URL | commit | verificado |
|---|---|---|---|
| API | `api-production-262e.up.railway.app` | `94d4000` | `/health` → `200 {"ok":true,"db":"up","version":"94d4000"}` |
| Panel | `admin.myalquiler.com` | `94d4000` | HTTP 200 |
| PWA inquilino | `app.myalquiler.com` | `94d4000` | HTTP 200 |
| Landing | `myalquiler.com` | `94d4000` | HTTP 200 |
| Demo estática | GitHub Pages | `94d4000` | 200, incluido `/propietario/` |

**Migraciones:** las trece pendientes se aplicaron en ese deploy —
*"All migrations have been successfully applied"* en el log.

**Smoke test de rutas** (sin auth, sólo para confirmar que están registradas y no rotas):
`/rendiciones`, `/caja/movimientos`, `/metricas/resumen`, `/portal/rendiciones`,
`/mis-liquidaciones` → **401** las cinco. Cero 500.

**CI:** las dos workflows verdes en ese push — `Revisión` (typecheck + 395 tests de API + 95 de
los fronts) en 1m05s, y `Deploy to GitHub Pages` en 2m24s. Es el **primer Pages verde desde el
3 de agosto**: los tres deploys anteriores en `main` estaban en failure.

### Cómo saber qué commit está arriba, de ahora en más

```bash
curl -s https://api-production-262e.up.railway.app/health          # API: campo "version"
curl -s https://admin.myalquiler.com | grep build-commit           # panel
curl -s https://app.myalquiler.com   | grep build-commit           # PWA
```

El `<meta name="build-commit">` de los fronts se agregó en **T-02-N1**: hasta entonces sólo la
API decía qué versión corría, y de los fronts no había forma de saberlo. Si dice `desconocido`,
es un build que se hizo sin `RAILWAY_GIT_COMMIT_SHA` ni `GITHUB_SHA` — no es un error, es el
fallback honesto.
