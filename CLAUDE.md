# My Alquiler — guía de trabajo del repo

> ## ⚠️ QUÉ ES ESTE ARCHIVO Y QUÉ NO ES — leer antes que nada
>
> Es la guía de **cómo trabajar** en este repo. Las secciones **§0** (reglas de proceso) y
> **§9** (convenciones de código) están vigentes y se cumplen.
>
> **NO es la descripción del sistema construido.** El grueso se escribió el **08/05/2026**,
> antes de que existiera el producto, y describe un plan que en buena parte no ocurrió. Las
> secciones marcadas con ⚠️ contienen afirmaciones **falsas**; se conservan como registro
> histórico, no como referencia.
>
> **Para saber qué hay construido:**
> - `README.md` y `PROJECT.MD` — stack real, arquitectura, URLs en vivo.
> - `docs/` — `API.md`, `DATA-MODEL.md`, `CONFIG.md`, `RUNBOOK.md`, `TESTING.md`.
> - `work-agent/` — el día a día. Empezar por `00-ESTADO.md` y `07-ECOSISTEMA.md`.
> - `apps/api/prisma/schema.prisma` — el modelo de datos real.
>
> Si algo de acá contradice a esos, **mandan esos** y hay que corregir este.
>
> El producto se llama **My Alquiler** (`myalquiler.com`). "Llave" y `llave.ar` fueron el
> nombre del brief de mayo y no existen; `@llave/*` quedó como codename de los paquetes.
>
> *Auditado contra el código el 19/08/2026 (T-21-N3-N1).*

---

## 0. CÓMO TRABAJAR EN ESTE PROYECTO (LEER PRIMERO)

### Reglas de oro
1. **No expandir scope.** Si una tarea pide X, hacé X. No agregues Y "porque queda lindo". El producto vive de constraints.
2. **No cambiar el stack sin consultar.** Las decisiones técnicas de la sección 2 están cerradas. Si encontrás un caso donde algo no funciona, avisar antes de cambiar dependencias.
3. **No agregar dependencias nuevas sin avisar.** Cada `npm install` extra es un costo. Justificar siempre.
4. **No mockear lo que ya está integrable.** Si Mercado Pago tiene sandbox, usá sandbox real, no mocks fake.
5. **No optimizar prematuramente.** El MVP tiene que funcionar, no ser perfecto. Mejoras de performance van a issue, no se hacen en la primera pasada.
6. **Mobile-first siempre** en lado inquilino. Lado inmobiliaria puede ser desktop-first pero responsive.
7. **TypeScript estricto.** `strict: true` en `tsconfig.json`. Sin `any` salvo justificación explícita en comentario.
8. **Cero datos sensibles en código.** Tokens, claves, CBU, DNI van por env vars o por DB. Si ves algo sensible hardcodeado, alertar.

### Cuándo decidir solo y cuándo preguntar

**Decidir solo:**
- Nombres de variables, archivos, funciones internas.
- Estructura interna de un componente.
- Manejo de errores estándar (try/catch, logging).
- Refactorizaciones internas que no cambian el contrato público.
- Tests unitarios para lo que estás construyendo.

**Preguntar (escribir el dilema en chat y esperar respuesta):**
- Cambios de stack o dependencias nuevas.
- Cambios al schema de DB (incluso si parece menor).
- Cambios al contrato de un endpoint que ya está consumido.
- Cualquier decisión de UX que afecte cómo se ve el producto al usuario final.
- Si una tarea no se puede completar por bloqueo externo (API caída, KYC pendiente, etc.).

### Cómo reportar progreso

Al final de cada tarea o feature:
1. **Resumen ejecutivo** en 3-5 líneas: qué hiciste, qué archivos tocaste, qué falta.
2. **Tests:** ¿escribiste tests? ¿pasan?
3. **Decisiones tomadas:** cualquier elección que no estaba en el brief.
4. **Bloqueos o dudas:** lo que necesita input humano.
5. **Próximo paso sugerido.**

### Anti-patrones a evitar

- Crear "utility files" gigantes con funciones que solo se usan en un lugar.
- Sobre-abstraer (interfaces para cosas que tienen una sola implementación).
- Comentarios obvios (`// increment counter`).
- Tests que solo testean que la función existe (no aportan).
- README.md auto-generados que repiten lo obvio.
- Reemplazar una librería bien establecida por código custom "más limpio".

---

## 1. CONTEXTO DEL PRODUCTO

> **Verificado contra el código el 19/08/2026.** Lo que sigue describe lo que HAY, no lo que
> se planeó. La decisión sobre las 4 capacidades del brief está **abierta** — ver §1.5.

### Qué es My Alquiler

Un SaaS multi-tenant de gestión de alquileres, **en producción** para una inmobiliaria real.
Es el **sistema operativo de la cobranza de una inmobiliaria administradora**, con el
inquilino y el propietario adentro: la inmobiliaria devenga, cobra, concilia, rinde y audita;
el inquilino ve una sola deuda y paga; el propietario ve su rendición.

**No somos** una pasarela de pagos ni un custodio de fondos: la plata va directo al CBU de la
inmobiliaria o del propietario, y el sistema registra y concilia. La propia landing lo dice:
*"el dinero nunca pasa por nosotros"*.
**No somos**, hoy, un producto de IA: **no hay ningún modelo de lenguaje integrado en ninguna
parte del monorepo.**

### Para quién

**A — Inmobiliaria administradora (la que paga).** 30-250 contratos. Es la cara principal del
producto y donde está el grueso del código.

**B — Inquilino.** PWA mobile-first: ve alquiler + expensas en un número, transfiere, sube el
comprobante, reclama, se lleva su certificado.

**C — Propietario.** Tiene app propia (`apps/propietario`) y portal: ve su cartera, sus
propiedades y sus rendiciones. **El brief no lo previó.**

**D — Consorcio.** Módulo construido y con tarifa propia. El brief decía que no era target.

### Las 3 personas (mantener presente al construir)

- **Mariela**, 32, inquilina freelance en Palermo. Mobile, Android gama media, paciencia limitada.
- **Roberto**, 56, dueño de inmobiliaria en Córdoba con 80 contratos. Desktop, Chrome, sin paciencia para flujos de 10 pasos.
- **Camila**, 38, mano derecha de admin con 220 propiedades. Desktop, multitarea, necesita reportes claros. **Es la clienta cero real**: prueba el producto en vivo con su equipo.

### 1.1. Capacidades CONSTRUIDAS y en producción

Cada una tiene endpoint registrado en `apps/api/src/app.ts`, handler con lógica real y front
que la consume con `apiEnabled` — o sea, en producción, no sólo en el build demo.

