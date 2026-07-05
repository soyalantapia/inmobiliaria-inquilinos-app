# Arquitectura — My Alquiler

## Stack

- **Backend** `apps/api`: **Fastify 5 + Prisma 6 (Postgres)**. ESM, build con `tsup` (`node22`).
- **Panel** `apps/inmobiliaria`: **Next.js 14** (App Router, desktop-first), TanStack Query 5.
- **PWA inquilino** `apps/inquilino`: **Next.js 14** (App Router, mobile-first, PWA).
- **Packages**: `@llave/shared` (`permisos.ts`, `auth.ts`, schemas Zod), `@llave/ui`
  (shadcn/Radix, tokens violeta/lavanda), `@llave/config` (tsconfig + tailwind).
- **Monorepo**: pnpm `10.28` workspaces + turbo. TypeScript estricto. Node ≥ 20.

> Cifras: **105 endpoints · 72 modelos Prisma · 72 enums** (schema ~2220 líneas).
> Inventario completo de endpoints y modelos en [`../PROJECT.MD`](../PROJECT.MD) §4–5.

> ⚠️ El `README.md` viejo hablaba de "frontend MVP con Clerk, sin backend". Eso
> quedó OBSOLETO: hay backend real en prod y el auth es **OTP/JWT propio**, no Clerk.

## Estructura

```
apps/
  api/                 # Fastify + Prisma
    prisma/
      schema.prisma    # ~2200 líneas, multi-tenant
      migrations/      # 5 migraciones (ver 02-DEPLOY.md)
    src/
      index.ts         # entrypoint: buildApp() + listen + iniciarCronDevengo()
      app.ts           # bootstrap + ERROR HANDLER GLOBAL + registra routes/plugins
      env.ts           # EnvSchema (Zod) — valida env al arrancar
      db.ts            # PrismaClient singleton
      cron.ts          # scheduler in-process del devengo (cada 6h, idempotente)
      lib/
        liquidaciones.ts  # computar/generar liquidaciones + devengarTodosLosTenants
      auth/
        guards.ts      # requireAuth / requireUsuario / requireInquilino / requireContratoAcceso
        pin.ts         # verificarPinUsuario (kill-switch: siempre ok — PIN eliminado 05/07)
      routes/
        auth.ts        # login panel, OTP inquilino, PIN, co-invitación, registro
        core.ts        # contratos, propiedades (+PUT), propietarios, sociedades, usuarios,
                       #   empresa, cobranza, mercado, co-inquilinos (panel), servicios (vía sep.)
        plata.ts       # liquidaciones, pagos, rendiciones, caja, aprobaciones, cron global
        operacion.ts   # reclamos (SLA), profesionales, renovaciones, screening
        inquilino-mundo.ts  # API de la PWA (el más grande): contrato, pagos, boletas,
                       #   reclamos, co-inquilinos, servicios, mis-notificaciones
        anuncios.ts    # comunicaciones a inquilinos
        uploads.ts     # file storage (multipart) sobre Railway Volume
        documentos.ts  # documentos del contrato (CRUD)
        servicios-publicos.ts # servicios públicos por propiedad (CRUD)
        health.ts      # GET /health
  inmobiliaria/        # panel (Next 14)
  inquilino/           # PWA (Next 14)
packages/{shared,ui,config}
```

## Multi-tenant (CLAVE)

Toda fila está scopeada por **`inmobiliariaId`**. Los guards (en `apps/api/src/auth/guards.ts`):

- `requireUsuario(req, reply, capacidad?)` → `{ userId, inmobiliariaId, rol }`.
  Valida el JWT del panel + (opcional) que el rol tenga la capacidad.
- `requireInquilino(req, reply)` → `{ inmobiliariaId, inquilinoId, contratoId }`.
- `requireContratoAcceso(req, reply, minPermiso='VER')` → para co-inquilinos.
  **Revalida el permiso contra la DB en cada request** (no confía en el JWT, que
  vive 15 días). Jerarquía: `VER(1) < PAGAR(2) < COMPLETO(3)`.

**Regla de oro multi-tenant**: nunca hacer `findUnique/update/delete` por un id que
viene del request sin filtrar también por `inmobiliariaId`. Usar `findFirst` +
`inmobiliariaId`, y `updateMany/deleteMany` con `inmobiliariaId` en el WHERE.

## Roles y capacidades

Roles: `ADMIN | OPERADOR | CARGA | LECTURA`. Las capacidades por rol están en
`packages/shared/src/permisos.ts`. Ojo:

- `contratos.crear`, `propiedades.crear`, `propietarios.crear` **incluyen CARGA**
  con `rolesAprobacion: ['CARGA']` → lo que CARGA carga **requiere aprobación**.
- Por eso las acciones destructivas/irreversibles (DELETE propietario/propiedad,
  finalizar contrato) llevan un **guard de rol explícito** (`if (u.rol === 'CARGA')
  return 403`), porque la capacidad `*.crear` sola dejaría pasar a CARGA.

## Modelo de plata (CLAVE)

```
Liquidaciones  →  Pagos                    →  Rendiciones
(devengadas al    (INFORMADO → CONCILIADO      (bruto − comisión − gastos = neto,
 activar contrato) | RECHAZADO)                 al propietario)
```

