# PROJECT.MD — My Alquiler

> **Documento maestro del proyecto.** Contexto absoluto para que cualquier persona
> (o agente) pueda entrar a trabajar sin contexto previo. Si solo vas a leer un
> archivo, leé éste.
>
> Última actualización: **2026-07-04**. Estado: **en producción, endurecido**.
> Para el handoff operativo día-a-día, ver [`work-agent/`](./work-agent/) y el
> [`README.md`](./README.md).
>
> HEAD == `origin/main` == **535d15d** · árbol limpio · demo intacta (ambos modos andan).

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

Tenant real: **Tapia Propiedades**. Admin: `alannaimtapia@gmail.com` / `Tapia.2026!` (el **PIN de seguridad se eliminó** el 05/07 — ninguna acción lo pide; ver `CHANGELOG.md` y `work-agent/05-DECISIONES.md` §7).

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
- ✅ **Backlog de archivos/adjuntos cerrado 100% (03–04/07, HEAD `535d15d`).** La
  auditoría de archivos (02–03/07) había dejado un backlog de "campos que existían en
  el schema pero ningún endpoint los usaba". Esta tanda los construyó **todos, de
  verdad, E2E** (6 commits, los 3 servicios deployados con `railway up`, migración
  aplicada en prod, demo intacta). Las 8 features (en 6 commits):
  1. **Hardening de uploads** (`f715055`): validar tenant en `Reclamo.fotoUrl` /
     `ReclamoEvento.adjuntoUrl` / `BoletaServicio.archivoUrl` (antes se guardaban sin
     `urlEsDelTenant` → un inquilino podía inyectar una imagen externa `https://`).
  2. **Avatar del inquilino + documentos** (DNI/recibos/garante) reales (`8940981`).
  3. **Flujo real del profesional por link mágico** (fotos antes/después) (`f05b24d`).
  4. **Validador de resumen bancario** real (CSV/Excel, **sin IA**) (`1404004`).
  5. **Migración de cartera** real (Excel/CSV, mapeo flexible) (`b153ebe`).
  6. **Avatar del usuario del panel** (`PUT /me/avatar`) + **comprobante en gastos de
     caja** (`535d15d`) — **backend-ready, el front del panel aún no las consume**.
  Ver §9 (storage), §5 (endpoints), §4 (modelo de datos).

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
├── prisma (en apps/api/prisma/)  # schema.prisma (~2330 líneas) + migraciones
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
| **Panel** (`inmobiliaria`) | Next.js (App Router) | `^14.2` (resuelto **14.2.35**) |
| | React | `^18.3` (resuelto **18.3.1**) |
| | @tanstack/react-query | `^5.101` |
| | Tailwind + shadcn/Radix (`@llave/ui`) | — |
| **PWA** (`inquilino`) | Next.js (App Router) | `^14.2` (resuelto **14.2.35**), PWA |
| | React, react-query, Tailwind | igual que el panel |
| **Parseo de planillas** | **xlsx** (SheetJS) | validador bancario + migración de cartera |

> El rango declarado en los `package.json` es `next@^14.2.15` / `react@^18.3.1`, pero
> el `pnpm-lock.yaml` resuelve una sola versión: **Next 14.2.35 / React 18.3.1**
> (idéntico en ambas apps).

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
│   │                   #   + requireProfesionalVisita / requireAuthOProfesional
│   └── pin.ts          # verificarPinUsuario (lockout anti-fuerza-bruta)
├── lib/
│   └── liquidaciones.ts  # computar/generar liquidaciones + devengarTodosLosTenants
└── routes/
    ├── auth.ts             # login panel, OTP inquilino, PIN, co-invitación, registro
    ├── core.ts             # contratos, propiedades, propietarios, sociedades, usuarios,
    │                       #   empresa, cobranza, mercado, co-inquilinos (panel)  [39 endpoints]
    ├── plata.ts            # liquidaciones, pagos, rendiciones, caja, cron global  [18 endpoints]
    ├── operacion.ts        # reclamos (SLA), profesionales, renovaciones, screening,
    │                       #   consorcios, visita del profesional  [32 endpoints]
    ├── inquilino-mundo.ts  # API de la PWA (el más grande): contrato, pagos, boletas,
    │                       #   reclamos, co-inquilinos, servicios, mis-notificaciones [16 endpoints]
    ├── anuncios.ts         # comunicaciones a inquilinos  [5 endpoints]
    ├── uploads.ts          # file storage (multipart) sobre Railway Volume  [2 endpoints]
    │                       #   (guard ahora acepta también JWT de profesional)
    ├── documentos.ts       # documentos del contrato (CRUD) + docs del inquilino
    ├── mi-perfil.ts        # avatar + documentos del inquilino (mis-datos, mis-documentos)
    ├── visitas-publicas.ts # flujo del profesional por link mágico (sin cuenta)
    ├── resumenes-bancarios.ts # validador de resumen bancario (CSV/Excel, sin IA)
    ├── importaciones-cartera.ts # migración de cartera (Excel/CSV, mapeo flexible)
    ├── servicios-publicos.ts # servicios públicos por propiedad (CRUD)  [3 endpoints]
    └── health.ts           # GET /health  [1 endpoint]
