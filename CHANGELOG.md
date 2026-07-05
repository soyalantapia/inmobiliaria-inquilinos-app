# Changelog — My Alquiler

> Historial de cambios. Formato inspirado en Keep a Changelog. Las fechas son las de
> los commits en `main`. Para el detalle técnico de cada hito ver [`PROJECT.MD`](./PROJECT.MD)
> y [`work-agent/03-AUDITORIAS.md`](./work-agent/03-AUDITORIAS.md).

---

## [Sin versionar] — estado actual

Plataforma SaaS multi-tenant para inmobiliarias (panel) e inquilinos (PWA). Estado de cambios desde el handoff inicial hasta hoy.

### Auditoría profunda del ciclo de plata + plan de 12 pasos (05/07)
Segunda auditoría multi-agente (36 agentes) del ciclo COMPLETO "desde que hay contrato":
alta → devengo → pago (parcial, y con DOS co-inquilinos) → validación → conciliación →
rendición. 21 hallazgos confirmados (2 CRÍTICOS). Se implementó el plan completo de 12
pasos sobre la rama `fix/pagos-visibilidad-inquilino`. Migración nueva
`20260705120000_pago_autor_informe` (2 columnas nullable en `pagos`).
- **CRÍTICO — validar ya no sobre-cobra.** `POST /pagos/:id/validar` era el único de los
  tres caminos que crean cobros CONCILIADO SIN lock ni re-tope. Con el cobro mixto de dos
  co-inquilinos (A informa + la inmo registra el efectivo de B + valida a A) la cuota
  quedaba con más plata que su total, se sobre-rendía al dueño y se inflaba la comisión.
  Ahora toma `SELECT … FOR UPDATE` + recomputa el saldo y rechaza el excedente (espejo de
  `/pagos/manual`).
- **CRÍTICO — rendición reversible.** Anular una rendición daba 500 SIEMPRE (FK RESTRICT
  sobre `alquileres_rendidos` sin borrar los hijos) → la única corrección hacia el dueño
  estaba rota. Se borran los `AlquilerRendido` antes; y `/pagos/:id/anular` bloquea con 409
  un pago cuya liquidación ya fue rendida (anulá primero la rendición).
- **Concurrencia de rendición:** todo el cálculo va dentro de un `pg_advisory_xact_lock`
  por dueño+período (dos rendiciones simultáneas ya no doble-rinden), y el `updateMany` de
  gastos ahora ABORTA de verdad si otra rendición tomó el gasto (el comentario lo prometía;
  el código no lo hacía).
- **Comisión solo sobre alquiler (LOCKED):** la porción de alquiler se capea a la base
  (`min(cobrado, montoTotal)`) en la rendición y en el cierre de caja → la mora cobrada ya
  no infla la comisión.
- **Pago parcial:** tolerancia de centavos en `/pagos/informar` (pagar EXACTO el saldo ya
  no da "supera el saldo" ni nace PARCIAL por milésimas); el checkout refresca el saldo al
  entrar y usa el `tipo` real del POST (aviso "la mora subió mientras pagabas" en vez de un
  "al día" falso).
- **Fecha de transferencia acotada** (informar + manual): no futura, no anterior al inicio
  del contrato (evita backdatear para esquivar la mora / falsear el certificado).
- **Co-inquilinos:** el Pago guarda el autor del informe (`informadoPor*`); `/mis-liquidaciones`
  expone `autor: 'vos'|'otro'|null` y las notificaciones pasan a copy neutral a nivel
  contrato ("Se confirmó el pago de …") — a B ya no le llega "TU pago" por un pago de A.
- **Devengo:** la primera liquidación ya no nace VENCIDA con mora pre-inicio cuando el
  contrato arranca a mitad de mes; el comprobante huérfano se libera si el informe falla.
- **Certificado:** un pago ANULADO por la inmo ya no penaliza el nivel de buen pagador.
- **Ajuste por índice (feature nueva):** el alta setea `proximoAjuste`; nuevo
  `PATCH /contratos/:id/monto` (permiso + PIN) sube el monto y RE-DEVENGA las liquidaciones
  futuras sin pagos (registra `AJUSTE_APLICADO`); el panel muestra "Próximo ajuste" y un
  botón "Ajustar monto". (El coeficiente ICL/IPC lo entra el operador: el sistema no tiene
  la serie del índice.)
- **Tests:** suite completa verde en schema fresco + tests nuevos (validar over-cobro,
  anular rendición con AlquilerRendido, anular pago rendido, fechas, primer devengo,
  `sumarMesesUTC`, `recomputarLiquidacionesFuturas`, PATCH de monto).

