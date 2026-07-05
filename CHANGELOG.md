# Changelog — My Alquiler

> Historial de cambios. Formato inspirado en Keep a Changelog. Las fechas son las de
> los commits en `main`. Para el detalle técnico de cada hito ver [`PROJECT.MD`](./PROJECT.MD)
> y [`work-agent/03-AUDITORIAS.md`](./work-agent/03-AUDITORIAS.md).

---

## [Sin versionar] — estado actual

Plataforma SaaS multi-tenant para inmobiliarias (panel) e inquilinos (PWA). Estado de cambios desde el handoff inicial hasta hoy.

### Baja de contrato — auditoría adversarial + cierre del lado panel (05/07)
Auditoría multi-agente (25 agentes, 7 dimensiones, verificación adversarial doble) del ship de
baja de contrato. Veredicto: **SEGURO_CON_OBSERVACIONES** — núcleo sólido (multi-tenant/auth/plata
verificados limpios, 0 bloqueantes; 2 falsos positivos refutados con evidencia). Se cerraron los
hallazgos reales, todos en el lado panel/front (`fix/baja-contrato-panel`, `3921edc`):
- **Cableado del preview**: el diálogo de "Finalizar" ahora consulta `GET /contratos/:id/finalizar-preview`
  y muestra los colaterales (deuda que queda, cuotas a anular, pagos en revisión, co-inquilinos,
  reclamos) antes de confirmar — el endpoint estaba sin consumidor y la baja se confirmaba a ciegas.
- **Copy corregido**: el diálogo decía "las liquidaciones se conservan" cuando finalizar anula las
  cuotas futuras impagas; ahora lo aclara y el toast reporta cuántas se anularon.
- **Cobranza de ex-inquilinos**: el PDF de morosos suma una sección "Ex-inquilinos · contrato
  finalizado con deuda" para que la deuda conservada tras la baja sea accionable (antes sólo se veía
  en el detalle del contrato). `exportarCobradoPdf` deriva de `cobrables` → el reporte cuadra.
- **Preview endurecido**: guard de rol CARGA (→403) igual que finalizar; y ya no cuenta como
  `deudaVencida` una cuota futura con pago no conciliado (INFORMADO/RECHAZADO).
- **Simetría demo**: `/co-inquilinos/:id/aceptar` (demo) suma `exigirContratoActivo`.
- Test `baja-contrato.test.ts` +2 regresiones (guard CARGA, delta anti-deuda-fantasma) → **10/10**.
  Sin migración. Deployado a back+front; E2E prod OK. Pendiente menor: congelar `mesesCumplidos` del
  certificado en baja anticipada (necesita `finalizadoAt`).


### Baja de contrato: estado real al inquilino + anti-deuda-fantasma (04/07)
Auditoría multi-agente del proceso de baja (31 hallazgos: 2 CRÍTICOS, 11 ALTOS, 10 MEDIOS,
8 BAJOS). Bug raíz reportado: al finalizar un contrato el panel lo mostraba dado de baja pero
la PWA del inquilino lo seguía mostrando **ACTIVO, con el CBU para transferir**. Fix
(`fix/baja-contrato-estado-inquilino`, test `test/baja-contrato.test.ts` 8/8):
- **`GET /mi-contrato` ahora devuelve `estado`** y **anula `datosCobranza` (CBU/alias)** si el
  contrato no está ACTIVO → la PWA no puede ofrecer transferir a un contrato muerto (antes el
  409 llegaba **después** de mover la plata). La PWA muestra "Contrato finalizado" (home,
  /contrato, /comprobantes, checkout) y esconde todo CTA de pago.
- **Finalizar anula las cuotas FUTURAS impagas sin pago** (proyecciones del devengo que el
  ex-inquilino no ocupó) y **conserva la deuda ya vencida** (real y cobrable). El filtro
  `pagos: { none }` protege un pago en vuelo. `marcarLiquidacionesVencidas` sólo toca contratos
  ACTIVO (cinturón anti-morosidad-fantasma). El panel saca los finalizados del KPI/PDF de morosos.
- **Acceso de SOLO LECTURA del ex-inquilino:** finalizar ya **no desvincula** al inquilino
  (`contratoId` se conserva) → puede re-loguear y ver su historial; las escrituras las corta
  `exigirContratoActivo`.
- **Un pago en vuelo (INFORMADO) se puede validar** aunque el contrato ya esté finalizado (la
  plata se recibió; entra a rendición). **Notificaciones** dejan de decir "tu alquiler está
  atrasado" en un contrato finalizado. **Certificado** marca `vigente:false` y congela los meses.