1. **Cobranza end-to-end sin pasarela** — devengo automático (cron in-process cada 6h,
   idempotente), liquidación única alquiler+expensas, informe de pago con comprobante,
   **validación humana** con capacidad `pago.conciliar`, rechazo, anulación y carga de efectivo.
2. **Mora dinámica** — 4 esquemas calculados on-read, configurables por inmobiliaria y por
   contrato.
3. **Caja diaria, cuentas y cierre con comisión** — sobre el alquiler, no sobre expensas.
4. **Rendición al propietario + su portal y su app.**
5. **Permisos por rol con bandeja de aprobaciones** — 5 roles (ADMIN/CAJA/OPERADOR/CARGA/
   LECTURA) y ~35 capacidades tipadas, aplicadas endpoint por endpoint.
6. **Auditoría de acciones sensibles.**
7. **Importación de cartera (Excel/CSV)** — mapeo flexible, validación por fila, dedup,
   confirmación reanudable. **Determinística, sin IA.**
8. **Importación de morosos históricos** — pedido textual de la clienta cero.
9. **Conciliación asistida por extracto bancario** — matching determinístico **sin IA**: el
   sistema sugiere, el humano confirma.
10. **Ciclo de vida del contrato** — alta, ajuste, renovación, finalización, depósito en
    custodia, garantes, co-inquilinos.
11. **Reclamos con el profesional adentro por link mágico.**
12. **Consorcio** — unidades funcionales, movimientos, asambleas, servicios comunes.
13. **PWA del inquilino** — home, comprobantes, servicios, documentos, notificaciones, y el
    **certificado de inquilino verificable públicamente**.
14. **El SaaS de sí mismo** — planes, suscripción, facturas, cupones, referidos, trial.

### 1.2. Las 4 capacidades del brief de mayo — estado verificado

> Estas son las que este documento llamó "no-negociables". **Ninguna está construida como
> está escrita.**

| # | Capacidad del brief | Estado real (19/08/2026) |
|---|---|---|
| 1 | Carga de contrato con IA | **NO EXISTE.** Sin SDK de ningún LLM, sin `pdf-parse`, sin OCR, sin endpoint. En su lugar: wizard manual + importación de cartera, los dos en producción. Ver §5.1. |
| 2 | Pago unificado con Mercado Pago | **EL RESULTADO SÍ, EL MEDIO NO.** Alquiler+expensas en una pantalla y un botón: construido. Mercado Pago: cero integración, cero webhook. Se cobra por transferencia + comprobante + validación humana. Ver §5.2. |
| 3 | Chat con el contrato (RAG) | **NO EXISTE.** Sin endpoint, sin pgvector, sin embeddings. La tabla de mensajes existe y nadie la escribe. Ver §5.3. |
| 4 | Screening crediticio | **CÁSCARA CON DATOS INVENTADOS.** Tabla, endpoint y guard reales; el informe entero sale de un PRNG sembrado con el CUIT. Cero Nosis, cero BCRA. Ver §5.4. |

### 1.3. Lo que el brief NO previó y sí se construyó

Portal y app del propietario · rendición · caja y cuentas · matriz de permisos y bandeja de
aprobaciones · auditoría · importación de cartera y de morosos históricos · conciliación por
extracto bancario · consorcio completo y tarifado · facturación del propio SaaS · certificado
de inquilino verificable · red de profesionales con link mágico.

Casi todo salió de pedidos de la clienta cero. **La reunión del 03/08 con Camila giró entera
alrededor de cobranza, morosos, permisos, consorcio y rendición. No pidió IA de contratos, ni
chat, ni screening.**

### 1.5. DECISIÓN ABIERTA — que no la tome nadie por su cuenta

Este documento **no decide** si las 4 capacidades del brief siguen siendo parte del producto.
Están sin construir y el producto encontró otra forma que la clienta cero usa todos los días.
Pueden seguir siendo el diferencial buscado, o pueden haber quedado atrás. **Lo define el
dueño, no un dev ni un agente leyendo este archivo.**

Hasta que esa decisión esté escrita acá con fecha:
- **No** empezar a construirlas por iniciativa propia.
- **No** borrar las tablas que quedaron muertas esperando esa decisión.
- **Sí** avisar si algo del producto público —landing, demo, onboarding, copy in-app— promete
  alguna de las cuatro. Hoy **varias lo hacen**: ver §14.

### Lo que NO es el MVP (no construir aunque lo pida un usuario)

- Liquidación de sueldos del consorcio.
- Firma digital del contrato (queda en papel para v1).
- Garantía digital embebida (mock con CTA, integración real en v1.1).
- App nativa iOS/Android (PWA cubre).
- Multi-idioma.
- Marketplace de servicios.
- Módulo de votaciones.
- Reservas de SUM.
- Renovación de contrato con IA.
- Negociador de aumento.

---

## 2. STACK TÉCNICO (DECIDIDO)

> ⚠️ **9 de las 21 filas de esta tabla son falsas.** Verificado el 19/08/2026. Lo que NO está
> en el código: **Clerk** (instalado en el panel pero apagado — el auth real es JWT propio +
> OTP **por email**), **Mercado Pago** (`MERCADOPAGO` es sólo un valor del enum `MetodoPago`
> para registrar a mano cómo pagó alguien), **Nosis**, **Anthropic / cualquier LLM**,
> **Cloudflare R2** (los archivos van a un volumen de Railway), **WhatsApp Cloud API**,
> **Resend**, **Redis** (el cron es in-process), **Sentry** (hay un servicio propio, Sonar),
> **Vercel** (todo corre en Railway) y **Playwright** (cero E2E; los tests son Vitest).
> PostHog existe pero sólo en la landing pública. El stack real está en `README.md` y
> `docs/CONFIG.md`.

| Capa | Decisión | Versión |
|------|----------|---------|
| Frontend (PWA inquilino) | Next.js + Tailwind + shadcn/ui | Next 14+ |
| Frontend (web inmobiliaria) | Next.js + Tailwind + shadcn/ui | Next 14+ |
| Backend API | Node.js + Fastify + Prisma | Node 20+ |
| DB principal | Postgres + pgvector | 16+ |
| Cache / queues | Redis | latest |
| Lenguaje | TypeScript estricto en todos los paquetes | 5+ |
| Monorepo | Turborepo + pnpm workspaces | latest |
| IA | Anthropic SDK (Claude Sonnet 4.6) | latest |
| OCR (fallback PDF escaneado) | Tesseract.js o Google Vision | - |
| Pasarela de pagos | Mercado Pago (Marketplace + Checkout Pro) | SDK oficial |
| Centrales de riesgo | Nosis API | - |
| Auth | Clerk | latest |
| File storage | Cloudflare R2 (S3-compatible) | - |
| Notificaciones | WhatsApp Cloud API (Meta) + Resend | - |
| Hosting frontend | Vercel | - |
| Hosting backend | Railway | - |
| Observabilidad | Sentry + PostHog | - |
| CI/CD | GitHub Actions | - |
| Tests | Vitest (unit) + Playwright (E2E) | - |

