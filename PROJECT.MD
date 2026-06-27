# PROJECT.MD — My Alquiler

> **Documento maestro del proyecto.** Contexto absoluto para que cualquier persona
> (o agente) pueda entrar a trabajar sin contexto previo. Si solo vas a leer un
> archivo, leé éste.
>
> Última actualización: **2026-06-27**. Estado: **en producción, endurecido**.
> Para el handoff operativo día-a-día, ver [`work-agent/`](./work-agent/) y el
> [`README.md`](./README.md).

---

## 1. Qué es

**My Alquiler** es un **SaaS multi-tenant de gestión de alquileres** para
inmobiliarias argentinas. Codename interno de los paquetes: **`@llave/*`**.

Resuelve el ciclo completo del alquiler para dos actores:

- **La inmobiliaria** (panel admin, desktop-first): carga su cartera (propiedades,
  propietarios, contratos), devenga y cobra alquileres, valida comprobantes,
  **rinde a los propietarios**, lleva la caja, gestiona reclamos con su red de
  profesionales, su equipo con roles, sus sociedades/empresas y la configuración.
- **El inquilino** (PWA, mobile-first): ve su contrato y liquidaciones, **informa
  pagos** con comprobante, sube boletas de servicios, abre y sigue reclamos,
  califica reparaciones, suma co-inquilinos y recibe notificaciones.

**Cliente productivo real:** **Tapia Propiedades** (primer tenant en vivo). El
sistema está diseñado multi-tenant desde el día 0: cada fila está scopeada por
`inmobiliariaId`, así que sumar inmobiliarias no requiere cambios de arquitectura.

### En vivo (producción, Railway)

| Servicio | URL |
|---|---|
| **Panel inmobiliaria** | https://admin.myalquiler.com |
| **PWA inquilino** | https://app.myalquiler.com |
| **API** | https://api-production-262e.up.railway.app (`GET /health` → `{ok, db, ts}`) |

Tenant real: **Tapia Propiedades**. Admin: `alannaimtapia@gmail.com` / `Tapia.2026!` / **PIN 1234**.

---

## 2. Estado actual (qué funciona hoy)

El **core está en producción y endurecido**: contratos, liquidaciones, pagos,
rendiciones, caja, reclamos, equipo, sociedades, co-inquilinos — **todo cableado al
API real** (no mock). Se hicieron múltiples campañas de auditoría multi-agente
(~50+ bugs reales arreglados a lo largo del proyecto) y el flujo de plata fue
auditado a fondo (money model, máquinas de estado, locks atómicos, constraints
únicos, multi-tenant).

**Hitos recientes (junio 2026):**

- ✅ **File storage REAL** (Railway Volume + endpoint `/uploads` multipart): los 4
  flujos de archivos suben de verdad — comprobante de pago, foto de reclamo, boleta
  de servicio y documentos del contrato. Ver §9.
- ✅ **Cron de devengo** (in-process, idempotente): genera las liquidaciones de los
  meses futuros sin intervención. Ver §10.
- ✅ **Servicios públicos** del panel persistidos (la inmo los carga, el inquilino
  los ve) y **edición de propiedad** que persiste de verdad (antes era un override
  de localStorage que en prod no guardaba nada).
- ✅ **Auditoría multi-agente 27/06** (workflow de 6 finders → verificación
  adversarial → crítico de completitud): **8 hallazgos confirmados, los 8
  fixeados/deployados/testeados** (co-inquilino panel, rating al panel, feed de
  notificaciones real, cuenta de cobranza del propietario, cierre de caja sin contar
  PROPIETARIO_DIRECTO, gasto multi-propietario conservado, validación de URLs,
  redondeo consistente). Ver §13.

**Pendiente (necesita decisión de producto/insumo, no es bug):** forma de pago del
plan SaaS (billing), programa de referidos, screening real (proveedor NOSIS),
broker IA/OCR (presupuesto). Ver §15.

---

## 3. Arquitectura

### Monorepo

