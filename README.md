# My Alquiler

SaaS **multi-tenant** de gestión de alquileres (codename interno `@llave/*`).
Panel para la inmobiliaria + PWA para el inquilino. **En producción** para
**Tapia Propiedades**.

> 🧭 **¿Primera vez acá? Leé [`PROJECT.MD`](./PROJECT.MD)** — el documento maestro
> con el contexto absoluto del proyecto (qué es, arquitectura, modelo de datos, API,
> plata, auth, deploy, auditorías, decisiones, roadmap).
>
> 📂 **Handoff operativo del día a día en [`work-agent/`](./work-agent/)** — empezá
> por [`work-agent/00-ESTADO.md`](./work-agent/00-ESTADO.md).

---

## 🌐 En vivo (Railway)

| | URL |
|---|---|
| **Panel inmobiliaria** | https://admin.myalquiler.com |
| **PWA inquilino** | https://app.myalquiler.com |
| **API** | https://api-production-262e.up.railway.app — `GET /health` → `{ok, db, ts}` |

Tenant real: **Tapia Propiedades** · admin `alannaimtapia@gmail.com` / `Tapia.2026!` / **PIN 1234**.

---

## 🧱 Stack

Monorepo **pnpm `10.28` + turbo**, **TypeScript** estricto, **Node ≥ 20**.

| Capa | Qué | Versión |
|---|---|---|
| **Backend** `apps/api` | Fastify + Prisma + **Postgres** (multi-tenant por `inmobiliariaId`), ESM, build `tsup` (node22) | Fastify `5.2` · Prisma `6.2` |
| **Panel** `apps/inmobiliaria` | **Next.js 14** (App Router, desktop-first) + TanStack Query | Next `14.2.35` · React `18.3.1` · RQ `5.101` |
| **PWA** `apps/inquilino` | **Next.js 14** (App Router, mobile-first, PWA) + TanStack Query | igual que el panel |
| **Packages** | `@llave/shared` (permisos + schemas JWT), `@llave/ui` (shadcn/Radix, tokens violeta/lavanda), `@llave/config` (tsconfig + tailwind) | — |

- **Auth**: OTP + JWT **propio** (NO Clerk — el README viejo estaba desactualizado).
  3 tipos de token (usuario panel / inquilino / co-inquilino), todos con `inmobiliariaId`.
- **Frontend ramifica por `apiEnabled`** (`NEXT_PUBLIC_API_URL`): API real (prod) vs
  mock/localStorage (demo). **Ambos modos deben andar.**
- **File storage**: Railway Volume (`/data`) + endpoint `/uploads` (multipart).
- **Cron de devengo**: in-process (cada 6h, idempotente) — genera liquidaciones futuras.

Cifras: **153 endpoints · 75 modelos Prisma · 74 enums** (schema ~2330 líneas).

El **core de archivos/adjuntos está 100% construido** (E2E, con demo intacta):
avatar del inquilino y del usuario del panel, documentos del inquilino (DNI/recibos/garante),
flujo del profesional por link mágico (fotos antes/después), validador de resumen bancario
(CSV/Excel, matching determinístico **sin IA**) y migración de cartera (mapeo flexible de columnas).

---

## 📁 Estructura

```
apps/
  api/            # Fastify + Prisma. routes: auth, core, plata, operacion,
                  #   inquilino-mundo, anuncios, uploads, documentos,
                  #   servicios-publicos, mi-perfil, visitas-publicas,
                  #   resumenes-bancarios, importaciones-cartera,
                  #   health.  (prisma/schema.prisma + migraciones)
  inmobiliaria/   # panel admin (Next 14, desktop-first)
  inquilino/      # PWA inquilino (Next 14, mobile-first)
packages/
  shared/         # @llave/shared — permisos.ts, auth.ts (JWT schemas)
  ui/             # @llave/ui — design system
  config/         # @llave/config — tsconfig + tailwind
work-agent/       # 📂 documentación de handoff (LEER al entrar)
scripts/          # build-landing, onboarding-real.mjs, reset-qa.mjs, ...
PROJECT.MD        # 📖 documento maestro (contexto absoluto)
README.md         # este archivo (orientación + tooling)
```