---

## 3. ESTRUCTURA DEL MONOREPO

```
llave/
├── apps/
│   ├── inquilino/          # PWA del inquilino (Next.js)
│   ├── inmobiliaria/       # Web del admin de inmobiliaria (Next.js)
│   └── api/                # Backend Fastify
├── packages/
│   ├── ui/                 # Componentes compartidos (shadcn-based)
│   ├── shared/             # Lógica compartida front/back (permisos, períodos, auth)
│   └── config/             # ESLint, TS, Tailwind shared configs
├── scripts/                # Onboarding real, utilidades de operación
├── .github/workflows/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── README.md
└── CLAUDE.md               # Este archivo
```

> **Lo que se planeó y no se construyó así.** El plan original tenía `packages/db`,
> `packages/ai` y `packages/integrations`. No existen: el schema de Prisma y su cliente viven en
> **`apps/api/prisma/`**, y los wrappers de Claude y las integraciones están dentro de
> `apps/api/src/`. Se aclara porque no es un detalle de prolijidad: quien busca el modelo de
> datos en `packages/db` no lo encuentra y puede concluir que no existe — que es exactamente lo
> que pasó al relevar T-21.

### Convenciones de naming

- Carpetas y archivos en kebab-case (`load-contract.tsx`, `pay-screen.tsx`).
- Componentes React en PascalCase (`<LoadContract />`).
- Funciones y variables en camelCase.
- Constantes globales en SCREAMING_SNAKE_CASE.
- Tablas DB en snake_case plural (`contratos`, `usuarios`).
- IDs en UUID v4.

---

## 4. MODELO DE DATOS (Prisma schema)

> ⚠️ **El schema que se transcribe abajo NO es el schema real.** Se escribió el 08/05/2026 y
> cubre ~13% de lo que hay: el real tiene **83 modelos y 79 enums**. Además inventa la
> extensión pgvector y el campo `vectorEmbedding` (no existen), le pone otro nombre a dos
> modelos, y modela a inquilinos y propietarios como un `enum Rol` de `Usuario` cuando en
> realidad son modelos aparte. Los IDs tampoco son UUID: son `cuid()`.
>
> **La fuente de verdad del modelo de datos es `apps/api/prisma/schema.prisma`**, explicado
> en prosa en `docs/DATA-MODEL.md`.

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

model Inmobiliaria {
  id            String   @id @default(uuid())
  nombre        String
  cuit          String   @unique
  emailAdmin    String   @map("email_admin")
  telefono      String?
  logoUrl       String?  @map("logo_url")
  colorPrimario String?  @map("color_primario")
  plan          Plan     @default(STARTER)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  usuarios   Usuario[]
  contratos  Contrato[]
  screenings Screening[]

  @@map("inmobiliarias")
}

enum Plan {
  STARTER
  PRO
  ENTERPRISE
}

model Usuario {
  id              String   @id @default(uuid())
  telefono        String   @unique
  email           String?
  nombre          String?
  apellido        String?
  dni             String?
  cuit            String?
  fechaNac        DateTime? @map("fecha_nac")
  rol             Rol
  inmobiliariaId  String?  @map("inmobiliaria_id")
  createdAt       DateTime @default(now()) @map("created_at")

  inmobiliaria       Inmobiliaria? @relation(fields: [inmobiliariaId], references: [id])
  propiedades        Propiedad[]
  contratosInquilino Contrato[]    @relation("inquilino")
  garantias          Garante[]
  reclamos           Reclamo[]
  mensajesChat       MensajeChat[]

  @@map("usuarios")
}

enum Rol {
  ADMIN_INMO
  OPERADOR_INMO
  INQUILINO
  PROPIETARIO
  GARANTE
}

model Propiedad {
  id            String  @id @default(uuid())
  inmobiliariaId String @map("inmobiliaria_id")
  propietarioId String  @map("propietario_id")
  direccion     String
  ciudad        String
  provincia     String
  tipo          TipoPropiedad
  m2            Int?
  ambientes     Int?
  consorcioId   String? @map("consorcio_id")

  propietario Usuario    @relation(fields: [propietarioId], references: [id])
  contratos   Contrato[]

  @@map("propiedades")
}

enum TipoPropiedad {
  DEPARTAMENTO
  CASA
  LOCAL
  GALPON
}

model Contrato {
  id                       String          @id @default(uuid())
  inmobiliariaId           String          @map("inmobiliaria_id")
  propiedadId              String          @map("propiedad_id")
  inquilinoId              String          @map("inquilino_id")
  pdfOriginalUrl           String          @map("pdf_original_url")
  montoInicial             Decimal         @map("monto_inicial") @db.Decimal(14, 2)
  moneda                   Moneda
  fechaInicio              DateTime        @map("fecha_inicio") @db.Date
  fechaFin                 DateTime        @map("fecha_fin") @db.Date
  diaPago                  Int             @map("dia_pago")
  frecuenciaAjusteMeses    Int             @map("frecuencia_ajuste_meses")
  indiceAjuste             IndiceAjuste    @map("indice_ajuste")
  porcentajeAjusteFijo     Decimal?        @map("porcentaje_ajuste_fijo") @db.Decimal(5, 2)
  comisionInmobiliaria     Decimal         @map("comision_inmobiliaria") @db.Decimal(5, 2)
  tasaPunitorioDiaria      Decimal         @map("tasa_punitorio_diaria") @db.Decimal(5, 4)
  depositoGarantia         Decimal         @map("deposito_garantia") @db.Decimal(14, 2)
  estado                   EstadoContrato  @default(BORRADOR)
  vectorEmbedding          Unsupported("vector(1536)")?  @map("vector_embedding")
  deletedAt                DateTime?       @map("deleted_at")
  createdAt                DateTime        @default(now()) @map("created_at")

  inmobiliaria   Inmobiliaria    @relation(fields: [inmobiliariaId], references: [id])
  propiedad      Propiedad       @relation(fields: [propiedadId], references: [id])
  inquilino      Usuario         @relation("inquilino", fields: [inquilinoId], references: [id])
  garantes       Garante[]
  liquidaciones  Liquidacion[]
  ajustes        AjusteContrato[]
  reclamos       Reclamo[]
  mensajesChat   MensajeChat[]

  @@map("contratos")
}

