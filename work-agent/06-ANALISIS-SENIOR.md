# 06 · Análisis del Dev Senior — dónde estamos / qué falta / qué sería ideal

> 🟢 **UPDATE 2026-06-27 — los 2 keystones de este análisis están HECHOS:**
> - **Keystone #1 (file storage)** → DONE: Railway Volume `/data` + `/uploads`, los 4
>   flujos suben de verdad. Ver `01-ARQUITECTURA.md` §storage / `../PROJECT.MD` §9.
> - **Keystone #2 (cron de devengo)** → DONE: in-process cada 6h + `/internal/cron/devengar`.
> Además, la **auditoría 27/06** cerró 8 desconexiones/bugs (ver `03-AUDITORIAS.md`).
> Lo que queda del roadmap de abajo es lo que necesita **decisión de producto/insumo**
> (screening NOSIS, broker IA, billing, referidos) — ver `04-PENDIENTES.md`. El resto
> del documento se conserva como contexto del análisis original.
>
> ⚠️ **Cifras del cuerpo desactualizadas (eran del 23/06):** hoy son **105 endpoints
> en 10 routers · 72 modelos · 9 suites de test**, y **P6 (el comprobante no subía) ya
> está cerrado** por el Keystone #1. Para el estado/cifras al día la fuente es
> [`../PROJECT.MD`](../PROJECT.MD) + [`../CHANGELOG.md`](../CHANGELOG.md).

---

> **Primera entrega** de `PROMPT-DEV-SENIOR.md`. Informe de alineación: estado real
> (verificado contra el código, no contra los docs viejos), salud/riesgos, el inventario
> de gaps, y un roadmap priorizado en olas. **No se aplicó ningún cambio de código** —
> esto es para alinear el mapa y el plan antes de ejecutar.
>
> Fecha: **2026-06-23** · commit base `081c17e` (+ `2ddcbe9` handoff) · método: mapeo
> multi-agente sobre los 5 subsistemas + verificación file:line de los pendientes y de
> las 4 afirmaciones de mayor apalancamiento (storage, cron, auditoría, tests).

---

## 1. Dónde estamos

**My Alquiler está lanzado y endurecido.** El núcleo —el circuito de plata E2E (alta →
propietario → propiedad → contrato → inquilino + co-inquilino → 1er pago → 2º pago →
rendición)— **funciona contra el API real**, con multi-tenant, máquinas de estado, locks
atómicos, auth OTP/PIN/JWT y constraints únicos, todo auditado en 6 pasadas (~50 bugs
reales arreglados). El backend expone **87 endpoints** en 7 routers sobre **72 modelos**
Prisma (~2.2k líneas de schema).

La forma del producto hoy: **el "qué" está construido; faltan las "tuberías" (storage,
cron, IA real) y cerrar el long-tail gateado.** Muchas pantallas en prod **leen del API
real**; lo que suele estar gateado es el **alta/mutación**, ciertos **campos derivados**, o
features que muestran **"Próximamente"** (28 archivos con gate en los dos fronts).

### Estado por subsistema

| Subsistema | Estado | Nota |
|---|---|---|
| **API** `apps/api` | 🟢 Sólido | 87 endpoints, money model completo, locks atómicos, error handler global. Le faltan tuberías (storage, cron, auditoría) y algunos derivados. |
| **Panel** `apps/inmobiliaria` | 🟢 Core real | Cartera/plata/reclamos/anuncios/config cableados al API. Screening y long-tail de config gateados. Tabs derivados vacíos. |
| **PWA** `apps/inquilino` | 🟡 Core real, periferia demo | Home/checkout/reclamos/contrato/co-inquilinos reales. Broker IA, calendario, documentos, profesionales, garante y portal-profesional gateados. Uploads no llegan al backend. |
| **Packages** `@llave/*` | 🟢 Ok | `shared` (permisos+auth+Zod), `ui` (shadcn, dark-mode off a propósito), `config`. |
| **Deploy/Infra** | 🟡 Manual | Railway por Dockerfile, **deploy 100% manual** (push no deploya). Sin CI de tests. SMTP por nodemailer. |