---

## 📂 Qué hay en `work-agent/` (handoff)

La carpeta `work-agent/` es la fuente de verdad operativa. Cada archivo:

| Archivo | Para qué |
|---|---|
| **`00-ESTADO.md`** | Resumen ejecutivo de **dónde está el proyecto hoy** + qué sigue. Empezá acá. |
| **`01-ARQUITECTURA.md`** | Stack, estructura del backend, **multi-tenant**, roles/capacidades, **modelo de plata**, patrones canónicos (lock atómico, error handler), `apiEnabled`, auth. |
| **`02-DEPLOY.md`** | **Railway** (servicios, dominios), cómo deployar (`railway up`), migraciones, **cómo consultar la DB de prod**, Volume, smoke test, verificación local. |
| **`03-AUDITORIAS.md`** | Historia de las campañas de auditoría multi-agente + metodología + falsos positivos conocidos (no re-arreglar). |
| **`04-PENDIENTES.md`** | **Qué falta / roadmap** — el punto de partida del próximo chat. |
| **`05-DECISIONES.md`** | **Decisiones de negocio del dueño** (no des-arreglar) + reglas duras + datos del tenant real. |
| **`06-ANALISIS-SENIOR.md`** | Análisis dev senior: dónde estamos / qué falta / roadmap en olas. |
| **`PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md`** | Prompt reutilizable para correr una auditoría/QA en loop hasta que no haya errores. |

> Documentos históricos (auditorías/reportes/prompts viejos) archivados en
> [`work-agent/historico/`](./work-agent/historico/).

---

## 📚 Referencias técnicas (`docs/`)

| Documento | Para qué |
|---|---|
| [`docs/API.md`](./docs/API.md) | Referencia de los **153 endpoints** (auth, request, respuesta, errores, reglas). |
| [`docs/DATA-MODEL.md`](./docs/DATA-MODEL.md) | **Modelo de datos** — ERD (mermaid), `onDelete` de las FK, multi-tenant, uniques. |
| [`docs/CONFIG.md`](./docs/CONFIG.md) | **Variables de entorno** por app (requerida, default, dónde se setea). |
| [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) | **Operaciones / on-call** — incidentes, rollback, DB, rotación de secretos. |
| [`docs/TESTING.md`](./docs/TESTING.md) · [`docs/FRONTEND.md`](./docs/FRONTEND.md) · [`docs/GLOSARIO.md`](./docs/GLOSARIO.md) | Testing · guía de front (`apiEnabled`/hooks/`@llave/ui`) · glosario del dominio. |

Y en la raíz: [`CONTRIBUTING.md`](./CONTRIBUTING.md) · [`SECURITY.md`](./SECURITY.md) · [`CHANGELOG.md`](./CHANGELOG.md).

---

## 🧰 Lo que tenemos a mano (tooling y accesos)

- **Railway** (proyecto **MYALQ**, env `production`): 3 servicios deployables
  (`myalquiler-back`, `myalquiler-front`, `myalquiler-inquilino`) + Postgres de prod.
  CLI autenticada → `railway up`, `railway variables`, `railway ssh`, `railway logs`.
  - ⚠️ Los servicios **NO** están conectados a GitHub → push a `main` **no** auto-deploya.
- **DB de prod**: host interno (no resuelve desde tu Mac). Para consultarla:
  `railway ssh --service myalquiler-back "node --input-type=module -e '…PrismaClient…'"`.
- **DB de test**: una Postgres **distinta** (host público `thomas.proxy.rlwy.net`, en
  `apps/api/.env`). Las suites de `apps/api` (vitest) la usan; se re-seedea en cada corrida.