```

**Total: 153 endpoints, 75 modelos Prisma, 74 enums** (schema ~2330 líneas). El registro
de rutas vive en `app.ts` (líneas 79-92); **no hay prefijo global** — cada ruta usa su
path literal.

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
`Inquilino` (titular; `imageUrl` = avatar, agregado en la migración
`20260703110000`), `CoInquilino` (permiso VER/PAGAR/COMPLETO, estado
PENDIENTE/ACEPTADO, `@@unique(contratoId,email)`), `Garante`, `Screening`,
`DocumentoContrato` (expediente que carga la inmo: DNI, recibos, contrato firmado…),
`InquilinoInvitado`/`CoInquilinoInvitado` (invitaciones), `EventoContrato`,
`IntencionRenovacion`.

**Migración masiva / migración de cartera**
`ImportacionCartera` (importación de la planilla propia del dueño con **mapeo
flexible** de columnas: `columnas`/`filas`/`mapeoColumnas`/`resultado` en `Json`,
`estado` = `EstadoImportacion` SUBIDO/MAPEADO/CONFIRMADO). FK a `Inmobiliaria` con
`ON DELETE RESTRICT`. Agregada en la migración `20260703110000`.

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
ponderado), `VisitaProfesional` (ASIGNADO/CONFIRMADA/EN_CAMINO/LISTO; `token` opaco
= link mágico para el profesional + `fotoAntes`/`fotoDespues`/`notaFinal`/`montoCobrado`),
`ConfirmacionReclamo`, `RatingReclamo` (calificación del inquilino).

**Consorcios** (administración de edificios)
`Consorcio`, `UnidadFuncional`, `MovimientoConsorcio`, `AsambleaConsorcio`,
`ItemInventario` + `MovimientoInventario`, `ServicioComunConsorcio`.

**Comunicaciones / banca / misc**
`Anuncio` + `AnuncioAcuse`, `CodigoOtp`, `Documento`/`SlotDocumento`/`CertificadoInquilino`
(los `Documento` que sube el **inquilino** por slot: DNI/recibos/garante),
`ChatMensaje` (asistente IA del contrato), `DatosBancarios`/`ResumenBancario`/
`CreditoDetectado` (conciliación bancaria — **ya en producción**, ver §9; el crédito
lleva `conciliado` + `pagoId` @unique, relación 1:1 opcional al `Pago` con
`ON DELETE SET NULL`), métricas internas
(`MetaSemestre`, `CohortMes`, `FunnelStep`, `FuenteAdquisicion`, `BloqueadorObjetivo`).

> `Usuario.imageUrl`, `MovimientoCaja.comprobanteUrl` y `Pago.comprobanteUrl` ya
> existían (migración base `20260612042420_nucleo_completo`), **no** son de esta tanda.
> La migración `20260703110000_avatar_credito_importacion` agrega solo:
> `inquilinos.imageUrl`, `creditos_detectados.conciliado`/`pagoId` y la tabla
> `importaciones_cartera` (+ enum `EstadoImportacion`).

---

## 5. Superficie de API (153 endpoints)

Agrupados por área. Auth: `[U]` usuario panel · `[I]` inquilino/co-inquilino · `[P]` público · `[S]` secreto de servicio · `[Pf]` profesional (JWT `kind:'profesional'` del link mágico).

### Auth (`auth.ts`)
- `[P] POST /auth/login` — panel (email+password bcrypt, email **global** no por tenant). JWT 15 días.
- `[P] POST /auth/registro` — alta de inmobiliaria nueva (onboarding).
- `[P] POST /auth/otp/request` · `POST /auth/otp/verify` — login inquilino por OTP email.
- `[P] POST /auth/demo` — sesión demo (solo `NODE_ENV !== production`).
- `[U] GET /auth/me` — sesión. ⚠️ `POST /auth/pin` · `POST /auth/pin/verify` siguen existiendo pero **el PIN se eliminó (05/07)** → están muertos, ninguna UI los llama, `me.tienePin=false`.
- `[P] GET /co-invitacion/:token` · `POST /co-invitacion/:token/aceptar` — co-inquilino acepta su link.

### Core panel (`core.ts`)
- Contratos: `[U] GET /contratos`, `GET /contratos/:id`, `POST /contratos`, `POST /contratos/:id/finalizar` (+ rescisión: penalidad/neteo/decisión de depósito).
- **Ciclo de vida (05/07):** `[U] GET /contratos/:id/finalizar-preview`, `POST /contratos/:id/ajustar` + `GET …/ajustes` (ajuste del canon), `POST /contratos/:id/saldar-deuda` (ex-inquilinos), `POST /contratos/:id/renovar` + `GET …/renovaciones`, **`GET /depositos/en-custodia`** (retenido/deducido/disponible por moneda).
- Co-inquilinos (panel): `[U] GET/POST /contratos/:contratoId/co-inquilinos`, `DELETE …/:id`.
- Propiedades: `[U] GET /propiedades`, `GET /propiedades/:id`, `POST /propiedades`, **`PUT /propiedades/:id`**, `DELETE /propiedades/:id`.
- Servicios públicos: `[U] GET /propiedades/:propiedadId/servicios`, `PUT/DELETE …/:tipo`.
- Propietarios: `[U] GET /propietarios`, `GET /propietarios/:id`, `POST /propietarios`, `PUT /propietarios/:id/cuenta-cobranza-directa`, `DELETE …`.
- Sociedades: `[U] GET/POST /sociedades`, `PATCH /sociedades/:id`, `PUT /sociedades/:id` + `…/principal`.
- Empresa/cobranza/mercado: `[U] GET/PUT /empresa`, `GET/PUT /cobranza`, `GET/PUT /mercado`.
- Equipo: `[U] GET/POST /usuarios`, `PUT/DELETE /usuarios/:id`. Inquilinos: `[U] GET /inquilinos`.
- **`[U] PUT /me/avatar`** — avatar del usuario del panel logueado (cualquier rol; `urlEsDelTenant`). **Backend-ready: el front del panel aún NO lo consume.**

### Plata (`plata.ts`)
- Liquidaciones: `[U] GET /liquidaciones`, `POST /liquidaciones/devengar` (tenant), **`[S] POST /internal/cron/devengar`** (global, header `x-cron-secret`).
- Pagos: `[U] GET /pagos`, `POST /pagos/:id/validar`, `POST /pagos/:id/rechazar`, **`POST /pagos/manual`** (cobro en efectivo/cheque que registra la inmo → `Pago` CONCILIADO). _(El PIN se eliminó; protege la capacidad `pago.conciliar`.)_
- Rendiciones: `[U] GET /rendiciones`, `POST /rendiciones`, `POST /rendiciones/:id/anular`. La rendición ahora incluye los reclamos resueltos con pagador PROPIETARIO como `GastoRendido` tipo TRABAJO.
- Caja: `[U] GET /caja/cierre`, `GET/POST /caja/movimientos`, `DELETE /caja/movimientos/:id`. `POST` acepta y persiste `comprobanteUrl` (validado por tenant; el DELETE lo lee para limpiar el Volume). Se arregló (04/07) que el `create` antes lo validaba pero no lo escribía. Falta la UI del panel para adjuntarlo.
- Aprobaciones: `[U] GET /aprobaciones`, `POST /aprobaciones/:id/aprobar|rechazar` (cap `contrato.aprobar`; el `pin` del body se ignora — PIN eliminado).
- **Resúmenes bancarios (conciliación, sin IA)** — todo con cap `pago.conciliar`:
  `[U] POST /resumenes-bancarios` (multipart `.xlsx/.xls/.csv`, ≤10 MB → parsea y persiste créditos),
  `GET /resumenes-bancarios` (lista con total/conciliados),
  `GET /resumenes-bancarios/:id` (matching **LIVE** contra el estado actual: pagos INFORMADO + liquidaciones con saldo, FIFO por vencimiento; cada crédito con `sugerido`),
  `POST /resumenes-bancarios/:id/creditos/:creditoId/conciliar` (`{liquidacionId}` → crea un `Pago` **directo CONCILIADO**, lock atómico anti doble-conciliación).

### Operación (`operacion.ts`)
- Reclamos: `[U] GET /reclamos`, `GET /reclamos/:id`, `POST …/asignar|clasificar|resolver|rechazar|responder`.
  `POST /reclamos/:id/asignar` **devuelve `visitaToken`** (upsert de `VisitaProfesional`: al reasignar resetea el ciclo y genera token nuevo).
  **`POST /reclamos/:id/clasificar`** (05/07) fija quién paga (`PagadorReclamo` propietario/inquilino/depósito); **`POST …/resolver`** persiste costo+pagador, suma el trabajo al profesional e **impacta la plata** (rendición / cargo / depósito). Ver `CHANGELOG.md`.
- **`[U] POST /reclamos/:id/visita/regenerar-link`** — regenera el token sin reasignar (mismo profesional); invalida el token anterior (una sesión JWT ya emitida sigue válida hasta expirar).
- Profesionales: `[U] GET /profesionales`. Renovaciones: `[U] GET /renovaciones`, `POST /renovaciones/:contratoId/decision`.
- Screening: `[U] GET /screenings`, `POST /screening`.

### Visitas públicas — profesional por link mágico (`visitas-publicas.ts`)
El profesional **no tiene cuenta ni password**: la inmo le manda un link (`/p/:token`) por WhatsApp/SMS. El token opaco (`randomBytes(24)`) se canjea por un JWT `kind:'profesional'` (14 días) que autentica el resto vía `requireProfesionalVisita` (re-valida contra DB → revocación real si se reasignó).
- `[P] GET /visitas-publicas/:token` — canjea token → `{sesion(JWT), visita, reclamo}`.
- `[Pf] POST /visitas-publicas/confirmar` — ASIGNADO→CONFIRMADA (idempotente).
- `[Pf] POST /visitas-publicas/en-camino` — CONFIRMADA→EN_CAMINO.
- `[Pf] PUT /visitas-publicas/fotos` — sube `fotoAntes`/`fotoDespues` (no cambia estado).
- `[Pf] POST /visitas-publicas/listo` — EN_CAMINO→LISTO (`{notaFinal, montoCobrado?}`).
  Cada transición setea su timestamp + crea un `ReclamoEvento` para la timeline.

### Mundo inquilino (`inquilino-mundo.ts`)
- `[I] GET /mi-contrato`, `GET /mis-liquidaciones`, `GET /certificado`, `GET /servicios`.
- Pagos: `[I] POST /pagos/informar` (cualquier co-inquilino, ver §13/decisiones).
- Boletas: `[I] GET/POST /boletas`. Reclamos: `[I] GET/POST /mis-reclamos`, `POST …/:id/confirmar-resolucion`, `POST …/:id/rating`.
- Co-inquilinos (inquilino): `[I] GET/POST /co-inquilinos`, `POST …/:id/aceptar|link`, `PATCH …/:id/permiso`, `DELETE …/:id`.
- Anuncios: `[I] GET /mis-anuncios`. **`[I] GET /mis-notificaciones`** (feed real, ver §13/D4). Reportes piloto: `[U/I] POST /reportes`, `GET /reportes`.
- **Perfil del inquilino** (`mi-perfil.ts`): `[I] GET /mis-datos` · `PUT /mis-datos/avatar` (avatar, `urlEsDelTenant`). Documentos por slot: `[I] GET /mis-documentos` (auto-provisiona 7 slots por tenant: dni-frente/dni-dorso/recibo-1/recibo-2/cert-laboral/garante-escritura/garante-recibo), `POST /mis-documentos`, `DELETE /mis-documentos/:id`.

### Anuncios (`anuncios.ts`)
- `[U] GET/POST /anuncios`, `POST /anuncios/:id/<accion>`, `DELETE /anuncios/:id`.

### Archivos (`uploads.ts`, `documentos.ts`)
- `[U/I/Pf] POST /uploads` (multipart) · `GET /uploads/:tenant/:name?token=` (ver §9). El guard ahora acepta también JWT `kind:'profesional'` (para que suba `fotoAntes`/`fotoDespues`).
- `[U] GET/POST /contratos/:contratoId/documentos`, `DELETE …/:docId` (expediente que carga la inmo).
- **`[U] GET /contratos/:contratoId/documentos-inquilino`** (`documentos.ts`, cap `contratos.ver`) — read-only de los `Documento` que subió el **inquilino** (distinto de `DocumentoContrato`).

### Migración de cartera (`importaciones-cartera.ts`)
Flujo de 3 pasos para que el dueño suba **su propia planilla** (Excel/CSV) con **mapeo flexible** de columnas — todo con cap `contratos.crear`:
- `[U] GET /importaciones-cartera/campos` — campos destino disponibles para armar el UI de mapeo.
- `[U] GET /importaciones-cartera` — lista.
- `[U] POST /importaciones-cartera` — sube+parsea (≤15 MB, máx 2000 filas), sugiere mapeo, estado `SUBIDO`.
- `[U] PUT /importaciones-cartera/:id/mapeo` — mapea+valida fila-por-fila (OK/ADVERTENCIA/ERROR/DUPLICADO), estado `MAPEADO`.
- `[U] POST /importaciones-cartera/:id/confirmar` — crea propiedad+propietario(find-or-create)+inquilino+contrato ACTIVO por fila. **403 si el rol es CARGA o LECTURA** (solo Admin/Operador). Estado `CONFIRMADO`.

### Sistema
- `[P] GET /health` → `{ok, db, ts}`.

---

## 6. Multi-tenant + Auth

### Regla de oro multi-tenant
Toda fila lleva `inmobiliariaId`. **Nunca** `findUnique/update/delete` por un id que
viene del request sin filtrar también por `inmobiliariaId`. Usar `findFirst` +
`inmobiliariaId`, y `updateMany/deleteMany` con `inmobiliariaId` en el WHERE.

### Los tipos de JWT (todos llevan `inmobiliariaId`)
- **Usuario panel**: `{ kind:'usuario', userId, inmobiliariaId, rol }`. JWT 15 días.
- **Inquilino titular**: `{ kind:'inquilino', inquilinoId, inmobiliariaId, contratoId }`.
- **Co-inquilino**: `{ kind:'co-inquilino', coInquilinoId, inmobiliariaId, contratoId, permiso }`.
- **Profesional** (link mágico): `{ kind:'profesional', visitaId, inmobiliariaId, profesionalId }`, 14 días.
  Su schema (`JwtProfesionalSchema`) queda **FUERA** de la unión discriminada `JwtPayloadSchema`
  a propósito (como `JwtPersonaSchema`), para no romper la exhaustividad del resto del código.
  Solo lo aceptan `requireProfesionalVisita` y los endpoints de `/uploads`.

### Guards (`apps/api/src/auth/guards.ts`)
- `requireAuth` → cualquier autenticado (los 3 kinds).
- `requireUsuario(req, reply, capacidad?)` → JWT del panel + (opcional) que el rol
  tenga la capacidad. **No** valida el userId contra DB (solo el rol del token).
- `requireInquilino` → solo inquilino titular.
- `requireContratoAcceso(req, reply, minPermiso='VER')` → titular o co-inquilino.
  **Revalida el permiso contra la DB en cada request** (no confía en el JWT, que vive
  15 días → si baja el permiso surte efecto al instante). Jerarquía VER(1) < PAGAR(2) < COMPLETO(3).
- `requireProfesionalVisita` → JWT `kind:'profesional'` + **re-valida contra DB** que
  `visita.profesionalId`/`inmobiliariaId` sigan matcheando (revocación real si se
  reasignó → 401 "Tu acceso a esta visita fue revocado").
- `requireAuthOProfesional` (en `uploads.ts`) → acepta CUALQUIER JWT válido: la unión
  usuario/inquilino/co-inquilino **O** profesional. Solo lo usan los endpoints de `/uploads`.

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
- **PIN de seguridad — ELIMINADO (05/07):** ninguna acción pide PIN. `verificarPinUsuario`
  es un kill-switch que **siempre** aprueba; protege el rol/capacidad + multi-tenant. **No re-agregar.**

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
  rechaza (`/pagos/:id/validar | /rechazar`, cap `pago.conciliar`). Una liquidación queda PAGADO
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
  Header `Cross-Origin-Resource-Policy: cross-origin` para permitir embed de fotos.
  El guard (`requireAuthOProfesional`) ahora acepta también el JWT del profesional.
- Helpers: `urlEsDelTenant(url, tenant)` (valida prefijo al persistir),
  `borrarArchivoSubido(url, tenant)` (borra del Volume, tenant-scopeado) y
  **`guardarBufferSubido(buffer, tenant, ext)`** (guarda un Buffer ya en memoria sin
  pasar por el multipart ni la whitelist de mimes; lo usa el resumen bancario para
  archivar el extracto original).

**Flujos cableados** (cada uno guarda la `url` que devuelve `/uploads`):
1. Comprobante de pago → `Pago.comprobanteUrl` (el panel lo abre desde "Por validar").
2. Foto de reclamo → `Reclamo.fotoUrl` (complementaria: si falla la subida, el reclamo se crea igual).
3. Boleta de servicio → `BoletaServicio.archivoUrl`.
4. Documentos del contrato → `DocumentoContrato.archivoUrl` (CRUD `/contratos/:id/documentos`).
5. **Avatar del inquilino** → `Inquilino.imageUrl` (`PUT /mis-datos/avatar`).
6. **Documentos del inquilino** por slot → `Documento.archivoUrl` (DNI/recibos/garante).
7. **Fotos del profesional** antes/después → `VisitaProfesional.fotoAntes`/`fotoDespues`.
8. **Resumen bancario** (extracto original archivado con `guardarBufferSubido`).

> El hardening `f715055` cerró la fuga previa: `Reclamo.fotoUrl` /
> `ReclamoEvento.adjuntoUrl` / `BoletaServicio.archivoUrl` ahora validan `urlEsDelTenant`
> al persistir (antes se guardaban sin validar → un inquilino podía inyectar una imagen
> externa `https://`).

