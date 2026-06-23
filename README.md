# My Alquiler

SaaS **multi-tenant** de gestión de alquileres (codename interno `@llave/*`).
Panel para la inmobiliaria + PWA para el inquilino. **En producción** para
**Tapia Propiedades**.

> 📂 **Handoff completo del proyecto en [`work-agent/`](./work-agent/)** — estado,
> arquitectura, deploy, auditorías, pendientes y decisiones. Empezá por
> [`work-agent/00-ESTADO.md`](./work-agent/00-ESTADO.md).
>
> 🔍 Prompt reutilizable de auditoría: [`AUDITORIA-PROFUNDA-PROMPT.md`](./AUDITORIA-PROFUNDA-PROMPT.md).

## EN VIVO (Railway)

| | |
|---|---|
| Panel inmobiliaria | **https://admin.myalquiler.com** |
| PWA inquilino | **https://app.myalquiler.com** |
| API | https://api-production-262e.up.railway.app (`GET /health`) |

## Stack

- **Backend** `apps/api`: Fastify + Prisma + **Postgres** (multi-tenant por `inmobiliariaId`).
- **Panel** `apps/inmobiliaria`: Next.js 15 (desktop-first) + TanStack Query.
- **PWA inquilino** `apps/inquilino`: Next.js 15 (mobile-first, PWA).
- **Packages** `@llave/{shared,ui,config}`. Monorepo pnpm + turbo, TypeScript estricto.

Auth: **OTP + JWT propio** (NO Clerk — el README viejo estaba desactualizado).
Frontend ramifica por `apiEnabled` (`NEXT_PUBLIC_API_URL`): real vs mock/demo.

## Estructura

```
apps/
  api/            # Fastify + Prisma (routes: auth, core, plata, operacion, inquilino-mundo, anuncios, health)
  inmobiliaria/   # panel admin
  inquilino/      # PWA inquilino
packages/{ui,shared,config}
work-agent/       # 📂 documentación de handoff (LEER PRIMERO)
AUDITORIA-PROFUNDA-PROMPT.md   # prompt reutilizable de auditoría
```

## Setup local

Requiere Node ≥ 20 y pnpm 9.

```bash
pnpm install
pnpm dev                  # levanta panel + inquilino
# o por app:
pnpm dev:inmobiliaria
pnpm dev:inquilino
```

El backend necesita `DATABASE_URL` (Postgres) y `JWT_SECRET` en `apps/api/.env`.
Ver [`work-agent/02-DEPLOY.md`](./work-agent/02-DEPLOY.md) para la mecánica de
producción (Railway, migraciones, cómo chequear la DB de prod, smoke test).

## Verificar antes de deployar

```bash
pnpm --filter api exec tsc --noEmit && pnpm --filter api build
pnpm --filter @llave/inmobiliaria exec tsc --noEmit && pnpm --filter @llave/inmobiliaria build
pnpm --filter @llave/inquilino exec tsc --noEmit && pnpm --filter @llave/inquilino build
```

## Estado

Lanzado y endurecido: **6 pasadas de auditoría multi-agente, ~50 bugs reales
arreglados**. Hay **~15 hallazgos de la última pasada sin aplicar** (varios son
regresiones de los fixes recientes) → ver
[`work-agent/04-PENDIENTES.md`](./work-agent/04-PENDIENTES.md), el punto de partida
del próximo chat.

## Reglas duras

- NUNCA `prisma migrate reset` contra prod.
- No correr acciones irreversibles sin confirmar en el chat.
- No crear data de prueba en el tenant real (Tapia Propiedades).
- gh token sin workflow scope (no tocar `.github/workflows/`).

Detalle en [`work-agent/05-DECISIONES.md`](./work-agent/05-DECISIONES.md).