```
inmobiliaria-inquilinos-app/        (repo: soyalantapia/inmobiliaria-inquilinos-app)
├── apps/
│   ├── api/            # Backend — Fastify 5 + Prisma + Postgres (ESM, build con tsup)
│   ├── inmobiliaria/   # Panel admin — Next.js 14 (App Router), desktop-first
│   └── inquilino/      # PWA inquilino — Next.js 14 (App Router), mobile-first, PWA
├── packages/
│   ├── shared/         # @llave/shared — permisos.ts, auth.ts (schemas Zod de JWT)
│   ├── ui/             # @llave/ui — design system shadcn/Radix + tokens (violeta/lavanda)
│   └── config/         # @llave/config — tsconfig + tailwind compartidos
├── work-agent/         # 📂 Documentación de handoff (LEER al entrar)
├── scripts/            # build-landing, onboarding-real.mjs, reset-qa.mjs, ...
├── prisma (en apps/api/prisma/)  # schema.prisma (~2220 líneas) + migraciones
├── PROJECT.MD          # este archivo
├── README.md           # orientación + setup + tooling
├── package.json        # workspace root (pnpm + turbo)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### Stack y versiones

| Capa | Tecnología | Versión |
|---|---|---|
| Gestor de paquetes | **pnpm** (workspaces) | `10.28.2` |
| Orquestador | **turbo** | tasks: build, dev, lint, typecheck, clean |
| Lenguaje | **TypeScript** estricto | `^5.9` |
| Node | runtime | `>=20` (build API target `node22`) |
| **Backend** | Fastify | `^5.2` |
| | Prisma Client | `^6.2` (Postgres) |
| | @fastify/jwt, /cors, /helmet, /multipart, /rate-limit | — |
| | bcryptjs (hash password/PIN), nodemailer (SMTP), zod | — |
| | build | **tsup** (ESM, `node22`, sourcemap) |
| **Panel** (`inmobiliaria`) | Next.js (App Router) | `^14.2` |
| | React | `^18.3` |
| | @tanstack/react-query | `^5.101` |
| | Tailwind + shadcn/Radix (`@llave/ui`) | — |
| **PWA** (`inquilino`) | Next.js (App Router) | `^14.2`, PWA |
| | React, react-query, Tailwind | igual que el panel |

> ⚠️ **Nota histórica:** un README muy viejo decía "frontend MVP con Clerk, sin
> backend". **OBSOLETO**: hay backend real en prod y el auth es **OTP/JWT propio**,
> no Clerk (queda un `scripts/clerk-noop.js` como shim de la migración).

### Estructura del backend (`apps/api/src`)

```
src/
├── index.ts            # entrypoint: buildApp() + listen + iniciarCronDevengo()
├── app.ts              # bootstrap Fastify + ERROR HANDLER GLOBAL + registra routes/plugins
├── env.ts              # EnvSchema (Zod) — valida env al arrancar
├── db.ts               # PrismaClient singleton
├── cron.ts             # scheduler in-process del devengo (cada 6h, idempotente)
├── auth/
│   ├── guards.ts       # requireAuth / requireUsuario / requireInquilino / requireContratoAcceso
│   └── pin.ts          # verificarPinUsuario (lockout anti-fuerza-bruta)
├── lib/
│   └── liquidaciones.ts  # computar/generar liquidaciones + devengarTodosLosTenants
└── routes/
    ├── auth.ts             # login panel, OTP inquilino, PIN, co-invitación, registro
    ├── core.ts             # contratos, propiedades, propietarios, sociedades, usuarios,
    │                       #   empresa, cobranza, mercado, co-inquilinos (panel)  [30 endpoints]
    ├── plata.ts            # liquidaciones, pagos, rendiciones, caja, cron global  [17 endpoints]
    ├── operacion.ts        # reclamos (SLA), profesionales, renovaciones, screening [15 endpoints]
    ├── inquilino-mundo.ts  # API de la PWA (el más grande): contrato, pagos, boletas,
    │                       #   reclamos, co-inquilinos, servicios, mis-notificaciones [15+ endpoints]
    ├── anuncios.ts         # comunicaciones a inquilinos  [5 endpoints]
    ├── uploads.ts          # file storage (multipart) sobre Railway Volume  [2 endpoints]
    ├── documentos.ts       # documentos del contrato (CRUD)  [3 endpoints]
    ├── servicios-publicos.ts # servicios públicos por propiedad (CRUD)  [3 endpoints]
    └── health.ts           # GET /health  [1 endpoint]