enum Moneda {
  ARS
  USD
}

enum IndiceAjuste {
  ICL
  IPC
  CASA_PROPIA
  UVA
  CAC
  RIPTE
  FIJO
}

enum EstadoContrato {
  BORRADOR
  ACTIVO
  FINALIZADO
  RESCINDIDO
}

model Garante {
  id              String      @id @default(uuid())
  contratoId      String      @map("contrato_id")
  usuarioId       String      @map("usuario_id")
  tipo            TipoGarantia
  montoCobertura  Decimal     @map("monto_cobertura") @db.Decimal(14, 2)
  proveedor       String?
  documentoUrl    String?     @map("documento_url")

  contrato Contrato @relation(fields: [contratoId], references: [id])
  usuario  Usuario  @relation(fields: [usuarioId], references: [id])

  @@map("garantes")
}

enum TipoGarantia {
  PROPIETARIA
  CAUCION
  SUELDO
  DIGITAL
}

model Liquidacion {
  id                  String      @id @default(uuid())
  contratoId          String      @map("contrato_id")
  periodo             String      // formato "2026-07"
  montoAlquiler       Decimal     @map("monto_alquiler") @db.Decimal(14, 2)
  montoExpensas       Decimal?    @map("monto_expensas") @db.Decimal(14, 2)
  montoPunitorio      Decimal     @default(0) @map("monto_punitorio") @db.Decimal(14, 2)
  montoTotal          Decimal     @map("monto_total") @db.Decimal(14, 2)
  fechaVencimiento    DateTime    @map("fecha_vencimiento") @db.Date
  estado              EstadoLiquidacion @default(PENDIENTE)
  generatedAt         DateTime    @default(now()) @map("generated_at")

  contrato Contrato @relation(fields: [contratoId], references: [id])
  pagos    Pago[]

  @@unique([contratoId, periodo])
  @@map("liquidaciones")
}

enum EstadoLiquidacion {
  PENDIENTE
  PAGADO
  PARCIAL
  VENCIDO
}

model Pago {
  id                  String       @id @default(uuid())
  liquidacionId       String       @map("liquidacion_id")
  monto               Decimal      @db.Decimal(14, 2)
  metodo              MetodoPago
  proveedorIdExterno  String?      @map("proveedor_id_externo")
  fechaPago           DateTime     @map("fecha_pago")
  comprobanteUrl      String?      @map("comprobante_url")
  conciliado          Boolean      @default(false)

  liquidacion Liquidacion @relation(fields: [liquidacionId], references: [id])

  @@map("pagos")
}

enum MetodoPago {
  MERCADOPAGO
  TRANSFERENCIA
  QR
  CRIPTO
}

model AjusteContrato {
  id                   String     @id @default(uuid())
  contratoId           String     @map("contrato_id")
  fechaAplicacion      DateTime   @map("fecha_aplicacion") @db.Date
  montoAnterior        Decimal    @map("monto_anterior") @db.Decimal(14, 2)
  montoNuevo           Decimal    @map("monto_nuevo") @db.Decimal(14, 2)
  porcentajeVariacion  Decimal    @map("porcentaje_variacion") @db.Decimal(5, 2)
  indiceAplicado       String     @map("indice_aplicado")
  valorIndiceInicio    Decimal?   @map("valor_indice_inicio") @db.Decimal(10, 4)
  valorIndiceFin       Decimal?   @map("valor_indice_fin") @db.Decimal(10, 4)
  notificadoInquilino  Boolean    @default(false) @map("notificado_inquilino")
  notificadoPropietario Boolean   @default(false) @map("notificado_propietario")

  contrato Contrato @relation(fields: [contratoId], references: [id])

  @@map("ajustes_contrato")
}

model Reclamo {
  id           String       @id @default(uuid())
  contratoId   String       @map("contrato_id")
  inquilinoId  String       @map("inquilino_id")
  categoria    Categoria
  descripcion  String
  fotoUrl      String?      @map("foto_url")
  urgencia     Urgencia
  estado       EstadoReclamo @default(ABIERTO)
  asignadoA    String?      @map("asignado_a")
  createdAt    DateTime     @default(now()) @map("created_at")
  resueltoAt   DateTime?    @map("resuelto_at")

  contrato  Contrato @relation(fields: [contratoId], references: [id])
  inquilino Usuario  @relation(fields: [inquilinoId], references: [id])

  @@map("reclamos")
}

enum Categoria {
  PLOMERIA
  ELECTRICIDAD
  CERRADURA
  CALEFACCION
  OTRO
}

enum Urgencia {
  BAJA
  MEDIA
  ALTA
  EMERGENCIA
}

enum EstadoReclamo {
  ABIERTO
  EN_CURSO
  RESUELTO
  CERRADO
}

model MensajeChat {
  id              String    @id @default(uuid())
  contratoId      String    @map("contrato_id")
  usuarioId       String    @map("usuario_id")
  rol             RolMensaje
  contenido       String    @db.Text
  citasClausulas  Json?     @map("citas_clausulas")
  derivadoHumano  Boolean   @default(false) @map("derivado_humano")
  createdAt       DateTime  @default(now()) @map("created_at")

  contrato Contrato @relation(fields: [contratoId], references: [id])
  usuario  Usuario  @relation(fields: [usuarioId], references: [id])

  @@map("mensajes_chat")
}

enum RolMensaje {
  USER
  ASSISTANT
}

model Screening {
  id                  String   @id @default(uuid())
  inmobiliariaId      String   @map("inmobiliaria_id")
  cuitConsultado      String   @map("cuit_consultado")
  nombreConsultado    String   @map("nombre_consultado")
  resultadoBcra       Int?     @map("resultado_bcra")
  scoreNosis          Int?     @map("score_nosis")
  deudasCount         Int      @default(0) @map("deudas_count")
  deudasMonto         Decimal  @default(0) @map("deudas_monto") @db.Decimal(14, 2)
  chequesRechazados   Int      @default(0) @map("cheques_rechazados")
  juiciosCount        Int      @default(0) @map("juicios_count")
  recomendacion       Recomendacion
  recomendacionRazon  String   @map("recomendacion_razon")
  pdfUrl              String?  @map("pdf_url")
  createdAt           DateTime @default(now()) @map("created_at")

  inmobiliaria Inmobiliaria @relation(fields: [inmobiliariaId], references: [id])

  @@index([inmobiliariaId, cuitConsultado])
  @@map("screenings")
}

