# 🏗️ BACKEND de My Alquiler — arquitectura y operación

> Estado vivo del avance: `BACKEND-PROGRESS.md` · Endpoints planificados: `BACKEND-ENDPOINTS.md`

## Arquitectura

```
apps/inquilino  (:3000, Next export estático)  ─┐
apps/inmobiliaria (:3001, Next export estático) ─┤── fetch JSON + JWT Bearer ──▶ apps/api (:3002)
                                                 │                                Fastify 5 + Prisma 6
GH Pages (demo)  ────────────────────────────────┘                                      │
                                                                                  PostgreSQL (Railway)
```

- **apps/api**: Fastify 5 + TypeScript + Prisma + Zod. `buildApp()` (testeable con
  `app.inject()`) separado de `index.ts`. helmet + rate-limit (300/min) + CORS
  (localhost:3000/3001 + soyalantapia.github.io) + `trustProxy` (IP real en Railway).
- **packages/shared** (`@llave/shared`): schemas Zod de auth + **matriz de
  permisos** (roles ADMIN/OPERADOR/CARGA/LECTURA × capacidades; copia 1:1 del front).
- **Multi-tenant**: todo modelo lleva `inmobiliariaId`; el JWT carga
  `{kind, userId|inquilinoId, inmobiliariaId, rol|contratoId}`.
- **Front**: TanStack Query + `lib/api/client.ts` (apiFetch con Bearer) +
  `lib/api/hooks.ts` por app. **Flag `NEXT_PUBLIC_API_URL`**: vacío → los hooks
  usan los stores localStorage de siempre (la demo de GH Pages queda intacta y
  offline); seteado → datos reales del API con fallback automático si el server
  no responde.
- **Schema**: 72 modelos + 72 enums derivados de los stores del front (ids de
  mocks preservados: `cnt_001`, `prp_001`, `own_001`, `cnsr_001`…).

## Cómo correr todo (dev)

```bash
# 1. API (puerto 3002) — requiere apps/api/.env (DATABASE_URL de Railway, JWT_SECRET, DEMO_MODE=true)
pnpm --filter api dev

# 2. Apps (modo API: crear apps/*/. env.local con NEXT_PUBLIC_API_URL=http://localhost:3002)
pnpm --filter inquilino dev      # :3000  (login demo: /login?demo=1)
pnpm --filter inmobiliaria dev   # :3001  (auto-sesión dev de Roberto)

# Tests de integración (contra la DB real, suites secuenciales)
pnpm --filter api test

# Seeds (idempotentes, ids exactos de los mocks)
pnpm --filter api seed

# Migraciones
pnpm --filter api db:migrate     # dev (interactivo)
pnpm --filter api db:deploy      # prod/Docker (no interactivo)
```

## Credenciales seed (DEV/DEMO)
| Quién | Acceso |
|---|---|
| Roberto Tapia (ADMIN) | `roberto@delsol.com` / `delsol123` · PIN `1234` |
| Luciana Vidal (OPERADOR) · Camila Acosta (CARGA) | mismo password/PIN |
| Mariela Sosa (inquilina, cnt_001) | OTP a `mariela.sosa@gmail.com` (código en el log del API; `000000` con DEMO_MODE) o `?demo=1` |

## Variables de entorno (API)
| Var | Qué |
|---|---|
| `DATABASE_URL` | Postgres Railway (pública para dev local; en Railway usar la interna). Sugerido: `?connection_limit=8&pool_timeout=30` |
| `JWT_SECRET` | ≥16 chars |
| `DEMO_MODE` | `true` habilita `/auth/demo` y el OTP backdoor `000000` |
| `CORS_ORIGINS` | coma-separado (default: localhost + GH Pages) |
| `PORT` | default 3002 |

## Deploy (Railway)
- Proyecto: `distinguished-adaptation` (CLI ya linkeada). DB: service `Postgres`.
- API: `Dockerfile` en `apps/api` (contexto = raíz del monorepo; corre
  `prisma migrate deploy` al arrancar). Deploy: `railway up` desde la raíz con el
  service del API seleccionado, o conectar el repo en el dashboard.
- Front productivo contra el API: setear `NEXT_PUBLIC_API_URL` en el build de GH
  Pages (⚠️ tocar `.github/workflows/` requiere `gh auth refresh -s workflow`
  del dueño ANTES del push) y sumar el dominio de Pages a `CORS_ORIGINS`.
- Smoke de prod: `node scripts/smoke-prod.mjs <api-url>`.

## Decisiones clave
- JWT Bearer en localStorage (sin cookies cross-site GH Pages↔Railway).
- Seeds = mocks: la demo se ve idéntica con datos reales.
- Acuses de anuncios, estados de pago, SLA, certificado y conteos: **derivados
  server-side** (nada simulado en el front cuando hay API).
- bcryptjs (sin binarios nativos). OTP hasheado, TTL 10min, un solo uso,
  anti-enumeración de emails.
- Acciones sensibles (conciliar/rechazar pago, rendir, aprobar, eliminar gasto):
  **PIN obligatorio validado por el server** + matriz de permisos por rol.
- Reportes piloto: tracking server-side (IP de `x-forwarded-for`, userAgent,
  identidad del JWT). Definir retención antes de producción real con usuarios.

## Qué falta (ver BACKEND-PROGRESS.md)
- Front de pantallas de plata restantes: `/pagos` (PagosPorValidar, 726 líneas),
  checkout/comprobantes del inquilino, reclamos/renovaciones/consorcios y
  pantallas del mundo inquilino contra sus endpoints (los endpoints YA existen
  y están testeados; es trabajo de hooks+adaptadores como caja/aprobaciones/anuncios).
- Pantalla de login real del panel (hoy auto-sesión dev de Roberto).
- Deploy del API a Railway (requiere OK del dueño) + switch del front.
- Email real de OTP (Resend) — opcional, el log/backdoor cubre demo.