### Real vs demo en producción (verificado contra el código)

> Corrige al `REPORTE-PM-PRODUCTO.md`, que marca como "mock" cosas que ya leen real.

**Panel — REAL en prod:** dashboard · propiedades (+alta) · propietarios · contratos
(+alta wizard) · pagos (tabla + cola "a resolver" + conciliar/rechazar) · caja
(CRUD) · aprobaciones · renovaciones · reclamos (+gestión + ¿quién paga?) · anuncios (+acuses
reales) · consorcios y profesionales (lectura) · configuración (empresa/cobranza/PIN/
equipo/sociedades).
**Panel — GATEADO/DEMO en prod:** screening (popup "beta", no ejecuta) · recordar a
morosos ("Próximamente") · conciliación por PDF · paneles Cargos/Morosos/Alertas · alta de
consorcio (stub) · tabs plan/facturas/convenios/referidos/auditoría · **controles de demo
visibles en la tab Plan** (bug).
**Panel — derivados vacíos en prod:** tabs Pagos/Eventos/Comunicaciones del **detalle de
contrato** · tab Reclamos del **detalle de propiedad** · `totalCobradoMes/totalRecibirMes`
del **detalle de propietario** · `cantTrabajos/verificado` de profesionales.

**PWA — REAL en prod:** home · login OTP · checkout (metadatos del pago) · comprobantes ·
reclamos (+timeline+rating) · servicios/boletas (metadatos) · contrato · co-inquilinos
(+invitar+aceptar) · certificado · `/cuenta` (lectura) · ayuda.
**PWA — GATEADO/solo-demo:** broker IA · calendario · documentos · profesionales ·
renovación · edición de perfil · `/verificar/[hash]` · portal profesional `/p/[token]` ·
vista garante `/garantes/[token]`.
**PWA — el archivo nunca sube:** comprobante de pago, boleta de servicio, foto de reclamo
(sólo viajan los metadatos).

---

## 2. Salud y riesgos

### 2.1 Bugs abiertos (backlog inmediato — de `04-PENDIENTES.md`, revalidados hoy)

**Críticos verificados file:line:**

| ID | Sev | Dónde | Síntoma |
|---|---|---|---|
| **P1** | ALTA | `plata.ts:582-588` | Rechazar aprobación `CONTRATO_CARGADO` tira **P2003** si el inquilino del borrador tiene `CodigoOtp`/`Certificado`/`AnuncioAcuse`/`Documento` → la aprobación queda **bloqueada para siempre** (regresión del fix v5). |
| **P5** | ALTA | `hooks.ts:249,258` | `aprobar/rechazar` invalida `['contratos']` pero no `['contrato', id]` → badge "pendiente" stale en el detalle. |
| **P6** | ALTA | `checkout/page-client.tsx:934-973` | El **comprobante adjunto nunca se sube** (no hay endpoint) → **éxito falso**. |
| **P7** | ALTA | `auth.ts:275-307` | **Link de invitación de co-inquilino reusable** (no corta con 409 si ya fue aceptado). |
| **P8** | ALTA | `hooks.ts:645-663,918-927` | KPI "cobrado por propietario" **inflado** con contratos `PROPIETARIO_DIRECTO` (no filtra `modoCobranza`). |

Más P2 (BORRADOR-rechazado infla KPIs), P3 (`useDashboard.cargando` incompleto), P4
(`P2034` sin mapear), P9 (filtro `?propietario=` usa mock en API), P10 (`/pagos/informar` y
`/boletas` aceptan sobre contrato FINALIZADO), P11–P13 (UX/robustez), P14 (saldo en
checkout multi-parcial). Todos triados en `04-PENDIENTES.md`.