enum Recomendacion {
  APTO
  APTO_CON_GARANTIA
  NO_APTO
}
```

---

## 5. LAS 4 CAPACIDADES — IMPLEMENTACIÓN DETALLADA

### 5.1. Carga de contrato con IA

> ⚠️ **NO ESTÁ CONSTRUIDA** (verificado el 19/08/2026). No existe el endpoint `/contratos/parse`,
> no está el SDK de Anthropic en ninguna dependencia, y `ANTHROPIC_*` no se lee en ningún lado de
> `apps/api/src`. Los `packages/ai/prompts/parse-contract.ts` que se citan abajo tampoco existen.
> Lo que hay hoy para cargar contratos es el **wizard manual** (`/contratos/nuevo`) y la
> **importación de cartera** desde Excel/CSV, que es determinística y sin IA. Lo de abajo es el
> diseño previsto, no lo implementado.

**Endpoint:** `POST /api/contratos/parse`
**Input:** archivo PDF (multipart)
**Output:** JSON estructurado con campos del contrato

**Flujo:**
1. Recibir PDF, validar tamaño (<10MB) y tipo.
2. Subir a R2. Guardar URL temporal.
3. Extraer texto: si el PDF tiene capa de texto, usar `pdf-parse`. Si no, OCR con Tesseract.
4. Llamar a Claude con prompt estructurado (ver `packages/ai/prompts/parse-contract.ts`).
5. Recibir JSON. Validar con zod schema.
6. Devolver al frontend con nivel de confianza por campo.

**Prompt base para parsing** (en `packages/ai/prompts/parse-contract.ts`):
```
Sos un asistente experto en contratos de alquiler de Argentina.
Extraé los siguientes campos del contrato adjunto y devolvelos como JSON estricto.
Si un campo no está claro o no aparece, devolvé null y nivel de confianza "bajo".

Campos a extraer: [lista de campos del schema Contrato]

Devolvé SOLO JSON, sin explicación adicional, con esta forma:
{
  "campo1": { "valor": ..., "confianza": "alto" | "medio" | "bajo" },
  ...
}
```

**Tests requeridos:**
- 5 contratos reales bien escritos → 90%+ campos en confianza alta.
- 3 contratos escaneados → OCR correcto + parsing con confianza media.
- 1 contrato corrupto/raro → fallback a formulario manual.

### 5.2. Pago unificado

> ⚠️ **NO ESTÁ CONSTRUIDA COMO SE DESCRIBE ABAJO** (verificado el 19/08/2026). **Mercado Pago
> no existe en el repo**: cero dependencia, cero variable `MP_*` leída, cero
> `POST /pagos/iniciar`, cero webhook registrado, cero `marketplace_fee`. Y **no hay
> conciliación automática**: todo pago que pasa a CONCILIADO viene de una acción humana con
> capacidad `pago.conciliar`.
>
> Lo que SÍ existe es el **resultado** para el usuario: alquiler + expensas en un solo total,
> una pantalla y un botón, transferencia al CBU real e informe de pago con comprobante. El
> flujo real está en `docs/API.md`. Límite conocido: se paga **una liquidación por vez**.

**Endpoint:** `POST /api/pagos/iniciar`
**Input:** `{ liquidacionIds: string[] }` (puede ser una o varias)
**Output:** `{ preferenceId, initPoint }` de Mercado Pago

**Flujo:**
1. Verificar que las liquidaciones pertenecen al inquilino autenticado.
2. Calcular monto total (alquiler + expensas + punitorios si aplica).
3. Crear preferencia de Marketplace en MP con `marketplace_fee` = take rate de Llave.
4. Configurar `application_fee` y `collector_id` correctamente.
5. Devolver `init_point` para redirección.

**Webhook MP:** `POST /api/webhooks/mercadopago`
- Validar firma HMAC.
- Recuperar payment ID del payload.
- Llamar a `mp.payment.get(paymentId)`.
- Si está `approved`: marcar Pago como conciliado, marcar Liquidacion como PAGADO o PARCIAL.
- Disparar notificaciones (WhatsApp + email).

### 5.3. Chat con el contrato (RAG)

> ⚠️ **NO ESTÁ CONSTRUIDA** (verificado el 19/08/2026). No existe el endpoint, no hay
> pgvector, no hay columna de embedding, no hay SDK de ningún LLM. La tabla de mensajes existe
> desde la migración inicial y **nadie la escribe ni la lee**.
>
> El "chat" que existe es un **simulacro del build demo**: matchea palabras clave contra diez
> respuestas fijas y cita cláusulas **inventadas a mano** sobre un contrato ficticio. En
> producción no se monta — pero el onboarding y el nav del inquilino SÍ lo prometen. Ver §14.

**Setup inicial al cargar contrato:**
1. Tomar el texto completo del contrato.
2. Chunking por cláusulas (no por tokens). Cada cláusula → un chunk.
3. Generar embedding con Anthropic / OpenAI / Cohere (decidir, default Claude).
4. Guardar en `contratos.vector_embedding` o tabla aparte si hay muchos chunks.

**Endpoint:** `POST /api/chat/contrato/:contratoId`
**Input:** `{ mensaje: string }`
**Output:** stream de respuesta + citas

**Flujo:**
1. Validar que el inquilino autenticado es el del contrato.
2. Embed del mensaje del usuario.
3. Top-K (k=3) cláusulas más relevantes por similitud coseno.
4. Construir prompt con system + cláusulas + historial reciente (últimos 6 mensajes).
5. Llamar a Claude streaming.
6. Guardar mensaje user + respuesta assistant en `mensajes_chat`.

**System prompt (no modificar sin consultar):**
```
Sos el asistente de Llave. Respondés solo preguntas sobre el contrato del usuario.

REGLAS:
- Solo respondés con información que aparece en el contrato. Si no aparece, decís "Eso no está claro en tu contrato".
- Citás siempre el texto exacto cuando hay una respuesta.
- NO das interpretación legal. Si la pregunta requiere análisis legal, derivás a la inmobiliaria.
- NO respondés sobre el contrato de otros usuarios bajo ninguna circunstancia.
- Tono: claro, directo, español argentino, voseo.
- Si la pregunta es sobre desalojo, juicio o conflicto serio: derivás a humano.

Cláusulas relevantes:
[chunks]