- **Guards** agregados: aceptar co-invitación y borrar co-inquilino exigen contrato ACTIVO.
  **Nuevo endpoint** `GET /contratos/:id/finalizar-preview` (deuda/pagos en vuelo/co-inquilinos/
  reclamos) para que el diálogo del panel avise antes de dar de baja. **Errores 409/409** en la
  PWA dejan de mostrarse como "revisá tu conexión".
- **Incidental:** `prisma/seed.ts` upserteaba `Rendicion` por `propietarioId_periodo`, unique
  que el schema removió (rendición incremental) → `seedBase` estaba **roto** y toda la suite de
  tests fallaba. Corregido a upsert por `id` fijo.

### Prep del piloto Ramiro + fix de migración de cartera (04/07)
- **`fix(importaciones)` (`89977a4`, en main `108065e`):** la migración masiva de cartera
  creaba el contrato ACTIVO desde la fecha de inicio de la planilla y devengaba TODAS las
  liquidaciones desde ahí → un contrato con inicio viejo nacía con esos meses como VENCIDO
  = **deuda FALSA** (reproducido en el tenant demo: inicio 6 meses atrás → deudaTotal = 6×
  el alquiler). Fix: la migración devenga desde el **mes actual** (el contrato conserva su
  fechaInicio real para antigüedad/ajuste). Validado E2E en prod: contrato migrado nace
  **PENDIENTE con deuda $0**. El alta manual "en curso" (wizard `periodosAnteriores`) no cambia.
- **Prep de reunión** (`work-agent/PILOTO-RAMIRO.md`): dry-run E2E del flujo del piloto
  (registro → cartera → contrato en curso con mora → morosidad) 15/15 contra prod en un
  tenant demo separado; guión de demo, checklist de la planilla del lunes, y las preguntas
  de producto para desbloquear Consorcios Fase 2.

### Backlog de archivos/adjuntos — construido de punta a punta (04/07)
La auditoría de archivos/adjuntos (02–03/07) dejó un backlog de superficies "no
construidas en prod": campos que ya vivían en el schema pero ningún endpoint los usaba.
Esta tanda los construyó TODOS, de verdad, E2E, con la demo intacta y ambos modos andando.
Migración `20260703110000_avatar_credito_importacion` aplicada en prod (la API booteó
healthy). Deploy `railway up` de los 3 servicios (back/front/inquilino), push
`15f641c..535d15d`, árbol limpio.
- **Avatar del inquilino + documentos reales (DNI/recibos/garante)** (`8940981`). El
  inquilino sube su foto de perfil (`GET/PUT /mis-datos/avatar`, validado por tenant con
  `urlEsDelTenant`) y sus documentos por slot (`GET/POST/DELETE /mis-documentos`): catálogo
  de 7 slots auto-provisionado por tenant (dni-frente/dorso, recibo-1/2, cert-laboral,
  garante-escritura/recibo), idempotente. El panel los lee read-only
  (`GET /contratos/:id/documentos-inquilino`, distinto del expediente que carga la inmo).
  Migración: `inquilinos.imageUrl`.
- **Flujo real del profesional por link mágico** (`f05b24d`). El profesional entra por un
  token opaco (`randomBytes(24)`) que la inmo le manda por WhatsApp — sin cuenta ni password.
  `GET /visitas-publicas/:token` (público) lo canjea por un JWT `kind:'profesional'` (14d) que
  re-valida contra la DB (revocación real si se reasigna). Máquina de estados idempotente
  **ASIGNADO→CONFIRMADA→EN_CAMINO→LISTO**, cada transición con su timestamp + `ReclamoEvento`
  para la timeline. Fotos antes/después a `/uploads` (el guard ahora acepta el JWT del
  profesional). `POST /reclamos/:id/asignar` hace upsert de la visita y devuelve `visitaToken`;
  `…/visita/regenerar-link` rota el token sin reasignar.
