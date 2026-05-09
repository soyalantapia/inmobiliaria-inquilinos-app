# Llave

Plataforma inmobiliaria que centraliza alquiler + expensas + chat IA con el contrato + screening crediticio.

> Fuente de verdad del producto: [`CLAUDE.md`](./CLAUDE.md). Léelo antes de tocar código.

## Estructura

```
.
├── apps/
│   ├── inquilino/        # PWA del inquilino (Next 14, mobile-first, :3000)
│   └── inmobiliaria/     # Panel del admin (Next 14, desktop-first, :3001)
├── packages/
│   ├── ui/               # shadcn-based, tokens violeta/lavanda
│   └── config/           # tsconfig + tailwind preset compartidos
└── legacy/               # bartender-app (origen del repo, sin uso)
```

## Stack

Decidido en `CLAUDE.md` §2 (no cambiar sin consultar):

- Next.js 14 + Tailwind 3 + shadcn/ui
- TypeScript estricto
- Turborepo + pnpm workspaces
- Backend (Sprint 1): Fastify + Prisma + Postgres + pgvector — no incluido en esta primera tanda

## Setup

Requiere Node ≥ 20 y pnpm 9.

```bash
pnpm install
cp .env.example apps/inquilino/.env.local
cp .env.example apps/inmobiliaria/.env.local
pnpm dev
```

- Inquilino: <http://localhost:3000>
- Inmobiliaria: <http://localhost:3001>

Para correr una sola app: `pnpm dev:inquilino` o `pnpm dev:inmobiliaria`.

## Estado actual (frontend MVP)

### apps/inquilino — 7 pantallas (mobile-first)

| Ruta | Pantalla |
|------|----------|
| `/login` | OTP por WhatsApp (mock) |
| `/` | Home con cards de alquiler + expensas |
| `/pago/:liqId` | Detalle de la liquidación |
| `/pago/:liqId/checkout` | Checkout MP (mock) |
| `/contrato` | Chat RAG con el contrato (respuestas mock por regex) |
| `/reclamos/nuevo` | Formulario de problema |
| `/comprobantes` | Histórico con descarga PDF |

### apps/inmobiliaria — 8 pantallas (desktop-first)

| Ruta | Pantalla |
|------|----------|
| `/login` | Email + password (mock — Sprint 0 lo conecta a Clerk) |
| `/` | Dashboard con KPIs + gráfico + actividad |
| `/contratos` | Tabla con filtros por estado |
| `/contratos/:id` | Detalle con tabs Resumen/Pagos/Documentos/Historial/Comunicaciones |
| `/contratos/nuevo` | Wizard de 4 pasos con extracción IA mockeada |
| `/screening` | CUIT → resultado con recomendación |
| `/pagos` | Pagos del mes con KPIs y tabla |
| `/configuracion` | Empresa + equipo + plan + integraciones |

### Auth — Clerk opt-in

Las dos apps tienen el wiring completo de Clerk (`@clerk/nextjs`):
`ClerkProvider`, `clerkMiddleware` con protección de rutas, `<SignIn />` y
`<UserButton />` / `<SignOutButton />`.

El switch es por env var. Si `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` está
seteada, Clerk arranca real; si falta, las dos apps caen al mock para que
`pnpm dev` levante sin tener que crear cuenta de Clerk antes.

Para activarlo:

```bash
# en apps/inquilino/.env.local Y apps/inmobiliaria/.env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
CLERK_SECRET_KEY=sk_test_…
```

Y reiniciar `pnpm dev`. El login mock se reemplaza automáticamente por el
componente `<SignIn />` con tema violeta y los hooks `useUser()` empiezan
a devolver el usuario real.

> **Inquilino:** Clerk va a hacer OTP por SMS hasta que conectemos
> WhatsApp Cloud API en Sprint 3 (CLAUDE.md §6.1).

### Pendiente para terminar Sprint 0

- [ ] `apps/api` con Fastify + Prisma (no incluido en esta primera tanda — frontend-only)
- [ ] `packages/db` con schema Prisma + cliente
- [ ] `packages/ai`, `packages/integrations`
- [x] ~~Integración real con Clerk en ambos frontends~~ (wiring listo, falta pegar las keys reales)
- [ ] Vercel + Railway + Sentry + PostHog provisionados
- [ ] Seed de DB

### Pendiente Sprints 1-3

Ver `CLAUDE.md` §7. En orden: parser real con Claude, MP Marketplace, Nosis, WhatsApp Cloud.

## Convenciones

Ver `CLAUDE.md` §9. En resumen:

- `strict: true`, sin `any` salvo justificación inline
- Server Components por default; `'use client'` solo si hay interactividad real
- Forms con `react-hook-form` + `zod`
- Archivos en kebab-case, componentes en PascalCase
- Mobile-first inquilino, desktop-first inmobiliaria

## Scripts

```bash
pnpm dev           # levanta inquilino + inmobiliaria en paralelo
pnpm build         # build de todo el monorepo
pnpm lint          # eslint
pnpm typecheck     # tsc --noEmit en todos los paquetes
pnpm format        # prettier
```