Historial:
[mensajes]
```

### 5.4. Screening crediticio

> ⚠️ **NO ESTÁ CONSTRUIDA, Y ADEMÁS FABRICA DATOS** (verificado el 19/08/2026). Existe la
> cáscara completa —tabla, endpoint registrado, guard multi-tenant, tests— pero el informe
> entero (score, deudas BCRA, cheques, familia, domicilio, empleador, patrimonio) sale de un
> **PRNG FNV-1a sembrado con los dígitos del CUIT** (`routes/inquilino-mundo.ts:173-180`).
> **Cero llamadas a Nosis, BCRA, RENAPER, ARCA o Veraz.**
>
> El endpoint persiste esos informes como `estado: COMPLETO` sobre **personas reales
> identificadas por CUIT y nombre**. Hoy ningún front lo llama y la pantalla está bloqueada en
> producción, pero **el endpoint sigue vivo, autenticado y sin gate**.
> `work-agent/07-ECOSISTEMA.md` ya lo tiene como riesgo, con la recomendación de devolver 501
> hasta que exista una fuente real.

**Endpoint:** `POST /api/screening`
**Input:** `{ cuit: string, nombre: string }`
**Output:** screening completo con recomendación

**Flujo:**
1. Verificar cache: si hay screening del mismo CUIT < 30 días, devolver cacheado.
2. Consultar BCRA Central de Deudores (gratis, scraping o API si está disponible).
3. Consultar Nosis API.
4. Combinar resultados.
5. Llamar a Claude para generar recomendación + razón.
6. Generar PDF con `pdfkit` o similar.
7. Guardar en `screenings` table + R2.
8. Devolver objeto completo.

**Recomendación lógica base (la IA puede ajustar):**
- Score Nosis ≥ 700 + BCRA 1-2 + sin juicios → **APTO**
- Score 500-700 + BCRA 1-3 → **APTO_CON_GARANTIA**
- Score < 500 o BCRA 4-5 o juicios → **NO_APTO**

---

## 6. PANTALLAS

### 6.1. PWA Inquilino (apps/inquilino)

| # | Ruta | Componente | Resumen |
|---|------|------------|---------|
| 1 | `/login` | `LoginScreen` | OTP por WhatsApp |
| 2 | `/` | `HomeScreen` | Cards de alquiler + expensas |
| 3 | `/pago/:liqId` | `DetallePago` | Detalle del concepto y botón Pagar |
| 4 | `/pago/:liqId/checkout` | `CheckoutScreen` | Redirección a MP |
| 5 | `/contrato` | `ContratoScreen` | Header + chat IA |
| 6 | `/reclamos/nuevo` | `NuevoReclamo` | Formulario de problema |
| 7 | `/comprobantes` | `Comprobantes` | Lista + descarga PDF |

**Componentes compartidos:**
- `<NavBar />` con tab bar inferior
- `<PaymentCard />` reutilizable en home y comprobantes
- `<ChatBubble />` para el chat IA

### 6.2. Web Inmobiliaria (apps/inmobiliaria)

| # | Ruta | Componente | Resumen |
|---|------|------------|---------|
| 1 | `/login` | `LoginScreen` | Email + password (Clerk) |
| 2 | `/` | `Dashboard` | KPIs + gráfico + lista eventos |
| 3 | `/contratos` | `ListaContratos` | Tabla + filtros |
| 4 | `/contratos/:id` | `DetalleContrato` | Tabs Resumen/Pagos/Documentos/Historial/Comunicaciones |
| 5 | `/contratos/nuevo` | `CargarContrato` | 4 pasos con IA |
| 6 | `/screening` | `VerificarInquilino` | Form CUIT + resultado |
| 7 | `/pagos` | `PagosDelMes` | Tabla con estados de cobro |
| 8 | `/configuracion` | `Config` | Datos inmobiliaria + equipo + plan |

---

## 7. PLAN DE SPRINTS (20 días)

> ⚠️ **ARTEFACTO HISTÓRICO — no ejecutar.** Plan de 20 días escrito el 08/05/2026, con demo
> fechada el 28 de mayo. El producto está en producción desde entonces, y varias de sus
> instrucciones hoy son imposibles porque describen un stack que no se usó. Se conserva como
> registro de lo que se pensó. El estado real del trabajo vive en `work-agent/`.

### Sprint 0 — Setup (días 1-3)
- Crear monorepo Turborepo + pnpm workspaces.
- Configurar TypeScript strict + ESLint + Prettier compartidos.
- Setear Vercel (apps/inquilino, apps/inmobiliaria) + Railway (api + Postgres + Redis).
- Aplicar schema Prisma. Migración inicial.
- Configurar Clerk (apps de auth en ambos frontends).
- Setear shadcn/ui en `packages/ui` con tokens de diseño (paleta violeta/lavanda).
- Configurar Sentry + PostHog en los 3 entornos.
- README.md básico con instrucciones de setup local.

**Criterio de aceptación Sprint 0:**
- `pnpm dev` levanta los 3 servicios (inquilino, inmo, api).
- Login con Clerk funciona en ambos frontends.
- DB poblada con seed mínimo.

### Sprint 1 — Lado inmobiliaria + carga de contrato con IA (días 4-9)
- Pantallas Login, Dashboard, ListaContratos, DetalleContrato (tabs Resumen y Documentos).
- Pantalla CargarContrato con upload + integración Claude.
- Endpoint `POST /api/contratos/parse`.
- Endpoint `POST /api/contratos` para crear.
- Endpoint `GET /api/contratos` con filtros.
- Generación automática de primera Liquidacion al confirmar contrato.
- Tests del parser con 5 contratos de muestra.

**Criterio de aceptación Sprint 1:**
- Roberto puede subir un PDF, ver datos extraídos, editar, confirmar y verlo en su lista.
- 90%+ de los campos vienen correctos en contratos digitales.

### Sprint 2 — Lado inquilino + chat IA (días 10-14)
- PWA setup (manifest, service worker, install prompt).
- Pantalla Login con OTP por WhatsApp (mock en este sprint, integración real en Sprint 3).
- Pantalla Home con cards.
- Pantalla DetallePago + Checkout (con stub a MP).
- Pantalla Contrato con chat RAG.
- Pantalla NuevoReclamo.
- Pantalla Comprobantes (con datos de prueba).
- Vectorización del contrato al guardarse (background job).
- Endpoints `/api/chat/contrato/:id` con streaming.
- Test set de 30 preguntas frecuentes para el chat.

**Criterio de aceptación Sprint 2:**
- Mariela puede entrar (con login mock), ver alquiler, pagar (mock), chatear con su contrato.
- 25/30 preguntas del test set se responden correctamente.

### Sprint 3 — Integraciones reales (días 15-19)
- Integración real con Mercado Pago Marketplace (sandbox + producción).
- Webhook MP con validación HMAC.
- Conciliación automática.
- Integración real con Nosis API.
- Pantalla VerificarInquilino end-to-end.
- Generación PDF del informe.
- Pantalla PagosDelMes.
- Integración WhatsApp Cloud API (OTP + recordatorios + notificaciones de aumento).
- Email transaccional con Resend (comprobantes + invitaciones).
- Cronjob: generar liquidaciones día 1 + recordatorios día 3 + aumentos día 25.

**Criterio de aceptación Sprint 3:**
- Pago real end-to-end con MP en sandbox.
- Screening real con Nosis devuelve resultado en <30 seg.
- Recordatorios de pago llegan por WhatsApp.

### Sprint 4 — Pulido y demo (día 20)
- Cargar 5-10 contratos reales (provistos por el cliente cero).
- E2E manual con 2 inquilinos reales.
- Bug fixing.
- Landing pública en `llave.ar` con video y formulario de lista de espera.
- Generar QR para charla del 28.
- Slides con screenshots reales.
- Script de demo de 5 minutos (ensayar 2 veces).

**Criterio de aceptación Sprint 4:**
- Demo en vivo de 5 minutos funciona end-to-end sin caídas.
- Plan B: video grabado de respaldo.

---

## 8. INTEGRACIONES — SETUP

> ⚠️ **NINGUNA DE ESTAS INTEGRACIONES ESTÁ CABLEADA** (verificado el 19/08/2026): Mercado
> Pago, Nosis, WhatsApp Cloud API, Anthropic, Cloudflare R2 y Resend **no existen en el
> código** — ni dependencia, ni variable leída, ni llamada. Clerk está instalado pero apagado;
> PostHog corre sólo en la landing.
>
> Lo que sí está integrado: **SMTP vía nodemailer**, **volumen de Railway** para archivos y
> **Sonar** para errores. Esta sección es el setup que se planeó, no el que existe.

### 8.1. Mercado Pago

**Tipo de cuenta:** Marketplace.
**Setup:**
1. Crear app en Mercado Pago Developers.
2. Obtener `ACCESS_TOKEN` y `PUBLIC_KEY` de sandbox y producción.
3. Configurar OAuth para que cada inmobiliaria autorice a Llave a cobrar en su nombre.
4. Implementar `marketplace_fee` para take rate de Llave.

**Variables de entorno:**
```
MP_ACCESS_TOKEN=...
MP_PUBLIC_KEY=...
MP_CLIENT_ID=...
MP_CLIENT_SECRET=...
MP_WEBHOOK_SECRET=...
```

### 8.2. Nosis

**Setup:**
1. Contactar comercial de Nosis para contrato API.
2. Obtener `API_KEY`.
3. Endpoint principal: `https://api.nosis.com/v1/informe-comercial/cuit/{cuit}`.
4. Cachear informes 30 días.