- **Validador de resumen bancario — CSV/Excel, matching determinístico SIN IA** (`1404004`).
  Decisión del dueño: parsear el extracto del banco (con `xlsx`), nada de OCR ni IA.
  `POST /resumenes-bancarios` sube y detecta créditos; `GET /…/:id` recalcula el matching
  **LIVE** contra el estado actual (pagos INFORMADO + liquidaciones abiertas con saldo, FIFO
  por vencimiento). Reglas de confianza: monto ±$50 + nombre → ALTA; monto solo → MEDIA;
  ±5% del saldo + nombre → MEDIA; ±5% solo → BAJA. Conciliar exige **PIN**, tiene lock atómico
  anti doble-conciliación y crea un **Pago CONCILIADO directo** (TRANSFERENCIA, sin pasar por
  INFORMADO porque lo detectó el banco). Todo gated con `pago.conciliar`.
- **Migración de cartera — Excel/CSV con mapeo flexible de columnas** (`b153ebe`). El dueño
  sube SU propia planilla y mapea qué columna es qué (sinónimos auto-sugeridos, no hay formato
  fijo impuesto). 3 pasos: `POST /importaciones-cartera` (parsea headers + filas, máx 2000,
  no archiva el archivo por PII) → `PUT /…/:id/mapeo` (valida fila-por-fila: OK/ADVERTENCIA/
  ERROR/DUPLICADO por email) → `POST /…/:id/confirmar` (crea propiedad + propietario
  find-or-create + inquilino + contrato ACTIVO con liquidaciones devengadas). `403` extra si el
  rol es CARGA o LECTURA. Gated con `contratos.crear`. CSV se lee RAW para no romper fechas AR
  dd/mm. Nuevo modelo `ImportacionCartera` + enum `EstadoImportacion`.
- **Avatar del usuario del panel + comprobante en gastos de caja** (`535d15d`) —
  **backend-ready, sin UI de panel todavía**. `PUT /me/avatar` (avatar de la inmobiliaria,
  cualquier rol) y `comprobanteUrl` en el alta de gasto de caja usan columnas que YA existían
  (`Usuario.imageUrl`, `MovimientoCaja.comprobanteUrl` — del `nucleo_completo`, sin migración).
  El front del panel aún no las consume: no hay hook de avatar propio ni campo de adjunto en el
  alta de caja. En el mismo pase se **encontró y arregló** un bug de `POST /caja/movimientos`:
  el `comprobanteUrl` se validaba por tenant pero **no se persistía** en el `movimientoCaja.create`
  (el DELETE sí lo lee para limpiar el Volume y `/pagos/informar` sí lo guardaba) — ahora el create
  lo persiste bien.

### Hardening de uploads — validar tenant en foto/adjunto y boleta (03/07)
- **Fuga de origen cerrada** (`f715055`): `Reclamo.fotoUrl`, `ReclamoEvento.adjuntoUrl` y
  `BoletaServicio.archivoUrl` se guardaban SIN pasar por `urlEsDelTenant`, así que un inquilino
  podía inyectar una imagen externa (`https://…`) en el panel. Fix en `operacion.ts` +
  `inquilino-mundo.ts`. Backend-only, sin migración. Ambos modos andan, demo intacta.

### Consorcios Fase 1 — el tablero se vuelve operable (02/07)
- CRUD real: alta/edición del edificio, UFs con validación de coeficientes (Σ ≤ 100 en
  tx Serializable + `@@unique(consorcioId, identificacion)` como backstop — migración
  `20260702170000`), movimientos del edificio (signo acoplado a categoría; POST con
  `gasto.caja.cargar`, DELETE solo ADMIN; saldo deudor vedado a CARGA) y asambleas.
  `cantUf` derivado en la misma tx.
- Front: dialogs de alta/edición (Sumar consorcio, UF con modalidad monto fijo y saldo
  deudor inicial para migrar edificios, movimiento, asamblea) + acciones por fila.
  Prod-only; la demo intacta.
- Review adversarial (3 lentes) → 9 hallazgos, 9 fixes. Suite E2E local 34/34.
- Fase 2 diseñada (emisión de expensas por período + cobranza por UF + mora reutilizando
  la mora dinámica) — pendiente de decisiones del owner (fondo de reserva, honorarios).

### Landing `/inicio` — upgrades de conversión (27/06)
- **Medir:** PostHog env-gated y de carga diferida (`_landing/analytics.tsx`) — pageview,
  scroll-depth, `signup_start`, `panel_played`, `calc_used`, `whatsapp_click` + autocapture.
  Se enciende seteando `NEXT_PUBLIC_POSTHOG_KEY` en el front. + **A/B del headline**
  (`hero-headline.tsx`): SSR rinde la variante A; con key asigna 50/50 y reporta `hero_variant`.