> ⚠️ **Disciplina** (`03-AUDITORIAS.md`): abrir el archivo, trazar el flujo, confirmar el
> bug **antes** de tocar (~50% históricos son falsos positivos). Typecheck+build entre
> tandas. P1 primero: verificar las FKs reales de `Inquilino` en el schema.

### 2.2 Riesgos de producción (verificados)

- **🔴 Sin file storage** (cero S3/R2/multipart en la API): comprobante de pago, boleta y
  foto de reclamo se eligen en el browser y **nunca llegan al backend**. Hoy el flujo de
  cobranza depende de que el inquilino mande el comprobante **por fuera** (WhatsApp).
- **🔴 Sin cron/scheduler:** `generarLiquidacionesContrato` se llama **sólo** al activar
  (`core.ts:493`) o aprobar (`plata.ts:580`) un contrato, y devenga hasta "el mes que
  viene". **Del mes 3 en adelante no hay liquidaciones** sin intervención manual — y **ni
  siquiera existe una acción de panel** para re-disparar el devengo. Mismo problema con el
  **ajuste de índice** (IPC/ICL/UVA): `proximoAjuste` se persiste pero **nunca se aplica**.
- **🟠 Auditoría vacía:** `EventoAuditoria` (18 tipos) **nunca se escribe** (cero
  `eventoAuditoria.create` en la API) → no hay rastro de quién concilió/rindió/aprobó.
- **🟠 Tests peligrosos:** las 8 suites de `apps/api/test/` corren `seedBase(prisma)` en
  `beforeAll` contra `DATABASE_URL` (una DB de Railway), no contra una DB efímera. Un
  `pnpm test` despistado puede pisar datos. **Y no corren en CI** (el workflow sólo buildea
  la demo de GH Pages).
- **🟠 Deploy 100% manual:** pushear a `main` no deploya; los 3 servicios se suben a mano
  con `railway up`. Riesgo de "arreglé y me olvidé de deployar".
- **🟡 Seguridad del token:** JWT en `localStorage` (XSS), 15 días fijos, sin refresh ni
  revocación. Rate-limit global por IP (no por tenant). `plan/equipo/sociedades` sin PIN.
- **🟡 Escala:** ningún listado pagina → con carteras grandes (>1k filas/tenant) habrá
  timeouts.
- **🟡 Pre-primer-cliente:** falta wipe de los datos de prueba (Tapia/Martín) y confirmar
  que el **SMTP** de prod está vivo (sin email de OTP, ningún inquilino entra).

### 2.3 Deuda de calidad

Cero tests E2E (Playwright) sobre los dos fronts pese a que casi toda pantalla ramifica
demo/prod. `coerceTipo()` distorsiona tipos de propiedad en silencio (PH→DEPARTAMENTO,
COCHERA→LOCAL…). Lógica crítica de métricas del dashboard (`comisionEfectiva`,
`cobradoByOwner`) sin tests. `gastos-rendicion.ts` es código muerto (el loop caja→rendición
no cierra). `/admin/objetivos` (página interna) accesible por cualquier ADMIN que sepa la URL.

---

## 3. Qué falta / qué sería ideal (inventario clasificado)

Leyenda: **[BUG]** corrección · **[FEAT]** feature incompleta · **[INFRA]** plataforma ·
**[GTM]** producto/adopción · **[DEC]** necesita decisión del dueño antes de construir.

### Infraestructura (desatasca el resto)
- **[INFRA]** File storage real (R2/S3/Spaces) + endpoint multipart/presigned. Desbloquea
  P6, boletas, fotos de reclamo, documentos. **Keystone #1.**
- **[INFRA][DEC]** Cron/worker: devengo mensual (mes 3+), aplicación del ajuste por índice,
  recordatorios de vencimiento, expiración de OTPs, recálculo de punitorios/VENCIDO. **Keystone #2.**