**Variables:**
```
NOSIS_API_KEY=...
NOSIS_BASE_URL=...
```

### 8.3. WhatsApp Cloud API

**Setup:**
1. Crear app en Meta for Developers.
2. Verificar número de WhatsApp Business.
3. Crear y aprobar plantillas:
   - `otp_login` (OTP de 6 dígitos)
   - `recordatorio_pago` (te toca pagar)
   - `aviso_aumento` (subió tu alquiler)
   - `invitacion_inquilino` (link a la app)

**Variables:**
```
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
```

### 8.4. Anthropic Claude

**Variables:**
```
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

**Activar prompt caching** para system prompts y cláusulas de contratos repetidas.

### 8.5. Cloudflare R2

**Variables:**
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=llave-prod
```

### 8.6. Resend

```
RESEND_API_KEY=...
RESEND_FROM_EMAIL=hola@llave.ar
```

### 8.7. Clerk

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

### 8.8. Sentry + PostHog

```
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_AUTH_TOKEN=...
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=...
```

---

## 9. CONVENCIONES DE CÓDIGO

### TypeScript
- `strict: true`. Sin `any` salvo justificado en comentario `// any-justified: <razón>`.
- Preferir `unknown` y type guards sobre `any`.
- Usar zod para validación de inputs externos (HTTP, archivos, env).
- Tipos compartidos en `packages/shared/src` (lógica que usan los dos fronts y la API).

### React / Next
- Server Components por default. `"use client"` solo cuando es necesario (interactividad real, hooks de browser).
- Data fetching con `fetch` en Server Components o React Query en Client Components.
- Forms con `react-hook-form` + `zod`.
- Navegación con `next/link` y `next/navigation`.

### Tests
- Vitest para unit tests (lógica de negocio, parsers, utils).
- Playwright para E2E críticos (login, pagar, chat).
- Mínimo: tests unitarios de los 4 servicios core (parse contract, payment, chat, screening).
- Nombrar archivos `*.test.ts` o `*.spec.ts`.
- Coverage no es métrica, pero los servicios core requieren tests.

### Commits
- Convencional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- Mensaje en español o inglés (consistente dentro del proyecto).

### Manejo de errores
- Errores tipados: `class AppError extends Error` con `code` y `statusCode`.
- En API: middleware que convierte AppError a respuesta HTTP.
- En frontend: `<ErrorBoundary>` por ruta + toasts para errores recuperables.
- Loggear todo error inesperado a Sentry con contexto.

### Seguridad
- Nunca loggear tokens, contraseñas, CBU, DNI completos.
- Validar autorización en cada endpoint (`req.user.inmobiliariaId === resource.inmobiliariaId`).
- Rate limiting en endpoints públicos (login, signup, OTP).
- CORS estricto: solo dominios de Llave.
- HTTPS siempre. HSTS activo.
- Rotación de secretos cada 90 días (proceso documentado).

---

## 10. VARIABLES DE ENTORNO — TEMPLATE

> ⚠️ **Esta lista no es el contrato de entorno real.** De las ~35 variables que enumera, la API
> lee 21 y **ninguna de las de integraciones** (`MP_*`, `NOSIS_*`, `WHATSAPP_*`,
> `ANTHROPIC_*`, `R2_*`, `RESEND_*`, `CLERK_*`): están declaradas y no las agarra nadie.
>
> **El contrato real es `apps/api/src/env.ts`:** DATABASE_URL, JWT_SECRET, PORT, NODE_ENV,
> DEMO_MODE, CORS_ORIGINS, FECHA_LANZAMIENTO, CRON_SECRET, CRON_DEVENGO, SONAR_* (6),
> SOPORTE_TENANT_IDS, UPLOADS_DIR y SMTP_HOST/PORT/USER/PASS. En los fronts,
> `NEXT_PUBLIC_API_URL` es la que define `apiEnabled`. Documentación viva: `docs/CONFIG.md`.