### Flujo de pagos completo: visibilidad del inquilino + cobro manual + circuito directo (05/07)
Auditoría multi-agente del flujo de pagos (23 hallazgos confirmados, 4 CRÍTICOS) a raíz
del reclamo del owner "no veo que funcione al 100% el pago parcial". Causa raíz: el
backend nunca exponía al inquilino sus propios pagos → en prod la PWA era CIEGA
(informabas un pago y la app te seguía pidiendo pagar TODO, empujando a un 409 y a
transferir dos veces; un rechazo con motivo jamás se mostraba; el comprobante enviado no
se podía volver a ver). Rama `fix/pagos-visibilidad-inquilino`.
- **API:** `/mis-liquidaciones` expone `pagos[]` por liq (estado + motivo de rechazo +
  comprobante; los anulados llegan con `anulado:true` y observación neutra — el motivo
  interno del admin no se filtra). `GET /pagos` decora la liq con saldo REAL
  (base+mora−conciliados, mora congelada en `fechaPago` si PAGADO) + `modoCobranza` +
  nombre del dueño directo. `GET /liquidaciones` idem con mora (el diálogo de cobro
  manual prefillea el saldo exigible de verdad). **Nuevo `POST /pagos/manual`** (PIN):
  efectivo en oficina / "el dueño confirmó que cobró" — antes una liq de contrato
  directo sin informe del inquilino quedaba VENCIDA acumulando mora PARA SIEMPRE; con
  lock `FOR UPDATE` + re-check en tx (sin eso, doble submit duplicaba el cobro).
  `POST /pagos/:id/anular` recomputa con umbral base+MORA (espejo de validar; antes
  anular el pago de la mora dejaba PAGADO con mora impaga) y libera el
  `CreditoDetectado` del extracto (antes quedaba huérfano, irrecuperable). Conciliación
  bancaria: esquema de mora EFECTIVO (no legacy), tope de saldo, rechaza liqs PAGADAS y
  contratos directos, y lock de liq en tx. `/mi-contrato`: contrato directo SIN cuenta
  del dueño ya NO cae en silencio a la cuenta de la inmobiliaria (devuelve null → la PWA
  pide los datos); el alta de contrato directo exige la cuenta del dueño cargada.
- **PWA inquilino:** las cards "Pendiente de validación" / "Tu pago fue rechazado (con
  motivo) + Volver a subir" / "Pago confirmado" y la lista "Pagos informados (N)"
  FUNCIONAN en prod (hidratan de `liq.pagos`; decisión más reciente por `decididoAt`;
  el INFORMADO vivo tiene precedencia; gate anti-zombie si la liq ya está PAGADA).
  "Ver comprobante enviado" abre el archivo real (`?token=`). Checkout: GUARD temprano
  "Este pago ya fue informado" ANTES de mostrar el CBU (evita la doble transferencia
  real); tras un parcial ya no ofrece "Pagar el saldo" (el backend admite un solo
  INFORMADO): explica que va a poder informarlo al validarse. Banner del home: variante
  ámbar "Comprobante en revisión" (sin CTA de pagar). Franja "Cuenta del propietario" en
  cobranza directa. Recibos: badges de estado por pago.
- **Panel:** bandeja con saldo REAL por fila ("si lo validás queda $X" — antes mocks:
  deuda fantasma), badge "Cobranza directa al propietario · <dueño>" con datos reales,
  estado de ERROR con Reintentar (antes un 500 se disfrazaba de "no hay comprobantes"),
  KPI Cobrado incluye parciales conciliados (Cobrado+Pendiente cierran), "Cargar pago"
  cableado a `POST /pagos/manual` (contratos directos incluidos, con leyenda), PDF
  morosos usa `cobrables` (sin directos), PDF Cobranzas del mes desde pagos CONCILIADO
  reales (método/fecha/monto reales, por FECHA DE COBRO con período como columna, excluye
  directos, aborta con toast si la query falló).
- **Tests:** suite verde en schema FRESCO (antes solo pasaba con estado residual de la
  DB compartida): fix seed (`rendicion.upsert` por id — el unique compuesto ya no existe
  y rompía TODA la suite), pagos CONCILIADO del seed para las liqs PAGADAS (la rendición
  incremental rinde desde pagos), curas de estado (cnt_001/liq_003/pag_002), expectativas
  de la rendición de Silvana alineadas a "comisión SOLO sobre alquiler" (LOCKED), test de
  anuncios alineado al hardening `comunicaciones.enviar`, y suite nueva de
  `POST /pagos/manual` (6 casos) + shape de `GET /pagos` y `pagos[]`.
- **Pendientes anotados (decisiones de producto):** a quién pertenece la mora cobrada en
  cierre/rendición (hoy se prorratea como alquiler+expensas — MEDIO), PATCH del modo de
  cobranza post-alta (hoy el contrato queda atrapado en el modo con el que nació), y
  permitir varios INFORMADOs por liq (la opción A del checkout).

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

