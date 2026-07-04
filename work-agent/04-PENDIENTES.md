# Pendientes — roadmap

> Última actualización: **2026-07-04** (HEAD `535d15d`, árbol limpio, demo intacta /
> ambos modos andan). **No hay bugs abiertos conocidos.** El core está en prod y
> endurecido; las campañas de auditoría convergieron. Lo que queda necesita **decisión
> de producto o insumo del owner** (no es bug), salvo un cableado de front chico.
> Historial de lo ya hecho al final.

---

## A. Necesita decisión / insumo del owner (no son bugs)

### 1. Forma de pago del plan SaaS (billing) — [producto]
Cómo le cobra el SaaS a la inmobiliaria. Existen los modelos
`Suscripcion`/`Factura`/`Cupon`/`TramoPlan` pero falta definir el flujo (medio de
pago, ciclo, prueba, mora). El panel tiene una pantalla de configuración de "forma de
pago" que hoy escribe a localStorage → **fake en prod**, a la espera de la decisión.
**Bloqueo:** modelo de billing sin definir + posible integración MercadoPago (`MP_*`).

### 2. Programa de referidos — [comercial]
Modelo `Referido` existe; faltan las reglas (qué premia, a quién, tope, validez). El
panel tiene un manager de referidos en localStorage → **fake en prod** hasta tener las
reglas. **Bloqueo:** decisión comercial.

### 3. Screening real — [insumo: proveedor]
Hoy el screening es demo. Integrar **NOSIS** (vars `NOSIS_API_KEY`/`NOSIS_BASE_URL` en
`.env.example`). Endpoints `GET /screenings` + `POST /screening` ya existen como cáscara.

### 4. Broker IA / OCR de comprobantes — [opcional / futuro]
Lectura por IA del comprobante (extraer monto/fecha/operación) para acelerar la
validación. Vars `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`. El panel de "Por validar" ya
muestra el comprobante real (la base está); falta el paso de IA. **No es bloqueante:** la
conciliación bancaria ya funciona **sin IA** (el CSV/Excel del banco la resuelve, ver
sección C). IA/OCR sería un plus para tipear menos, no un requisito.

### 5. WhatsApp real — [insumo: cuenta WhatsApp Business]
Recordatorio automático a morosos + envío del link de invitación de co-inquilino por
WhatsApp (hoy el flujo asume que el link se manda a mano). Vars `WHATSAPP_*`.

### 6. Avatar del usuario del panel + comprobante en gasto de caja — [front]
El **backend ya existe** (tanda 04/07, ver sección C): `PUT /me/avatar` para la foto del
usuario del panel (la inmo) y `MovimientoCaja.comprobanteUrl` para adjuntar el
comprobante al gasto de caja. Falta **cablear el front del panel**: hoy el panel solo
muestra iniciales (no sube foto propia) y el alta de gasto de caja no tiene UI para
adjuntar comprobante (el front lee `comprobanteUrl` para mostrarlo pero no lo sube).
Chico, no bloqueado — es sólo cablear la UI contra endpoints que ya están vivos.
_(Nota técnica: el `POST /caja/movimientos` ya persiste el `comprobanteUrl` en el `create`
—se arregló un bug 04/07 donde antes se validaba pero no se guardaba—; sólo falta la UI que lo suba.)_

---

## B. Long-tail demo-gated A PROPÓSITO (no son bugs)

Pantallas/features secundarias que muestran "Próximamente" o mock en prod — **no rompen
el core ni la plata**: negociación iterativa de renovación, reset de PIN olvidado,
objetivos/métricas internas (dashboards de la propia inmo), y algunas vistas de
consorcios. Y los **falsos positivos conocidos** de `03-AUDITORIAS.md` (NO re-arreglar).

---

## C. Ya hecho (para no re-trabajarlo)

- **Core en prod, cableado al API real**: contratos, liquidaciones, pagos,
  rendiciones, caja, reclamos, equipo, sociedades, co-inquilinos, servicios, documentos.
- **Ola 0 (23/06)**: P1–P13 (regresiones de v5 + integridad backend) aplicados.
- **Keystones (26/06)**: file storage real (Volume + `/uploads`, 4 flujos) + cron de
  devengo (in-process + `/internal/cron/devengar`).