```bash
# === apps/api/.env ===
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6

MP_ACCESS_TOKEN=
MP_CLIENT_ID=
MP_CLIENT_SECRET=
MP_WEBHOOK_SECRET=

NOSIS_API_KEY=
NOSIS_BASE_URL=

WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

RESEND_API_KEY=
RESEND_FROM_EMAIL=

CLERK_SECRET_KEY=

SENTRY_DSN=
SENTRY_AUTH_TOKEN=
POSTHOG_KEY=
POSTHOG_HOST=

# === apps/inquilino/.env.local ===
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
NEXT_PUBLIC_MP_PUBLIC_KEY=

# === apps/inmobiliaria/.env.local ===
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

---

## 11. CRITERIOS DE ACEPTACIÓN MVP (al cerrar Sprint 4)

> ⚠️ **No describe este producto.** Es el checklist del MVP planeado en mayo: mide features que
> no existen (parsing con IA, chat en streaming, screening con Nosis, pago con MP, Sentry,
> eventos de PostHog) y apunta a un dominio que nunca existió. Dos ítems son ciertos pero no
> como se describen: la liquidación no la genera "un cron del día 1" sino un devengo cada 6h
> idempotente, y **los aumentos por ICL/IPC no son automáticos** — no hay ninguna consulta a
> BCRA ni a INDEC; el ajuste lo carga una persona.
>
> Los criterios vigentes por feature están en `work-agent/`.

### Funcionales
- [ ] Inmobiliaria puede registrarse y loguear.
- [ ] Inmobiliaria puede subir un PDF de contrato y la IA extrae 12+ campos correctamente.
- [ ] Inmobiliaria puede editar y confirmar el contrato.
- [ ] Inmobiliaria puede verificar un inquilino con CUIT y obtener resultado de screening.
- [ ] Sistema genera liquidación automática al inicio de mes.
- [ ] Inquilino recibe invitación por WhatsApp y completa onboarding con OTP.
- [ ] Inquilino ve home con alquiler y expensas (cuando aplica).
- [ ] Inquilino paga con Mercado Pago end-to-end.
- [ ] Inquilino chatea con su contrato y obtiene respuestas correctas.
- [ ] Inquilino puede reportar un problema.
- [ ] Inmobiliaria recibe notificación de nuevo reclamo.
- [ ] Aumentos automáticos por ICL e IPC se aplican correctamente.

### No-funcionales
- [ ] PWA instalable en Android y iOS.
- [ ] Tiempo de carga del home <2s en 3G.
- [ ] Parsing de contrato <30s.
- [ ] Chat con contrato responde en streaming en <5s primer token.
- [ ] Screening Nosis devuelve resultado en <30s.
- [ ] Sentry captura errores en producción.
- [ ] PostHog trackea eventos clave (signup, primer pago, primer chat, reclamo).
- [ ] HTTPS en todos los entornos.
- [ ] Backups automáticos de Postgres diarios.

### Demo del 28 de mayo
- [ ] Landing pública en llave.ar.
- [ ] Formulario de lista de espera funcional.
- [ ] QR para escanear que lleva al formulario.
- [ ] Demo en vivo de 5 minutos rehearsada.
- [ ] Video backup grabado por si algo falla.

---

## 12. ROADMAP POST-MVP (NO construir en MVP)

**v1.1 (junio-agosto):**
- Firma digital del contrato (Signia o DocuSign).
- Garantía digital integrada (Garantear o Hoggax via API).
- Factura electrónica vía ARCA.
- Conciliación bancaria avanzada (transferencias bancarias además de MP).

**v1.5 (septiembre-noviembre):**
- Conector con AdminProp / Octopus / Spot (administraciones).
- Renovación de contrato con IA.
- Multi-cuenta para propietarios particulares (sin inmobiliaria).
- App nativa iOS y Android.

**v2 (2027):**
- Negociador de aumento con IA.
- Multi-país (Uruguay, Chile).
- Marketplace de servicios.
- Módulo de votaciones de consorcio.

---

## 13. CONTACTO Y PROPIEDAD

- **Owner técnico:** Alan Tapia
- **Repo:** github.com/soyalantapia/inmobiliaria-inquilinos-app (privado)
- **Producción:** `admin.myalquiler.com` (panel) · `app.myalquiler.com` (PWA) · API en Railway
- **Demo pública estática:** GitHub Pages (build sin `NEXT_PUBLIC_API_URL`)
- **Cliente cero:** una inmobiliaria real, en producción

> Antes decía repo `xnod/llave`, producción `llave.ar` y staging `staging.llave.ar`. Ninguno de
> los tres existe ni existió.

---

## 14. PROMESAS PÚBLICAS QUE HOY NO TIENEN RESPALDO EN CÓDIGO

> Esto **no es deuda de documentación**: lo ve un prospecto o un inquilino real. Ninguna de las
> cuatro capacidades del brief está construida, pero cuatro superficies siguen anunciándolas.
> Verificado el 19/08/2026.

1. **El onboarding del inquilino, que corre EN PRODUCCIÓN.** Se monta sin gate de `apiEnabled`
   (`apps/inquilino/src/app/(app)/layout.tsx`), así que lo ve todo inquilino real. Dice
   textual: *"Una IA que leyó tus cláusulas y te responde al instante"* y *"Te cita la cláusula
   exacta del contrato"*, con un CTA *"Probar el Asistente"* que lleva a `/broker` — que en
   producción devuelve **"Próximamente"**. El botón central del nav, el más prominente del
   mobile, se llama **"Asistente"** y va al mismo lugar.
   *(`components/onboarding.tsx:81-88`, `components/nav-bar.tsx:36`, `broker/page.tsx:113`)*

2. **El demo público de GitHub Pages.** Como se construye sin `NEXT_PUBLIC_API_URL`, corre en
   modo demo: `/contratos/nuevo` muestra **"Extrayendo datos con IA · Claude está leyendo el
   contrato"** con un checklist falso y datos hardcodeados, y la simulación de screening dice
   *"Validando identidad contra RENAPER y ARCA"* y firma el PDF con *"Fuentes: Nosis, BCRA,
   ARCA"*. Sobre datos inventados.

3. **La landing `/precios`.** Vende *"Cobranzas con IA"*, *"Negociador IA al renovar"* (que este
   mismo documento pone en el roadmap 2027) e *"IA carga 200+ contratos en minutos"* —
   describiendo la importación de Excel, que es determinística y no usa IA.

4. **`package.json`** describe el producto como *"(alquiler + expensas + chat IA + screening)"*.

**Ninguna de estas cuatro se toca sin decisión del dueño** (ver §1.5), pero **ninguna debería
quedar como está.** Están anotadas como tareas en `work-agent/09-TAREAS-REUNION-CAMILA.md`.

---

**Última actualización:** 19/08/2026 — auditoría contra el código (T-21-N3-N1).
**Estado:** §0 y §9 vigentes. El resto, marcado sección por sección.