**Backend-ready sin UI de panel** (existen en el schema y el endpoint, pero el front
del panel todavía no los sube): **avatar del usuario del panel** (`PUT /me/avatar`) y
**comprobante en gastos de caja** (`MovimientoCaja.comprobanteUrl`; el `POST` de caja ya
lo persiste — se arregló el `create` que antes lo validaba y lo tiraba).

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
(+ el histórico `work-agent/historico/AUDITORIA-PROFUNDA-PROMPT.md`).

---

## 14. Decisiones de negocio (del dueño — no des-arreglar)

> Detalle en [`work-agent/05-DECISIONES.md`](./work-agent/05-DECISIONES.md).

1. **Comisión/rendición sobre el alquiler** (no el total).
2. **Cualquier co-inquilino puede pagar** el alquiler (`requireContratoAcceso 'VER'`).
3. **Gastos de rendición solo de propiedades con ingreso**; multi-dueño = por partes.
4. **PROPIETARIO_DIRECTO no es ingreso** de la inmo (rendición + caja lo excluyen).
5. **Email de usuario panel es GLOBAL** (no por tenant) a propósito — no scopear.
6. **Backdoor demo (OTP `000000`)** excluido de producción.
7. **Resumen bancario = CSV/Excel del banco, matching DETERMINÍSTICO sin IA/OCR** (04/07).
   El dueño eligió parsear el extracto, no OCR ni IA. Reglas de match: monto ±$50 +
   nombre → confianza ALTA; monto solo → MEDIA; ±5% del saldo + nombre → MEDIA; ±5%
   solo → BAJA. FIFO: la liquidación vencida más vieja primero. Conciliar
   crea un `Pago` **directo CONCILIADO** (no pasa por INFORMADO).
