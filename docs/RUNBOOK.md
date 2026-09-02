> # ⛔ OJO: TODO LO DE ABAJO ES DE RAILWAY, Y RAILWAY YA NO EXISTE
>
> El 28/08/2026 Railway restringió la cuenta entera. **Desde el 29/08 producción corre en
> Render.** Los nombres de servicio, las URLs, los comandos `railway …` y el «`git push` ES el
> deploy» que se leen más abajo **son todos falsos hoy**.
>
> Esto está arriba de todo a propósito: el que lee este documento está de guardia, con algo
> roto, leyendo bajo presión. Lo primero que necesita es no perder veinte minutos en una
> plataforma que no le va a contestar.
>
> | qué | dónde, hoy |
> |---|---|
> | API | [`myalq-api`](https://dashboard.render.com/web/srv-da99tce7bikc738o2o20) · `https://myalq-api.onrender.com` |
> | Panel | [`myalq-panel`](https://dashboard.render.com/web/srv-da99ut142hec73f7tltg) · `https://myalq-panel.onrender.com` |
> | PWA del inquilino | [`myalq-inquilino`](https://dashboard.render.com/web/srv-da99utgn74is73fckvog) · `https://myalq-inquilino.onrender.com` |
> | Base | `myalq-db` (Postgres 16) |
>
> - **Salud:** `curl -s https://myalq-api.onrender.com/health` → trae `version` con el SHA que
>   se está sirviendo.
> - **Deploy:** `autoDeploy` está en **no** en los tres servicios. Mergear a `main` NO despliega;
>   se dispara a mano desde el dashboard de cada uno.
> - **Vuelta atrás:** dashboard del servicio → *Deploys* → *Rollback*. Ojo: la API aplica las
>   migraciones al arrancar, así que volver el código **no vuelve el esquema**.
> - **Logs:** dashboard del servicio → *Logs*. No hay `railway logs`.
>
> El expediente de la migración vive fuera del repo, en `deenex-infra` (`MYALQ.md`).

# Runbook — Operaciones / on-call

Qué hacer cuando algo se rompe en producción. App de plata en prod → seguí los pasos,
no improvises sobre el tenant real. Infra: **Railway** (proyecto MYALQ, env
`production`). Ver también [`../work-agent/02-DEPLOY.md`](../work-agent/02-DEPLOY.md).

## Servicios y dominios

| Servicio Railway | Qué | URL |
|---|---|---|
| `myalquiler-back` | API (Fastify) + Volume `/data` + `migrate deploy` al arrancar | api-production-262e.up.railway.app |
| `myalquiler-front` | panel | admin.myalquiler.com |
| `myalquiler-inquilino` | PWA | app.myalquiler.com |
| `Postgres-_cRj` | DB de prod (host interno) | — |

## Diagnóstico rápido (primero esto)

```bash
API="https://api-production-262e.up.railway.app"
curl -s "$API/health"                                   # → {ok:true, db:"up", ts}
curl -s -o /dev/null -w "%{http_code}\n" "$API/liquidaciones"   # → 401 (vivo, no 500)
curl -s -o /dev/null -w "%{http_code}\n" https://admin.myalquiler.com
curl -s -o /dev/null -w "%{http_code}\n" https://app.myalquiler.com
railway logs --service myalquiler-back                  # logs en vivo
railway status                                          # estado de los deploys
```

- `health` da `db:"down"` o no responde → **DB caída** (ver abajo).
- `health` OK pero un endpoint da 500 → bug de código → revisar logs + rollback.
- El front da 502/error pero la API anda → problema del build del front → redeploy.

## Incidentes comunes

### 1. La API está caída / responde 5xx
1. `railway logs --service myalquiler-back` → buscá el stacktrace.
2. Si fue un deploy reciente que rompió → **rollback** (abajo).
3. Si es la DB → ver incidente 2.
4. Si `migrate deploy` falló al arrancar (el back no levanta): casi siempre una
   migración nueva chocó con datos existentes (ej. un constraint único sobre filas
   duplicadas). Revisá el log del arranque; puede requerir limpiar el duplicado en la
   DB **antes** de re-deployar. **Nunca** `migrate reset`.

### 2. La DB está caída / lenta
1. En el dashboard de Railway, ver el servicio `Postgres-_cRj` (CPU/memoria/conexiones).
2. `GET /health` → `db:"down"` confirma que la API no puede conectar.
3. Si es saturación de conexiones, reiniciar el back (que recicla el pool) suele ayudar:
   redeploy o restart del servicio en Railway.
4. Consultar la DB (ver "Acceso a la DB de prod").

### 3. Un deploy salió mal → ROLLBACK
Railway guarda los deploys anteriores. Para volver al último que funcionaba:
- Dashboard Railway → servicio → pestaña **Deployments** → en un deploy verde anterior,
  **"Redeploy"** (o "Rollback"). Eso vuelve a ese build sin re-buildear.
- Alternativa por código: `git revert <commit>` → `tsc`+`build` → `railway up --service <svc> --detach`.
- Verificá con el diagnóstico rápido después.

### 4. CORS bloquea al front
Síntoma: el front no puede llamar a la API (errores CORS en consola del browser).
Causa: `CORS_ORIGINS` del back no incluye el dominio del front. Fix: agregar el dominio
a la var `CORS_ORIGINS` en Railway (back) y redeploy.

### 5. El cron no devengó (faltan liquidaciones de meses futuros)
El cron es **in-process** (cada 6h, `cron.ts`) → si el back estuvo caído mucho tiempo,
puede no haber corrido. Disparalo a mano:
```bash
SECRET=$(railway variables --service myalquiler-back --json | python3 -c "import sys,json;print(json.load(sys.stdin)['CRON_SECRET'])")
curl -s -X POST -H "x-cron-secret: $SECRET" "$API/internal/cron/devengar"   # → {contratosProcesados, liquidacionesNuevas}
```
Es **idempotente** (no duplica). Si `CRON_DEVENGO=off`, el scheduler está apagado a propósito.

### 6. No llegan los emails (OTP / notificaciones)
El email va por **SMTP Hostinger** (`myalquiler@xnod.tech`). Revisá las credenciales
SMTP en las vars del back y los logs del envío. Verificá que el dominio tenga SPF/DKIM ok.

### 7. Se "perdieron" archivos subidos (comprobantes/documentos)
Los archivos viven en el **Volume `myalquiler-back-volume`** montado en `/data`. Si un
`GET /uploads/...` da 404 pero el registro existe en la DB, revisá que el Volume esté
montado (dashboard Railway → servicio back → Volumes). El Volume **persiste** entre
deploys; no se borra al redeployar.

### 8. `prisma migrate deploy` falla al levantar: "migration not found in migrations directory"

Síntoma: el back **no arranca** (el `CMD` corre `pnpm db:deploy` antes de `node`) y el log
dice que una migración **aplicada en la DB no existe en el repo**. Casi siempre es una
migración que se **renombró** después de aplicarse: Prisma matchea por nombre de carpeta,
así que para la DB quedó una entrada huérfana en `_prisma_migrations`.

El caso conocido de este repo: `20260612042420_nucleo_completo`. Si restaurás un dump
viejo (o levantás una DB nueva desde un backup previo al rename), marcá la migración como
ya aplicada **sin volver a correrla**:
```bash
railway ssh --service myalquiler-back \
  "npx prisma migrate resolve --applied 20260612042420_nucleo_completo"
```
`resolve --applied` **sólo escribe la fila en `_prisma_migrations`**; no toca el esquema.
Es lo correcto acá justamente porque el SQL ya está aplicado en esa DB.

🚫 **Nunca** `prisma migrate reset` contra prod: borra todos los datos. Si `resolve` no
alcanza, parar y escalar al owner — no improvisar sobre la DB del cliente.

## Acceso a la DB de prod (read-only / queries puntuales)

El host de prod es **interno** (no resuelve desde tu Mac). Corré la query **dentro** del
contenedor vía `railway ssh`:
```bash
railway ssh --service myalquiler-back \
  "node --input-type=module -e 'import{PrismaClient}from\"@prisma/client\";const p=new PrismaClient();console.log(await p.contrato.count());await p.\$disconnect();'"
```
⚠️ **Solo lectura para diagnóstico.** Cualquier escritura en prod requiere confirmación
del owner (regla dura).

## Rotación de secretos

- **`JWT_SECRET`**: cambiarlo en la var del back **invalida TODAS las sesiones** (todos
  re-loguean). Hacelo solo si hay sospecha de filtración. Setear la nueva var en Railway
  → redeploy. Avisar que todos van a tener que volver a entrar.
- **`CRON_SECRET`**: rotar no afecta usuarios (solo el cron externo). Cambiar la var → redeploy.
- **SMTP / DB**: rotar en Railway → redeploy. Verificar con el diagnóstico rápido.

## Backup / restore

- **DB**: Railway hace backups del Postgres (ver el plan/servicio en el dashboard). Para
  un backup manual: `pg_dump` contra la DB (vía `railway ssh` o la URL si está expuesta).
- ⚠️ **Al restaurar un dump viejo**, `migrate deploy` puede fallar por la migración
  renombrada → ver el incidente 8 (`migrate resolve --applied`, nunca `reset`).
- **Volume `/data`**: contiene los archivos subidos. Railway no versiona el Volume
  automáticamente → para un respaldo, copiar `/data/uploads` vía `railway ssh` + `tar`.

## Deploy (referencia rápida)

> ### 🚨 `git push origin main` **ES** EL DEPLOY
>
> Los tres servicios están conectados al repo. Un push los dispara a los tres, y el backend
> arranca con `prisma migrate deploy`, así que **se lleva las migraciones pendientes con él**.
> No hay paso manual ni confirmación intermedia.
>
> Este documento decía lo contrario —"push a `main` no auto-deploya, los servicios no están
> conectados a GitHub"— y era falso. Se comprobó el 20/08: un push llevó 208 commits y trece
> migraciones a producción, dos de ellas irreversibles. **Si estás de guardia leyendo esto
> bajo presión, esa frase te iba a hacer pushear tranquilo.**
>
> Todo lo que haya que revisar —migraciones que escriben datos, evidencia que se destruye,
> secretos— se revisa ANTES del push.

`railway up` sirve sólo para forzar un deploy sin tocar el repo:

```bash
railway up --service myalquiler-back --detach        # solo lo que tocaste
railway up --service myalquiler-front --detach
railway up --service myalquiler-inquilino --detach
```

Después de deployar: diagnóstico rápido + (si tocaste un endpoint) E2E mínimo. Detalle en
[`../work-agent/02-DEPLOY.md`](../work-agent/02-DEPLOY.md).

### El portal del propietario no tiene servicio propio

Vive **adentro del panel**, en `https://admin.myalquiler.com/propietario`, como export
estático que se genera durante el build de `myalquiler-front`. Consecuencias para el que
está de guardia:

- No aparece en la lista de servicios de Railway. Buscarlo ahí y no encontrarlo **no**
  significa que esté caído.
- **No tiene rollback propio.** Volver atrás el portal es volver atrás el panel entero.
- Si su build falla, falla el deploy del panel completo y Railway se queda con la imagen
  anterior: `/propietario` sigue respondiendo **200 con código viejo**, mientras la API del
  mismo push ya deployó con sus migraciones. Un smoke test que sólo mire el código HTTP da
  verde con el deploy caído.

```bash
curl -s -o /dev/null -w "%{http_code}
" https://admin.myalquiler.com/propietario
# Y para saber QUÉ versión está sirviendo, que es lo que el 200 no dice:
curl -s https://admin.myalquiler.com/propietario | grep -o 'build-commit[^>]*'
```

## Escalado / contacto

Owner: **Alan** (`soyalantapia` en GitHub). Para acciones irreversibles sobre prod
(migración de schema, borrado de datos, rotación de `JWT_SECRET`) → **confirmar primero**.