- **Servicios públicos** del panel persistidos + **edición de propiedad** real
  (`PUT /propiedades/:id`).
- **Auditoría 27/06 — 8 hallazgos, los 8 fixeados/deployados/testeados** (E2E con
  cleanup; B2 con test de regresión). Ver `03-AUDITORIAS.md`:
  - D1 co-inquilino del panel REAL · D2 cuentaCobranza en detalle de contrato ·
    D3 rating al panel + recalc profesional · D4 feed `/mis-notificaciones` real.
  - B1 cierre de caja excluye PROPIETARIO_DIRECTO · B2 gasto multi-dueño conservado ·
    B3 redondeo a centavos consistente · B4 validación de prefijo de tenant en URLs.
- **Tanda 04/07 — backlog de "campos en schema SIN feature", cerrado E2E** (6 commits,
  todos en prod vía `railway up` los 3 servicios + en `origin/main` `15f641c..535d15d`;
  migración `20260703110000_avatar_credito_importacion` aplicada en prod; smoke test
  OK; demo intacta / ambos modos andan):
  - **Conciliación bancaria REAL, sin IA** (`1404004`): validador de resumen bancario
    que parsea el **CSV/Excel del banco** (dep `xlsx`, parseo determinístico, cero
    OCR/IA). Matching por monto/nombre/saldo con confianza ALTA/MEDIA/BAJA (monto±$50 +
    nombre → ALTA; monto solo → MEDIA; ±5% del saldo + nombre → MEDIA; ±5% solo → BAJA),
    FIFO por vencimiento más viejo. Conciliar **con PIN** crea un `Pago` directo
    **CONCILIADO** (TRANSFERENCIA, no pasa por INFORMADO). Reemplaza el ítem que estaba
    pendiente en la sección A. Decisión de producto del owner: extracto, no OCR.
  - **Migración masiva de cartera REAL** (`b153ebe`): el owner sube SU planilla
    (Excel/CSV) y **mapea qué columna es qué** (sinónimos auto-sugeridos, sin formato
    fijo). 3 pasos: subir+parsear → mapear+validar fila por fila (OK/ADVERTENCIA/
    ERROR/DUPLICADO) → confirmar (crea propiedad+propietario+inquilino+contrato ACTIVO
    con liquidaciones). Sale del long-tail demo-gated de la sección B.
  - **Avatar del inquilino + documentos del inquilino** (`8940981`): foto de perfil del
    inquilino + slots reales de DNI/recibos/garante que sube desde su app (migración de
    esta tanda agrega `inquilinos.imageUrl` + `CreditoDetectado` + `ImportacionCartera`).
  - **Flujo profesional por link mágico + fotos antes/después** (`f05b24d`): el
    profesional entra por un token opaco (sin cuenta/password), confirma → en camino →
    listo, y sube fotos a `/uploads`. Máquina de estados idempotente; revocación real al
    reasignar.
  - **Harden tenant en uploads** (`f715055`): validar tenant en foto/adjunto de reclamo
    y archivo de boleta (cerraba una fuga: un inquilino podía inyectar una imagen
    externa `https://`). Backend-only, sin migración.
  - **Avatar del usuario del panel + comprobante en gasto de caja — BACKEND** (`535d15d`):
    `PUT /me/avatar` y `MovimientoCaja.comprobanteUrl` (usan columnas que ya existían →
    sin migración). ⚠️ **Falta la UI del panel** que los consuma → queda como pendiente
    chico de front (sección A, ítem 6).

---

## Cómo encarar una feature pendiente

1. Confirmá la **decisión de producto** con el owner (las de la sección A la requieren).
2. Leé `01-ARQUITECTURA.md` (patrones) + `05-DECISIONES.md` (reglas LOCKED).
3. Cableá backend → front respetando `apiEnabled` (demo debe seguir andando).
4. `tsc`+`build` 0 → commit → deploy (`02-DEPLOY.md`) → **E2E contra prod con cleanup**.
5. Actualizá `PROJECT.MD` + el `work-agent/` afín en el mismo PR.
