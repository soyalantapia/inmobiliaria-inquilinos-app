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
- **Volume `/data`**: contiene los archivos subidos. Railway no versiona el Volume
  automáticamente → para un respaldo, copiar `/data/uploads` vía `railway ssh` + `tar`.

## Deploy (referencia rápida)

```bash
railway up --service myalquiler-back --detach        # solo lo que tocaste
railway up --service myalquiler-front --detach
railway up --service myalquiler-inquilino --detach
```
Push a `main` **no** auto-deploya (los servicios no están conectados a GitHub). Después
de deployar: diagnóstico rápido + (si tocaste un endpoint) E2E mínimo. Detalle en
[`../work-agent/02-DEPLOY.md`](../work-agent/02-DEPLOY.md).

## Escalado / contacto

Owner: **Alan** (`soyalantapia` en GitHub). Para acciones irreversibles sobre prod
(migración de schema, borrado de datos, rotación de `JWT_SECRET`) → **confirmar primero**.
