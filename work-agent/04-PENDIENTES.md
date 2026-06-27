# Pendientes — roadmap

> Última actualización: **2026-06-27**. **No hay bugs abiertos conocidos.** El core
> está en prod y endurecido; las campañas de auditoría convergieron. Lo que queda
> necesita **decisión de producto o insumo del owner** (no es bug). Historial de lo
> ya hecho al final.

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

### 4. Broker IA / OCR de comprobantes — [insumo: presupuesto]
Lectura por IA del comprobante (extraer monto/fecha/operación) para acelerar la
validación. Vars `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`. El panel de "Por validar" ya
muestra el comprobante real (la base está); falta el paso de IA.

### 5. WhatsApp real — [insumo: cuenta WhatsApp Business]
Recordatorio automático a morosos + envío del link de invitación de co-inquilino por
WhatsApp (hoy el flujo asume que el link se manda a mano). Vars `WHATSAPP_*`.

### 6. Conciliación bancaria — [producto]
Modelos `DatosBancarios`/`ResumenBancario`/`CreditoDetectado` existen para auto-detectar
acreditaciones y pre-conciliar pagos. Sin flujo definido.

---

## B. Long-tail demo-gated A PROPÓSITO (no son bugs)

Pantallas/features secundarias que muestran "Próximamente" o mock en prod — **no rompen
el core ni la plata**: negociación iterativa de renovación, migración masiva de cartera,
reset de PIN olvidado, objetivos/métricas internas (dashboards de la propia inmo), y
algunas vistas de consorcios. Y los **falsos positivos conocidos** de `03-AUDITORIAS.md`
(NO re-arreglar).

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

---

## Cómo encarar una feature pendiente

1. Confirmá la **decisión de producto** con el owner (las de la sección A la requieren).
2. Leé `01-ARQUITECTURA.md` (patrones) + `05-DECISIONES.md` (reglas LOCKED).
3. Cableá backend → front respetando `apiEnabled` (demo debe seguir andando).
4. `tsc`+`build` 0 → commit → deploy (`02-DEPLOY.md`) → **E2E contra prod con cleanup**.
5. Actualizá `PROJECT.MD` + el `work-agent/` afín en el mismo PR.