```

**Total: 105 endpoints, 72 modelos Prisma, 72 enums** (schema ~2220 líneas).

---

## 4. Modelo de datos (Prisma)

Schema en `apps/api/prisma/schema.prisma`. Toda fila lleva `inmobiliariaId`
(multi-tenant). Los modelos clave por dominio:

**Tenant / equipo / plan**
`Inmobiliaria`, `Usuario` (roles ADMIN/OPERADOR/CARGA/LECTURA + PIN), `Capacidad`,
`Aprobacion` (cargas de CARGA que requieren aprobación), `EventoAuditoria`, `Sociedad`
(multi-empresa), `Suscripcion`/`Factura`/`Cupon`/`TramoPlan` (billing — parcialmente
implementado), `Trial`, `Referido` (programa de referidos — pendiente).

**Inmuebles y partes**
`Propiedad`, `ParticipacionPropietario` (PK compuesta propiedad+propietario, con
`porcentaje` → multi-dueño), `Propietario`, `CuentaCobranzaDirecta` (CBU/alias del
dueño para PROPIETARIO_DIRECTO), `ArcaConfig` (datos AFIP).

**Contratos e inquilinos**
`Contrato` (estado BORRADOR/ACTIVO/FINALIZADO/RESCINDIDO; `modoCobranza`
INMOBILIARIA/PROPIETARIO_DIRECTO; índice de ajuste ICL/IPC/UVA/…), `ContratoDraft`,
`Inquilino` (titular), `CoInquilino` (permiso VER/PAGAR/COMPLETO, estado
PENDIENTE/ACEPTADO, `@@unique(contratoId,email)`), `Garante`, `Screening`,
`DocumentoContrato` (expediente: DNI, recibos, contrato firmado…),
`InquilinoInvitado`/`CoInquilinoInvitado` (invitaciones), `EventoContrato`,
`IntencionRenovacion`.

**Plata** (núcleo — ver §7)
`Liquidacion` (montoAlquiler/Expensas/Punitorio/Total; estado
PENDIENTE/PARCIAL/PAGADO/VENCIDO), `Pago` (estado INFORMADO/CONCILIADO/RECHAZADO),
`Comprobante`, `MovimientoCaja` (GASTO/INGRESO; `descontadoEnRendicion`),
`Rendicion` + `GastoRendido` (lo que se rinde al propietario; montos Decimal(14,2)),
`CierreCaja`, `CargoPagado`, `BoletaServicio` (boletas que sube el inquilino),
`ServicioPublico` (datos técnicos LUZ/GAS/AGUA… por propiedad).

**Reclamos / mantenimiento**
`Reclamo` (estado + SLA + clasificación USO_Y_GOCE/DESPERFECTO), `ReclamoEvento`
(timeline/chat MENSAJE_INMO/MENSAJE_INQUILINO), `Profesional` (red, con `rating`
ponderado), `VisitaProfesional` (ASIGNADO/CONFIRMADA/EN_CAMINO/LISTO),
`ConfirmacionReclamo`, `RatingReclamo` (calificación del inquilino).

**Consorcios** (administración de edificios)
`Consorcio`, `UnidadFuncional`, `MovimientoConsorcio`, `AsambleaConsorcio`,
`ItemInventario` + `MovimientoInventario`, `ServicioComunConsorcio`.

**Comunicaciones / banca / misc**
`Anuncio` + `AnuncioAcuse`, `CodigoOtp`, `Documento`/`SlotDocumento`/`CertificadoInquilino`,
`ChatMensaje` (asistente IA del contrato), `DatosBancarios`/`ResumenBancario`/
`CreditoDetectado` (conciliación bancaria — futuro), métricas internas
(`MetaSemestre`, `CohortMes`, `FunnelStep`, `FuenteAdquisicion`, `BloqueadorObjetivo`).

---

## 5. Superficie de API (105 endpoints)

Agrupados por área. Auth: `[U]` usuario panel · `[I]` inquilino/co-inquilino · `[P]` público · `[S]` secreto de servicio.

### Auth (`auth.ts`)
- `[P] POST /auth/login` — panel (email+password bcrypt, email **global** no por tenant). JWT 15 días.
- `[P] POST /auth/registro` — alta de inmobiliaria nueva (onboarding).
- `[P] POST /auth/otp/request` · `POST /auth/otp/verify` — login inquilino por OTP email.
- `[P] POST /auth/demo` — sesión demo (solo `NODE_ENV !== production`).
- `[U] POST /auth/pin` · `POST /auth/pin/verify` · `GET /auth/me` — PIN de seguridad + sesión.
- `[P] GET /co-invitacion/:token` · `POST /co-invitacion/:token/aceptar` — co-inquilino acepta su link.

### Core panel (`core.ts`)
- Contratos: `[U] GET /contratos`, `GET /contratos/:id`, `POST /contratos`, `POST /contratos/:id/finalizar`.
- Co-inquilinos (panel): `[U] GET/POST /contratos/:contratoId/co-inquilinos`, `DELETE …/:id`.
- Propiedades: `[U] GET /propiedades`, `GET /propiedades/:id`, `POST /propiedades`, **`PUT /propiedades/:id`**, `DELETE /propiedades/:id`.
- Servicios públicos: `[U] GET /propiedades/:propiedadId/servicios`, `PUT/DELETE …/:tipo`.
- Propietarios: `[U] GET /propietarios`, `GET /propietarios/:id`, `POST /propietarios`, `PUT /propietarios/:id/cuenta-cobranza-directa`, `DELETE …`.
- Sociedades: `[U] GET/POST /sociedades`, `PATCH /sociedades/:id`, `PUT /sociedades/:id` + `…/principal`.
- Empresa/cobranza/mercado: `[U] GET/PUT /empresa`, `GET/PUT /cobranza`, `GET/PUT /mercado`.
- Equipo: `[U] GET/POST /usuarios`, `PUT/DELETE /usuarios/:id`. Inquilinos: `[U] GET /inquilinos`.

### Plata (`plata.ts`)
- Liquidaciones: `[U] GET /liquidaciones`, `POST /liquidaciones/devengar` (tenant), **`[S] POST /internal/cron/devengar`** (global, header `x-cron-secret`).
- Pagos: `[U] GET /pagos`, `POST /pagos/:id/validar`, `POST /pagos/:id/rechazar` (ambos con PIN).
- Rendiciones: `[U] GET /rendiciones`, `POST /rendiciones`, `POST /rendiciones/:id/anular` (PIN).
- Caja: `[U] GET /caja/cierre`, `GET/POST /caja/movimientos`, `DELETE /caja/movimientos/:id`.
- Aprobaciones: `[U] GET /aprobaciones`, `POST /aprobaciones/:id/aprobar|rechazar` (PIN).

### Operación (`operacion.ts`)
- Reclamos: `[U] GET /reclamos`, `GET /reclamos/:id`, `POST …/asignar|resolver|rechazar|responder`.
- Profesionales: `[U] GET /profesionales`. Renovaciones: `[U] GET /renovaciones`, `POST /renovaciones/:contratoId/decision`.
- Screening: `[U] GET /screenings`, `POST /screening`.

### Mundo inquilino (`inquilino-mundo.ts`)
- `[I] GET /mi-contrato`, `GET /mis-liquidaciones`, `GET /certificado`, `GET /servicios`.
- Pagos: `[I] POST /pagos/informar` (cualquier co-inquilino, ver §13/decisiones).
- Boletas: `[I] GET/POST /boletas`. Reclamos: `[I] GET/POST /mis-reclamos`, `POST …/:id/confirmar-resolucion`, `POST …/:id/rating`.
- Co-inquilinos (inquilino): `[I] GET/POST /co-inquilinos`, `POST …/:id/aceptar|link`, `PATCH …/:id/permiso`, `DELETE …/:id`.
- Anuncios: `[I] GET /mis-anuncios`. **`[I] GET /mis-notificaciones`** (feed real, ver §13/D4). Reportes piloto: `[U/I] POST /reportes`, `GET /reportes`.

### Anuncios (`anuncios.ts`)
- `[U] GET/POST /anuncios`, `POST /anuncios/:id/<accion>`, `DELETE /anuncios/:id`.

### Archivos (`uploads.ts`, `documentos.ts`)
- `[U/I] POST /uploads` (multipart) · `GET /uploads/:tenant/:name?token=` (ver §9).
- `[U] GET/POST /contratos/:contratoId/documentos`, `DELETE …/:docId`.

### Sistema
- `[P] GET /health` → `{ok, db, ts}`.

---

## 6. Multi-tenant + Auth

### Regla de oro multi-tenant
Toda fila lleva `inmobiliariaId`. **Nunca** `findUnique/update/delete` por un id que
viene del request sin filtrar también por `inmobiliariaId`. Usar `findFirst` +
`inmobiliariaId`, y `updateMany/deleteMany` con `inmobiliariaId` en el WHERE.

### Los 3 tipos de JWT (todos llevan `inmobiliariaId`)
- **Usuario panel**: `{ kind:'usuario', userId, inmobiliariaId, rol }`. JWT 15 días.
- **Inquilino titular**: `{ kind:'inquilino', inquilinoId, inmobiliariaId, contratoId }`.
- **Co-inquilino**: `{ kind:'co-inquilino', coInquilinoId, inmobiliariaId, contratoId, permiso }`.

### Guards (`apps/api/src/auth/guards.ts`)
- `requireAuth` → cualquier autenticado (los 3 kinds).
- `requireUsuario(req, reply, capacidad?)` → JWT del panel + (opcional) que el rol
  tenga la capacidad. **No** valida el userId contra DB (solo el rol del token).
- `requireInquilino` → solo inquilino titular.
- `requireContratoAcceso(req, reply, minPermiso='VER')` → titular o co-inquilino.
  **Revalida el permiso contra la DB en cada request** (no confía en el JWT, que vive
  15 días → si baja el permiso surte efecto al instante). Jerarquía VER(1) < PAGAR(2) < COMPLETO(3).

### Roles y capacidades (`packages/shared/src/permisos.ts`)
Roles: `ADMIN | OPERADOR | CARGA | LECTURA`. Las capacidades por rol están en el
catálogo `CAPACIDADES`. Ojo:
- `contratos.crear`, `propiedades.crear`, `propietarios.crear` **incluyen CARGA** con
  `rolesAprobacion:['CARGA']` → lo que CARGA carga **requiere aprobación** de un ADMIN.
- Las acciones destructivas (DELETE propietario/propiedad, finalizar contrato) llevan
  un **guard de rol explícito** (`if (u.rol === 'CARGA') return 403`), porque la
  capacidad `*.crear` sola dejaría pasar a CARGA.

### Mecánica auth por actor
- **Panel**: `POST /auth/login` (email+password bcrypt). El email se busca **GLOBAL**
  a propósito (dos tenants no comparten email; el alta de usuario chequea unicidad global).
- **Inquilino**: OTP por email (request + verify). Identidad cross-tenant desde el hash del OTP.
- **Co-inquilino**: invitación por link (JWT `kind:'co-invitacion'`) → acepta y recibe
  su propia sesión (`kind:'co-inquilino'`) sin OTP. El link de aceptación es de **un solo uso**.
- **PIN de seguridad** (4 dígitos, acciones de plata): `verificarPinUsuario` con
  **lockout anti-fuerza-bruta** (5 intentos → 15 min).

---

## 7. Modelo de plata (CLAVE — no des-arreglar)

```
Liquidaciones      →   Pagos                     →   Rendiciones
(devengadas al         (el inquilino informa,         (al propietario:
 activar contrato +     la inmo concilia/rechaza)      bruto − comisión − gastos)
 cron de top-up)                                  →   Caja (cierre diario)