- **[INFRA]** CI: correr typecheck+tests en CI con DB efímera (Postgres de servicio en el
  runner) + deploy automatizado a Railway on-merge.
- **[INFRA]** Observabilidad: Sentry/APM + **escribir `EventoAuditoria`** en conciliar/
  rendir/aprobar/finalizar (la tabla y los tipos ya existen).
- **[INFRA]** Seguridad: token httpOnly+refresh+revocación; rate-limit por tenant; PIN en
  acciones de plan/equipo/sociedades; implementar `pago.revertir` (capacidad existe, endpoint no).
- **[INFRA]** Paginación en todos los listados.

### Producto — panel
- **[FEAT][DEC]** **Screening real** (BCRA/Nosis/RENAPER) — hoy 100% simulado (FNV-1a sobre
  el CUIT). **El mayor diferenciador del producto.**
- **[FEAT]** Poblar derivados: tabs Pagos/Eventos/Comunicaciones (detalle contrato), tab
  Reclamos (detalle propiedad), métricas cobrado/recibir (detalle propietario), trabajos/
  verificado de profesionales.
- **[FEAT]** Recordatorio a morosos (WhatsApp/email), conciliación por PDF, **editor de
  contrato** (hoy "en construcción"), **alta de consorcio** (stub muerto).
- **[BUG]** Conectar **caja ↔ rendición** (`gastos-rendicion.ts` muerto) y **ocultar los
  controles de demo** de la tab Plan en prod.
- **[FEAT]** Long-tail de config: plan/facturación, convenios, referidos, auditoría persistida.

### Producto — PWA inquilino
- **[FEAT][DEC]** **Broker IA** (asistente de contrato con contexto de cláusulas y deuda) —
  la pendiente de más impacto del lado inquilino. *(Usar el modelo Claude más capaz.)*
- **[FEAT]** Upload real (depende de storage) + OCR/LLM real del comprobante (hoy PRNG).
- **[FEAT]** Web Push (el SW se registra pero no hay suscripción ni envío).
- **[FEAT]** Verificación pública del certificado por hash; portal del profesional
  `/p/[token]`; vista garante `/garantes/[token]` (hoy los 3 son demo-only).
- **[FEAT]** Calendario, documentos, profesionales, renovación, edición de perfil.
- **[BUG]** Editar el email en `/cuenta/editar` no actualiza la credencial OTP → el
  inquilino queda **sin poder entrar**. Y el **certificado** (feature estrella) **no está
  en la bottom-nav** mobile.

### Anuncios (visión de 3 pilares — `VISION-ANUNCIOS.md`)
- **[FEAT]** Cerrar el loop: métricas Entregado/Leído/Confirmado reales + "recordar a los
  que faltan" con datos reales.
- **[FEAT]** Anuncios accionables (CTA→job): "Actualizar forma de pago" (deep-link al
  checkout), "Pagar ahora", "Confirmar asistencia".
- **[FEAT]** Plantillas + borrador IA + envíos programados + targeting dinámico.

### Producto / GTM / adopción
- **[GTM][DEC]** Mensaje de blanqueo/privacidad: ARCA **opt-in**, registro como protección
  (barrera de adopción del mercado informal).
- **[GTM][DEC]** Modo simple vs completo por tamaño de cartera; **pricing por volumen**.
- **[GTM]** Prueba social: testimoniales reales, demo visual (video 60-90s), instrumentación
  de CTAs de la landing.
- **[DEC]** Consentimiento de screening (Ley 25.326): revisar el texto legal.

---

## 4. Roadmap priorizado (en olas)

> Criterio: **valor × esfuerzo × riesgo**. Cada ola asume la anterior cerrada.