- **Liquidacion**: tiene `montoAlquiler`, `montoExpensas`, `montoPunitorio`,
  `montoTotal` (= suma), `estado` (PENDIENTE/PARCIAL/PAGADO/VENCIDO). Se devengan
  al activar el contrato (`apps/api/src/lib/liquidaciones.ts`).
- **Pago**: el inquilino lo informa (`/pagos/informar`), la inmobiliaria lo
  concilia/rechaza (`/pagos/:id/validar` | `/rechazar`). Una liquidación queda
  PAGADO solo si la suma de pagos CONCILIADOS ≥ total; si no, PARCIAL.
- **Rendición**: lo que se le rinde al propietario. **DECISIÓN DEL DUEÑO**: la
  comisión y el neto se calculan **sobre el alquiler** (`montoAlquiler`, NO
  `montoTotal` — las expensas pasan al consorcio), y los gastos descontados son
  **solo los del período y solo de propiedades que aportaron ingreso** a esa
  rendición. Ver `05-DECISIONES.md`.

## Patrones canónicos (usar SIEMPRE)

- **Lock atómico** (anti-carrera, anti-doble-submit): en vez de leer-luego-escribir,
  `updateMany({ where: { id, estado: 'X' }, data: {...} })` → si `count === 0`
  significa que otra request ya cambió el estado → devolver **409**. Ejemplos:
  validar/rechazar pago, finalizar contrato, claim de propiedad, resolver/rechazar/
  asignar reclamo, aprobar contrato cargado.
- **Error handler global** (`apps/api/src/app.ts`): mapea `ZodError → 400`,
  `P2002/P2003 → 409`, `P2025 → 404`. **No hace falta try/catch** en cada endpoint
  para esos casos. (OJO: `P2034` —serialization failure de tx Serializable— NO
  está mapeado todavía; ver pendientes.)
- **Toda mutación que el cliente vaya a mapear debe devolver el objeto COMPLETO**
  (con sus relaciones), si no el front crashea con `undefined.map`.

## File storage (Railway Volume + `/uploads`)

Los archivos suben de verdad (antes solo viajaban metadatos). **Sin migración** (los
modelos ya tenían el campo URL):

- Volume `myalquiler-back-volume` en `/data`; `@fastify/multipart`. `routes/uploads.ts`:
  `POST /uploads` (allowlist jpeg/png/webp/gif/heic/pdf, 10 MB, guarda en
  `/data/uploads/<inmobiliariaId>/<uuid><ext>`) y `GET /uploads/:tenant/:name?token=`
  (sirve; valida tenant, anti path-traversal; acepta el token por query porque un
  `<img>/<a>` no manda header). Helpers `urlEsDelTenant` y `borrarArchivoSubido`.
- 4 flujos cableados: comprobante (`Pago.comprobanteUrl`), foto de reclamo
  (`Reclamo.fotoUrl`), boleta (`BoletaServicio.archivoUrl`), documentos del contrato
  (`DocumentoContrato.archivoUrl`, CRUD en `routes/documentos.ts`).

## Cron de devengo (`cron.ts`)

`computarLiquidacionesContrato` genera hasta "el mes que viene"; sin disparo periódico,
cada contrato se queda sin liquidaciones desde el 2º mes. Solución sin infra aparte:

- `iniciarCronDevengo` (arrancado en `index.ts` tras `listen`) corre
  `devengarTodosLosTenants(prisma)` ~30 s post-arranque y **cada 6 h**. Idempotente
  (`createMany skipDuplicates`) → seguro de repetir / 2 réplicas. Apagable con `CRON_DEVENGO=off`.
- `POST /internal/cron/devengar` (plata.ts): mismo devengo global, header
  `x-cron-secret == CRON_SECRET` (cerrado si la var no está) — para cron externo/test.

## apiEnabled (real vs demo) — CLAVE para el front

Cada pantalla del front ramifica por **`apiEnabled`** (= `NEXT_PUBLIC_API_URL`
seteado):

- `apiEnabled = true` → **API real** (producción).
- `apiEnabled = false` → **mock / localStorage** (build demo, GitHub Pages).

**Ambos modos deben andar.** Las dos clases de bug que aparecen acá una y otra vez:
1. **Mock en prod**: una pantalla que en prod sigue leyendo/persistiendo datos mock.
2. **Éxito falso**: un toast "guardado/enviado" cuando la API falló o nunca se llamó.

## Auth

- **Panel**: `POST /auth/login` (email + password, bcrypt). El email se busca
  **GLOBAL** (no por tenant) a propósito → por eso el alta de usuario chequea
  email único global (NO scopear por tenant, rompería el login). JWT 15 días.
- **Inquilino**: OTP por email (`/auth/otp/request` + `/auth/otp/verify`). Resuelto
  cross-tenant (identidad desde el hash del OTP por inquilino).
- **Co-inquilino**: invitación por link (JWT `kind:'co-invitacion'`), acepta y
  recibe su propia sesión (`kind:'co-inquilino'`) sin OTP.
- **PIN de seguridad — ELIMINADO (05/07):** ninguna acción pide PIN. `verificarPinUsuario`
  (`auth/pin.ts`) es un kill-switch que **siempre** aprueba; las acciones sensibles protegen
  por rol/capacidad + multi-tenant. `me.tienePin=false`. Ver `05-DECISIONES.md` §7. **No re-agregar.**