9. **PIN de seguridad ELIMINADO (05/07)** — ninguna acción pide PIN; protege rol/capacidad
   + multi-tenant (kill-switch `verificarPinUsuario`). Ver `work-agent/05-DECISIONES.md` §7.
10. **Reclamos "¿quién paga?" (05/07)** — propietario/inquilino/depósito con impacto real en la
    plata (rendición / cargo / depósito). Regla: el costo NO se cuenta dos veces.
8. **Migración de cartera = MAPEO FLEXIBLE de columnas** (04/07). El dueño sube SU
   propia planilla y mapea qué columna es qué (sinónimos auto-sugeridos); **no** hay
   formato fijo impuesto.

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
- **WhatsApp real** (recordatorio a morosos, invitaciones): vars `WHATSAPP_*`.

**Ya construido (05/07) — ciclo de vida del contrato, reclamos con plata real, baja del PIN** (ver `CHANGELOG.md`):
- ✅ **Historial de inquilinos** (entidad `Persona` + ficha + reuso + expediente).
- ✅ **Ciclo de vida del contrato**: depósitos en custodia, rescisión con penalidad+neteo, ajuste
  de alquiler, saldar deuda de ex-inquilinos, renovación (`CargoContrato`/`AjusteAlquiler`/`RenovacionContrato`).