- **WOW interactivo:** el panel del hero ahora es **jugable** (pausa al hover + botón "Validar"
  real) y **calculadora de ahorro** honesta (`calculadora.tsx`, asunción visible "~12 min/prop").
- **Pro al compartir + mobile:** **OG image 1200×630** (`opengraph-image.tsx`, next/og) +
  `metadataBase`/canonical/twitter/robots + **botón flotante de WhatsApp** + pulido mobile.
- **Prueba social honesta:** banda de confianza con CPI Córdoba / CUCICBA / Edifica
  (`trust-logos.tsx`, recreados en HTML) + escasez real de la beta. **Cero números de adopción
  inventados** (en prod hoy: 4 inmobiliarias / 11 propiedades, verificado en DB).

### Landing de conversión `/inicio` (27/06)
- La home pasó de "linda" a **landing de alta conversión** con el método landing-builder
  (research de competidores AR/US → copy PAS → diseño). Ángulo de mercado virgen: ningún
  competidor argentino muestra la plata en vivo, usa la app del inquilino como argumento ni
  dice "perseguir". Nos quedamos con los tres.
- **Signature move:** panel del producto VIVO en el hero (`_landing/live-panel.tsx`) — una
  state machine que anima el flujo cobranza→comprobante→cobrado→rendición con datos AR creíbles.
  Tipografía propia (Plus Jakarta Sans + Fraunces), bento asimétrico, fade-up on-scroll
  (`reveal.tsx`, IntersectionObserver, `once`), reglas anti-IA aplicadas. Marca violeta.
- **Auto-onboarding:** captura de email en el hero (`_landing/hero-signup.tsx`) que precarga
  `/registro?email=…` (el alta lee el query en un `useEffect`). La landing y el alta se sienten
  una sola cosa.
- **Honestidad:** cero testimonios/métricas fabricados. Prueba real = convenios CPI/CUCICBA/Edifica
  + beta −20%, y una cita textual del relevamiento. Build de prod verde, demo y prod andan.

### Home pública — puerta de entrada de alta (27/06)
- Nueva pantalla de inicio pública `(landing)/inicio` (hero + beneficios + "¿Cómo arrancás?")
  con CTA **"Crear mi inmobiliaria" → `/registro`**. Reusa el estilo de `/precios` y los copys
  del registro (`@llave/ui`, Server Component, estática).
- Ruteo: el visitante **sin sesión que entra a `/`** ahora aterriza en la home (antes lo
  mandaban directo al login). Un deep-link sin sesión sigue yendo a `/login` (suele ser sesión
  vencida). Cambio acotado en `auth-guard.tsx` (redirect por path) + `/inicio` agregada a las
  rutas públicas de `middleware.ts`. El dashboard del logueado y la demo no se tocan.
- El alta en sí (`/registro` + `POST /auth/registro`) ya existía y crea la inmobiliaria (tenant)
  + el admin + el trial en una transacción real; esta entrega solo le construye la **entrada**.

