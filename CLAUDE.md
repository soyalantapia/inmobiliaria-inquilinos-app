# LLAVE — Plataforma inmobiliaria

> **Este archivo es la fuente de verdad del proyecto.** Léelo completo antes de cada sesión de trabajo. Si algo en este archivo entra en conflicto con un pedido en chat, **avisar antes de proceder**.

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

### Qué es Llave

Llave es una plataforma que centraliza la experiencia de alquiler y consorcio en una sola app móvil para el inquilino, mientras le da a la inmobiliaria un dashboard simple para cargar contratos con IA, cobrar automático y verificar la solvencia del entrante.

**No somos** un software de back-office (eso ya lo hacen Octopus, AdminProp, Spot). **Somos** la capa de experiencia del usuario final, que se enchufa con APIs a sistemas existentes cuando hace falta.

### Para quién

**Audiencia A — Inquilino (cara visible).** La persona que vive y paga. Hoy tiene 2-3 apps fragmentadas. Quiere una sola.

**Audiencia B — Inmobiliaria mediana (cliente B2B).** 30-150 contratos. Hoy en Excel + WhatsApp manual. Quiere ordenar y modernizar sin tirar lo que ya funciona.

**Audiencia C — Administración de consorcio (cliente B2B lateral).** Ya tiene su sistema (AdminProp, Octopus). Para esos integramos vía API o conector en v1.5. **No es target del MVP.**

### Las 3 personas (mantener presente al construir)

- **Mariela**, 32, inquilina freelance en Palermo. Mobile, Android gama media, paciencia limitada.
- **Roberto**, 56, dueño de inmobiliaria en Córdoba con 80 contratos. Desktop, Chrome, sin paciencia para flujos de 10 pasos.
- **Camila**, 38, mano derecha de admin con 220 propiedades. Desktop, multitarea, necesita reportes claros.

### Las 4 capacidades del MVP (no-negociables)

1. **Carga de contrato con IA** — PDF → Claude → JSON estructurado → revisión humana → DB.
2. **Pago unificado** — alquiler y expensas en una sola pantalla, una sola pasarela.
3. **Chat con el contrato** — RAG sobre cláusulas, citas exactas, deriva a humano cuando hace falta.
4. **Screening crediticio** — CUIT del entrante → Nosis API → BCRA → recomendación IA en <30 seg.

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
│   ├── db/                 # Prisma schema + cliente
│   ├── ai/                 # Wrappers de Claude (parsing + chat)
│   ├── integrations/       # MP, Nosis, WhatsApp, Resend
│   └── config/             # ESLint, TS, Tailwind shared configs
├── .github/workflows/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── README.md
└── CLAUDE.md               # Este archivo
```

### Convenciones de naming

- Carpetas y archivos en kebab-case (`load-contract.tsx`, `pay-screen.tsx`).
- Componentes React en PascalCase (`<LoadContract />`).
- Funciones y variables en camelCase.
- Constantes globales en SCREAMING_SNAKE_CASE.
- Tablas DB en snake_case plural (`contratos`, `usuarios`).
- IDs en UUID v4.

---

## 4. MODELO DE DATOS (Prisma schema)

```prisma
// packages/db/prisma/schema.prisma

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
- Tipos compartidos en `packages/db/types` o `packages/types`.

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

- **Owner técnico:** Alan Tapia (XNOD)
- **PM:** [a designar]
- **Equipo:** [a designar — 2 devs full-time + 1 diseñador 50% Sprint 0]
- **Repo:** github.com/xnod/llave (privado)
- **Producción:** llave.ar
- **Staging:** staging.llave.ar

---

**Última actualización:** 8/05/2026 — V1
**Próxima revisión:** después del cierre de Sprint 0 (día 4)