- ✅ **Reclamos "¿quién paga?"** (`PagadorReclamo`) con impacto real en la plata (rendición/cargo/depósito).
  ⚠️ el cargo al inquilino aún no llega a su PWA (`CargoContrato` write-only) → follow-up.
- ✅ **Eliminación del PIN** + **"Pagos recibidos"** en los comprobantes del inquilino.

**Ya construido (04/07) — antes estaba acá como pendiente/demo:**
- ✅ **Conciliación bancaria** (`ResumenBancario`/`CreditoDetectado`): validador de
  extracto CSV/Excel **sin IA**, matching determinístico + conciliación (sin PIN). §5/§9.
- ✅ **Migración masiva de cartera** (`ImportacionCartera`): sube planilla propia con
  mapeo flexible → crea propiedades+inquilinos+contratos. §5.
- ✅ **Flujo del profesional por link mágico** + **avatar/documentos del inquilino**. §5/§9.

**Backend-ready, falta UI del panel:** avatar del usuario del panel (`PUT /me/avatar`)
y comprobante en gastos de caja (`MovimientoCaja.comprobanteUrl`; el `create` ya lo
persiste — se arregló en este pase).

**Long-tail demo-gated** (features secundarias que muestran "Próximamente"/mock en
prod, no rompen el core): negociación iterativa de renovación,
objetivos/métricas internas, partes de consorcios.

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
| **Referencia de los 153 endpoints** | [`docs/API.md`](./docs/API.md) |
| **Modelo de datos (ERD + cascadas)** | [`docs/DATA-MODEL.md`](./docs/DATA-MODEL.md) |
| **Variables de entorno** | [`docs/CONFIG.md`](./docs/CONFIG.md) |
| **Operaciones / on-call** | [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) |
| Testing | [`docs/TESTING.md`](./docs/TESTING.md) |
| Guía de frontend | [`docs/FRONTEND.md`](./docs/FRONTEND.md) |
| Glosario del dominio | [`docs/GLOSARIO.md`](./docs/GLOSARIO.md) |
| Cómo contribuir | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Seguridad | [`SECURITY.md`](./SECURITY.md) |
| Historial de cambios | [`CHANGELOG.md`](./CHANGELOG.md) |
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