- **Suite de tests**: `pnpm --filter api test` (vitest + `app.inject` + `seedBase`).
- **E2E contra prod**: mintear un JWT con `JWT_SECRET` y probar con `curl` (con
  cleanup/restore — nunca ensuciar el tenant real). Ejemplos en `02-DEPLOY.md`.
- **Email**: SMTP Hostinger (`myalquiler@xnod.tech`). **Storage**: Railway Volume `/data`.
- **Prompt de auditoría**: `work-agent/PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md`.

> Integraciones declaradas en `.env.example` pero **aún no cableadas** (roadmap):
> MercadoPago (`MP_*`), screening NOSIS (`NOSIS_*`), WhatsApp (`WHATSAPP_*`),
> Cloudflare R2 (`R2_*`), Resend (`RESEND_API_KEY`), IA/OCR (`ANTHROPIC_*`), Redis.

---

## ⚡ Setup local

Requiere **Node ≥ 20** y **pnpm 10** (`corepack enable` o `npm i -g pnpm`).

```bash
pnpm install
pnpm dev                  # levanta panel + inquilino (turbo)
# o por app:
pnpm dev:inmobiliaria     # panel  → http://localhost:3001
pnpm dev:inquilino        # PWA    → http://localhost:3000
```

**Backend local**: necesita `DATABASE_URL` (Postgres) y `JWT_SECRET` en
`apps/api/.env`. Levantar con `pnpm --filter api dev` (tsx watch). Comandos Prisma:
`pnpm --filter api db:generate | db:migrate | db:deploy | seed`.

Variables del front: `NEXT_PUBLIC_API_URL` (vacío = modo demo/mock; seteado = API real).

---

## ✅ Verificar antes de deployar (siempre)

```bash
pnpm --filter api exec tsc --noEmit && pnpm --filter api build
pnpm --filter @llave/inmobiliaria exec tsc --noEmit && pnpm --filter @llave/inmobiliaria build
pnpm --filter @llave/inquilino exec tsc --noEmit && pnpm --filter @llave/inquilino build
```

## 🚀 Deploy

```bash
railway up --service myalquiler-back --detach        # solo el/los servicio(s) que tocaste
railway up --service myalquiler-front --detach
railway up --service myalquiler-inquilino --detach
```

Después: smoke test (`GET /health` → `{db:"up"}`) y, si tocaste un endpoint, un E2E
mínimo contra prod. Detalle en [`work-agent/02-DEPLOY.md`](./work-agent/02-DEPLOY.md).

---

## 🤝 Trabajar en equipo

El objetivo de esta documentación es **centralizar todo** para que varias personas
puedan trabajar el proyecto:

1. **Onboarding**: leé [`PROJECT.MD`](./PROJECT.MD) (contexto absoluto) → luego
   `work-agent/00-ESTADO.md` (estado de hoy) → `04-PENDIENTES.md` (qué sigue).
2. **Antes de tocar plata/auth/multi-tenant**: leé `01-ARQUITECTURA.md` y
   `05-DECISIONES.md` — hay reglas LOCKED del dueño que **no** se des-arreglan.
3. **Ramas**: trabajá en una rama y abrí PR; pushear a `main` está OK en este repo.
4. **Mantené los docs al día**: si agregás un endpoint, una regla de plata o un
   modelo, actualizá `PROJECT.MD` (sección afín) y el archivo de `work-agent/`
   correspondiente en el mismo PR. Documentación desactualizada = deuda.

## 🛑 Reglas duras

- **NUNCA** `prisma migrate reset` contra prod.
- No correr acciones irreversibles (deploy, migración de schema, borrado) sin confirmar.
- **No crear data de prueba en el tenant real** (Tapia Propiedades).
- gh token **sin** workflow scope → no tocar `.github/workflows/`.

Detalle en [`work-agent/05-DECISIONES.md`](./work-agent/05-DECISIONES.md).