```

- **Liquidacion**: `montoAlquiler` + `montoExpensas` + `montoPunitorio` = `montoTotal`.
  Estado PENDIENTE/PARCIAL/PAGADO/VENCIDO. Se devengan al activar el contrato y se
  hacen top-up por el cron (§10). Lógica en `apps/api/src/lib/liquidaciones.ts`.
- **Pago**: el inquilino lo informa (`POST /pagos/informar`); la inmo lo concilia o
  rechaza (`/pagos/:id/validar | /rechazar`, con PIN). Una liquidación queda PAGADO
  **solo si** la suma de pagos CONCILIADOS ≥ total; si no, **PARCIAL** (nunca PAGADO).
- **Rendición** (`POST /rendiciones`): lo que se le rinde al propietario.
  `montoNeto = montoBruto − comisión − gastos`, persistido en Decimal(14,2).
- **Caja** (`GET /caja/cierre`): lo cobrado (pagos CONCILIADOS) del día + comisión.

### Reglas LOCKED del dueño (ver §14 / `work-agent/05-DECISIONES.md`)
1. **Comisión y rendición SOLO sobre el alquiler** (`montoAlquiler`), no sobre el
   total (las expensas pasan al consorcio, no al propietario).
2. **PARCIAL nunca marca PAGADO** · ningún monto negativo · participaciones suman 100.
3. **PROPIETARIO_DIRECTO no es ingreso de la inmobiliaria**: tanto `/rendiciones`
   como `/caja/cierre` filtran `modoCobranza='INMOBILIARIA'`.
4. Gastos de rendición: solo del período y solo de propiedades con ingreso. En
   propiedades multi-dueño, **el gasto se rinde por partes** (cada dueño su
   participación) y se marca descontado-total recién al 100% (conservación).
5. **Cualquier co-inquilino puede informar el pago** (`requireContratoAcceso 'VER'`).

### Patrones canónicos
- **Lock atómico** (anti-carrera/doble-submit): `updateMany({ where:{ id, estado:'X' }, … })`
  → si `count===0` otra request ya cambió el estado → **409**. Usado en validar/rechazar
  pago, finalizar contrato, claim de propiedad, resolver/asignar reclamo, aprobar carga,
  anular rendición.
- **Error handler global** (`app.ts`): `ZodError→400`, `P2002/P2003→409`, `P2025→404`,
  `P2034→409` (serialization). No hace falta try/catch para esos casos.
- **Toda mutación que el cliente vaya a mapear devuelve el objeto COMPLETO** (con
  relaciones) para no crashear el front con `undefined.map`.
- **Idempotencia** donde corre un cron/retry: `createMany({ …, skipDuplicates:true })`.

---

## 8. `apiEnabled` — real vs demo (CLAVE para el front)

Cada pantalla del front ramifica por **`apiEnabled`** (= `NEXT_PUBLIC_API_URL` seteado):

- `apiEnabled = true` → **API real** (producción).
- `apiEnabled = false` → **mock / localStorage** (build demo, GitHub Pages).

Patrón típico de un hook: `if (!apiEnabled) { …localStorage/mock… } else { …apiFetch… }`.

**Ambos modos deben andar.** Las dos clases de bug que reaparecen:
1. **Mock en prod**: una pantalla que con `apiEnabled` sigue leyendo/escribiendo
   localStorage o datos mock → no persiste, no es multi-dispositivo (= "desconexión").
2. **Éxito falso**: un toast "guardado/enviado" cuando la API falló o nunca se llamó.

> La auditoría de 27/06 cazó y conectó varias desconexiones (co-inquilinos del panel,
> servicios públicos, edición de propiedad, feed de notificaciones). Ver §13.

---

## 9. File storage (Railway Volume + `/uploads`)

Antes los archivos se elegían en el browser y **nunca** llegaban al backend (solo
viajaban los metadatos). Hoy hay storage real, **sin migración** (los modelos ya
tenían el campo URL):

- **Infra**: Railway Volume `myalquiler-back-volume` montado en `/data`;
  `@fastify/multipart`. `UPLOADS_DIR = /data/uploads` en prod (tmp en dev/test).
- **`POST /uploads`** (`uploads.ts`): multipart, allowlist (jpeg/png/webp/gif/heic/pdf),
  10 MB, guarda en `/data/uploads/<inmobiliariaId>/<uuid><ext>`, devuelve
  `{url, nombreArchivo, tipoMime, tamanioBytes}`.
- **`GET /uploads/:tenant/:name`**: sirve el archivo; acepta `?token=` en query (un
  `<img>/<a>` no manda header Authorization) y lo copia al header; valida
  `tenant === payload.inmobiliariaId` (403 cross-tenant) + anti path-traversal.
- Helpers: `urlEsDelTenant(url, tenant)` (valida prefijo al persistir) y
  `borrarArchivoSubido(url, tenant)` (borra del Volume, tenant-scopeado).

**Los 4 flujos cableados** (cada uno guarda la `url` que devuelve `/uploads`):
1. Comprobante de pago → `Pago.comprobanteUrl` (el panel lo abre desde "Por validar").
2. Foto de reclamo → `Reclamo.fotoUrl` (complementaria: si falla la subida, el reclamo se crea igual).
3. Boleta de servicio → `BoletaServicio.archivoUrl`.
4. Documentos del contrato → `DocumentoContrato.archivoUrl` (CRUD `/contratos/:id/documentos`).

---

## 10. Cron de devengo (`cron.ts`)

`computarLiquidacionesContrato` genera hasta "el mes que viene inclusive"; sin un
disparo periódico, cada contrato se queda sin liquidaciones a partir del 2º mes.

- **Scheduler in-process** (`iniciarCronDevengo`, arrancado en `index.ts` tras `listen`):
  corre `devengarTodosLosTenants(prisma)` ~30 s después de levantar y **cada 6 h**.
  Idempotente (`createMany skipDuplicates`) → seguro de repetir y aunque corran 2
  réplicas. Apagable con `CRON_DEVENGO=off`. Cero infra de cron aparte.
- **`POST /internal/cron/devengar`** (`plata.ts`): mismo devengo global, disparable
  por un cron externo / manual con header `x-cron-secret == CRON_SECRET` (cerrado si
  la var no está). Para test y redundancia.

---

## 11. Deploy y operación (Railway)

> Detalle completo en [`work-agent/02-DEPLOY.md`](./work-agent/02-DEPLOY.md).

Proyecto **MYALQ** (`b01a1ecb-…`), env **production**, workspace Deenex. Servicios:

| Servicio | Build | Dominio |
|---|---|---|
| `myalquiler-back` | Dockerfile `apps/api/Dockerfile` (+ Volume `/data` + `migrate deploy` al arrancar) | api-production-262e.up.railway.app |
| `myalquiler-front` | Dockerfile `apps/inmobiliaria/Dockerfile` | **admin.myalquiler.com** |
| `myalquiler-inquilino` | Dockerfile `apps/inquilino/Dockerfile` | **app.myalquiler.com** |
| `Postgres-_cRj` | — | DB PROD (host interno `postgres-crj.railway.internal`) |

**Deploy** (los servicios **NO** están conectados a GitHub → push a `main` no
auto-deploya):
```bash
railway up --service <svc> --detach        # back / front / inquilino — solo lo que tocaste
```

**Env del back (prod):** `DATABASE_URL`, `JWT_SECRET` (64 chars), `DEMO_MODE=false`,
`PORT`, SMTP Hostinger (`myalquiler@xnod.tech`), `CRON_SECRET`, `CORS_ORIGINS`
(debe incluir los dominios de los fronts), `UPLOADS_DIR` (opcional).

**Consultar la DB de prod desde local** (el host interno no resuelve desde tu Mac):
```bash
railway ssh --service myalquiler-back "node --input-type=module -e '…PrismaClient…'"
```

**Smoke test** (sin ensuciar el tenant real): `GET /health` → `{db:"up"}`;
`GET /liquidaciones` sin token → 401; `POST /auth/login {}` → 400; los dominios → 200.

---

## 12. Testing

- **Suites**: `apps/api/test/*.test.ts` (vitest) — `auth, core, plata, operacion,
  liquidaciones, anuncios, inquilino-mundo, health, rendicion-multiowner`. Usan
  `app.inject` (sin red) + `seedBase(prisma)` en `beforeAll`.
- **DB de test**: una Postgres **distinta de prod**, host **público**
  `thomas.proxy.rlwy.net` (en `apps/api/.env`). Se re-seedea/resetea en cada corrida.
  ⚠️ **Nunca correr los tests contra una DB incierta** (regla dura).
- **Gotcha**: si el schema cambió, el test DB puede quedar desactualizado → `npx
  prisma db push --accept-data-loss` lo sincroniza (es el DB de test). La suite plata
  tiene 2-3 fallas **preexistentes** de drift de seed (no son regresiones).
- **E2E contra prod**: para validar endpoints en vivo sin tocar datos reales, mintear
  un JWT con `JWT_SECRET` (usuario o inquilino) y probar con `curl` con cleanup/restore.
  `requireUsuario`/`requireContratoAcceso` no validan el id contra DB para el titular.

**Verificación antes de deployar** (siempre):
```bash
pnpm --filter api exec tsc --noEmit && pnpm --filter api build
pnpm --filter @llave/inmobiliaria exec tsc --noEmit && pnpm --filter @llave/inmobiliaria build
pnpm --filter @llave/inquilino exec tsc --noEmit && pnpm --filter @llave/inquilino build
```

---

## 13. Historia de auditorías + hardening

El proyecto se endureció con **campañas de auditoría multi-agente** (workflows de
finders → verificación adversarial → síntesis). Detalle en
[`work-agent/03-AUDITORIAS.md`](./work-agent/03-AUDITORIAS.md).

- **Pre-lanzamiento + v2–v5 (junio 2026):** ~50 bugs reales arreglados (money model,
  máquinas de estado, locks atómicos, constraints, multi-tenant, a11y). El loop
  **converge** (cada re-corrida encuentra menos).
- **Ola 0 (23/06):** P1–P13 aplicados (regresiones de v5 + integridad backend).
- **Keystones (26/06):** file storage real (§9) + cron de devengo (§10).
- **Auditoría 27/06 (8 hallazgos, todos fixeados/deployados/testeados):**
  | # | Sev | Qué |
  |---|---|---|
  | D1 | ALTO | Co-inquilino desde el panel ahora es real (CRUD `/contratos/:id/co-inquilinos`) — antes solo localStorage |
  | D2 | ALTO | `GET /contratos/:id` incluye `cuentaCobranza` del propietario (PROPIETARIO_DIRECTO) |
  | D3 | ALTO | El rating del inquilino llega al panel + recalcula `profesional.rating` |
  | D4 | MEDIO | Feed real `GET /mis-notificaciones` (la campana dejó de ser no-op en prod) |
  | B1 | ALTO | `/caja/cierre` ya no cuenta pagos PROPIETARIO_DIRECTO como ingreso de la inmo |
  | B2 | ALTO | Gasto multi-propietario se rinde por partes y se conserva (+ test de regresión) |
  | B3 | BAJO | Cierre de caja con comisión a centavos, consistente con la rendición |
  | B4 | BAJO | `comprobanteUrl`/`archivoUrl` validan prefijo de tenant al persistir |

  Validación: cada uno con `tsc` + `build` 0, deploy a Railway y **E2E contra
  producción** (con cleanup/restore). B2 lleva test de integración (`rendicion-multiowner.test.ts`).

**Prompt reutilizable de auditoría:** `work-agent/PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md`
(+ el histórico `AUDITORIA-PROFUNDA-PROMPT.md` en la raíz).

---

## 14. Decisiones de negocio (del dueño — no des-arreglar)

> Detalle en [`work-agent/05-DECISIONES.md`](./work-agent/05-DECISIONES.md).

1. **Comisión/rendición sobre el alquiler** (no el total).
2. **Cualquier co-inquilino puede pagar** el alquiler (`requireContratoAcceso 'VER'`).
3. **Gastos de rendición solo de propiedades con ingreso**; multi-dueño = por partes.
4. **PROPIETARIO_DIRECTO no es ingreso** de la inmo (rendición + caja lo excluyen).
5. **Email de usuario panel es GLOBAL** (no por tenant) a propósito — no scopear.
6. **Backdoor demo (OTP `000000`)** excluido de producción.

### Reglas duras (innegociables)
1. **NUNCA `prisma migrate reset` contra prod.**
2. No correr acciones irreversibles (deploy, migración de schema, borrado) sin confirmar en el chat.
3. **No crear cuentas ni data de prueba en el tenant real** (Tapia Propiedades).
4. No correr los tests de `apps/api` contra una DB incierta.
5. gh token **sin** workflow scope → no tocar `.github/workflows/`. Pushear a `main` está OK.

---

## 15. Pendientes / roadmap

**Listo para conectar cuando haya decisión/insumo del owner** (no son bugs):
- **Forma de pago del plan SaaS** (billing): cómo cobra el SaaS a la inmobiliaria.
  Modelos `Suscripcion`/`Factura`/`Cupon`/`TramoPlan` existen, sin definir el flujo.
- **Programa de referidos**: modelo `Referido` existe, faltan las reglas comerciales.
- **Screening real**: integración con **NOSIS** (vars `NOSIS_*` en `.env.example`).
- **Broker IA / OCR** de comprobantes: lectura por IA (vars `ANTHROPIC_*`), presupuesto.
- **Conciliación bancaria** (`DatosBancarios`/`ResumenBancario`/`CreditoDetectado`).
- **WhatsApp real** (recordatorio a morosos, invitaciones): vars `WHATSAPP_*`.

**Long-tail demo-gated** (features secundarias que muestran "Próximamente"/mock en
prod, no rompen el core): negociación iterativa de renovación, migración masiva,
reset de PIN olvidado, objetivos/métricas internas, partes de consorcios.

---

## 16. Integraciones futuras (mapa de `.env.example`)

El `.env.example` declara las integraciones planeadas (la mayoría aún no cableadas):

| Var | Para |
|---|---|
| `DATABASE_URL`, `JWT_SECRET` | núcleo (requeridas) |
| `REDIS_URL` | caché / colas (futuro) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | broker IA / OCR de comprobantes |
| `MP_*` (MercadoPago) | cobro de alquiler / suscripción del plan |
| `NOSIS_*` | screening crediticio real |
| `WHATSAPP_*` | mensajería (recordatorios, invitaciones) |
| `R2_*` (Cloudflare R2) | storage S3-compatible (alternativa al Volume) |
| `RESEND_API_KEY` | email transaccional (alternativa al SMTP) |

> El email transaccional hoy va por **SMTP Hostinger** (`myalquiler@xnod.tech`); el
> storage por **Railway Volume** (`/data`). R2/Resend están declarados para escalar.

---

## 17. Dónde está cada cosa (índice rápido)

| Necesito… | Mirar |
|---|---|
| Entender el proyecto entero | **este archivo** |
| Onboarding rápido + tooling | [`README.md`](./README.md) |
| Estado ejecutivo de hoy | [`work-agent/00-ESTADO.md`](./work-agent/00-ESTADO.md) |
| Arquitectura/convenciones | [`work-agent/01-ARQUITECTURA.md`](./work-agent/01-ARQUITECTURA.md) |
| Deployar / consultar prod | [`work-agent/02-DEPLOY.md`](./work-agent/02-DEPLOY.md) |
| Historia de auditorías + prompt | [`work-agent/03-AUDITORIAS.md`](./work-agent/03-AUDITORIAS.md) |
| Qué falta / roadmap | [`work-agent/04-PENDIENTES.md`](./work-agent/04-PENDIENTES.md) |
| Decisiones de negocio | [`work-agent/05-DECISIONES.md`](./work-agent/05-DECISIONES.md) |
| Análisis senior / olas | [`work-agent/06-ANALISIS-SENIOR.md`](./work-agent/06-ANALISIS-SENIOR.md) |
| El schema de datos | `apps/api/prisma/schema.prisma` |
| Los guards de auth | `apps/api/src/auth/guards.ts` |
| El catálogo de permisos | `packages/shared/src/permisos.ts` |
| La lógica de plata | `apps/api/src/routes/plata.ts` + `lib/liquidaciones.ts` |

---

_Documento mantenido a mano. Si tocás algo estructural (un endpoint nuevo, una regla
de plata, un modelo), actualizá la sección que corresponda acá y el archivo de
`work-agent/` afín, para que el próximo que entre tenga el contexto al día._