### File storage y uploads REALES (25–26/06)
- Storage real sobre Railway Volume con endpoint `/uploads` (keystone #1).
- Comprobante de pago real del inquilino — cierra el "éxito falso" (P6).
- Foto de reclamo y boleta de servicio reales.
- Documentos del contrato reales: CRUD nuevo + persistencia en Volume (Fase 3).
- El panel ahora abre el comprobante real subido por el inquilino.

### Cron / devengo automático (23–26/06)
- `POST /liquidaciones/devengar`: top-up idempotente de liquidaciones futuras, listo para cron (Ola 1).
- Botón "Generar liquidaciones" en Pagos (devengo manual).
- Keystone #2: devengo automático de liquidaciones por cron.

### Auditoría y arreglos del día (27/06 — actual)
- Caja: cierre del día con comisión a centavos, consistente con la rendición (B3).
- Notificaciones: feed real del inquilino — la campana deja de ser no-op (D4).
- Co-inquilinos: alta de co-inquilinos reales desde el panel (D1).
- Reclamos: la calificación del inquilino llega al panel y recalcula el score del profesional (D3).
- Documentación: PROJECT.md maestro, README detallado y work-agent al día.

### Integridad — guard de contrato ACTIVO (27/06, P10)
- Las escrituras del inquilino sobre el contrato ahora exigen `contrato.estado='ACTIVO'`:
  `/pagos/informar`, `/boletas`, `POST /mis-reclamos`, `/co-inquilinos` + `…/:id/link` + `…/:id/permiso`.
  Sin esto, un ex-inquilino seguía informando pagos y subiendo boletas durante los 15 días
  que vive el JWT después de finalizar el contrato. Helper `exigirContratoActivo` en
  `auth/guards.ts` + test de regresión. La LECTURA no se restringe (un ex-inquilino sigue
  viendo su contrato pasado, liquidaciones y comprobantes). Excluidas a propósito:
  `…/:id/aceptar` (demo-only en prod) y las acciones sobre reclamos EXISTENTES
  (confirmar-resolución, rating), que deben seguir andando si el contrato se finalizó a mitad.

### Observabilidad + robustez + docs (27/06)
- **Auditoría (#2):** el rastro `EventoAuditoria` (antes nadie escribía) ahora se emite en
  9 acciones sensibles del panel — conciliar/rechazar pago, cargar/eliminar gasto de caja,
  rendir, aprobar/rechazar contrato cargado, invitar/remover del equipo. Helper best-effort
  `lib/auditoria.ts` (nunca rompe la acción de negocio). **Vista para consumirlo:**
  `GET /eventos` (capacidad `auditoria.ver` = ADMIN/LECTURA) + página **Auditoría** en el panel.
- **Robustez (#3):** `GET /health` devuelve 503 si la DB está caída (antes 200 siempre);
  auto-logout ante 401 en el panel (paridad con la PWA); vars operativas declaradas en EnvSchema.
- **Docs (#4):** freshness — PIN 4→4-6 dígitos, backdoor demo (DEMO_MODE+NODE_ENV), PORT local,
  CierreCaja (computado, no persistido), cifras viejas de 06-ANALISIS.

### Dinero / plata: consistencia y rendición (21–26/06)
- Gasto multi-propietario se rinde por partes y se conserva (B2).
- Batch A1: cierre de caja, cuenta del propietario y validación de comprobantes.
- Rendición descuenta solo gastos de propiedades con ingreso.
- Cierre de caja diario: `GET /caja/cierre` (cobrado + comisión sobre alquiler), card en el panel + compartir por WhatsApp.

### Propiedades y servicios (26/06)
- Editar propiedad ahora persiste de verdad (sin override silencioso).
- Servicios públicos reales en el panel, en loop con el inquilino.

### Configuración Mercado/país (24/06)
- Mercado/país real y persistente por inmobiliaria, con resto de la config honesto.
- Hotfix review adversarial sobre Mercado (2 P1 + menores) sin regresión.

### QA del panel inmobiliaria (24–25/06)
- Iteraciones iter1–iter12 de QA en vivo: ~100+ fixes acumulados (auth, dinero, crashes, PIN masivo, CBU, fechas/TZ, consent, reclamos/contratos/cupones, ARCA, cross-app, a11y).
- Barrido visual en vivo mobile 375px (overflow horizontales).
- Iter12: cierre de incomplete-fixes (regresión) de iters 9–11.

### QA de la PWA inquilino (23–25/06)
- Merge de 64 fixes de QA demo de la PWA inquilino a main.
- Loop autónomo demo-mode: 18 fixes iniciales + pasadas 1–4 (dinero, forms, cross-app, a11y, path PROD).
- Fixes de hidratación/render: hydration mismatch en hooks demo, gate de montaje, bypass de auth (P1), resiliencia de storage + build GH Pages.
- Iters 3–9: navegación, dinero, fechas, races, a11y, PWA/basePath, microcopy, nombre real en WhatsApp/timeline del reclamo (prod).
- Prompt reusable de loop infinito QA página-por-página (visual + funcional).

### PWA / marca (23/06)
- Manifest con marca My Alquiler (el ícono instalado decía "Llave").
- Botón "Descargar app" persistente para el inquilino.

### Auditoría v4–v5 y Ola 0 (21–23/06)
- Auditoría v5: dashboard, badges, feedback de errores (front) + regresión del flujo de aprobación y bordes (back).
- Auditoría v4: cierre de diferidos (env, sociedad, mock-in-prod, UX).
- Ola 0 — backend: rechazo con FK, P2034, co-invitación de un solo uso, KPI directo, anular atómico.
- Ola 0 — panel: KPI/cache/loading, filtros, validación, badge.
- Ola 0 — inquilino: comprobante sin éxito falso en prod (P6).

### Documentación (21–27/06)
- Handoff completo del proyecto (README + work-agent/).
- Prompt dev senior + análisis Ola 0 y estado de pendientes.
- PROJECT.md maestro + README detallado (27/06).