### 🌊 Ola 0 — Estabilizar (días) · *empezar ya*
Aplicar `04-PENDIENTES.md`: **P1** primero (verificar FKs de `Inquilino`), luego P5/P3/P4/P2
(regresiones v5, rápidas), P7/P8/P10 (integridad backend), **P6** (decidir: aviso "mandá el
comprobante por WhatsApp" como parche corto, o esperar storage), y P9/P11–P14 (UX). Re-correr
`AUDITORIA-PROFUNDA-PROMPT.md` al cerrar para cazar regresiones. **Bajo riesgo, alto valor.**

### 🌊 Ola 1 — Desbloquear (1–2 semanas) · *las dos tuberías que destraban medio backlog*
1. **File storage** (R2/Spaces) + endpoint multipart/presigned → cierra P6, boletas, fotos,
   documentos de una. *(Pendiente — bloquea en credenciales del bucket.)*
2. **Cron/worker** → devengo mensual (mes 3+) + aplicación del ajuste de índice +
   recordatorios. Sin esto el producto se rompe solo pasado el 2º mes de cualquier contrato.
   - ✅ **Devengo — 1er increment SHIPPED (2026-06-23):** `POST /liquidaciones/devengar`
     (idempotente, ADMIN/OPERADOR) + botón "Generar liquidaciones" en Pagos. **Listo para
     cron**: un Railway cron-job pega al mismo endpoint sin tocar código (falta credencial
     de servicio). Pendiente: wiring del cron + aplicación del ajuste de índice (IPC/ICL/UVA,
     necesita fuente de datos del índice).

### 🌊 Ola 2 — Diferenciar (semanas) · *lo que vende y retiene*
- **Screening real** (proveedor a definir) — el "wow".
- **Broker IA** del inquilino (LLM con contexto del contrato).
- **Loop de anuncios** (Pilar 1 + 2).
- Poblar los **derivados** del panel (tabs/métricas) — barato y mejora la percepción de "app completa".

### 🌊 Ola 3 — Escalar / endurecer (continuo)
CI/CD + DB de test efímera · observabilidad + escribir auditoría · paginación · seguridad
del token · long-tail de config · prueba social/instrumentación de la landing.

### Necesita decisión del dueño (bloquea construcción)
- **Storage**: ¿R2, S3 o DigitalOcean Spaces? *(ya usás Spaces en otro proyecto)*.
- **Cron**: ¿Railway cron-job, un worker propio, o acción manual del panel como primer paso?
- **Screening**: proveedor + costo por consulta + contrato.
- **Broker IA**: presupuesto de tokens / alcance.
- **Pricing por volumen** y **mensaje de blanqueo/ARCA** (con criterio legal).

---

## 5. Preguntas abiertas (no las adivino)

1. **Email de OTP en prod:** el mailer es **SMTP/nodemailer** (no Resend). ¿El SMTP de
   producción (Hostinger `myalquiler@xnod.tech`) está estable y monitoreado? Sin él, ningún
   inquilino entra. ¿Migrar a un proveedor transaccional con métricas de entrega?
2. **Wipe de datos de prueba:** ¿cuándo se limpia el tenant Tapia/Martín de prod? ¿Antes del
   primer cliente real o ya?
3. **Escala esperada:** ¿cuántas inmobiliarias/propiedades se proyectan a 6 meses? Define la
   urgencia de paginación y del rate-limit por tenant.
4. **Prioridad estratégica:** ¿el foco inmediato es **vender** (screening + landing + prueba
   social) o **operar sin fricción** (storage + cron + recordatorios)? Mi recomendación:
   **Ola 0 + Ola 1 sí o sí** (sin las tuberías, el producto no aguanta el uso real), y en
   paralelo arrancar el **screening real** como punta de lanza comercial.
5. **Broker IA / screening:** ¿hay presupuesto asignado para las integraciones externas
   (LLM, BCRA/Nosis)? Determina si la Ola 2 es de "semanas" o queda en backlog.

---

*Siguiente paso sugerido: confirmás prioridades y decisiones de arriba, y arranco la **Ola 0**
(aplicar pendientes con la disciplina de `03-AUDITORIAS.md`) sin tocar nada irreversible sin
tu OK.*
