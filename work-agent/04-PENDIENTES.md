# Pendientes — punto de partida del próximo chat

> **~15 hallazgos confirmados de la 3ra pasada de auditoría, SIN aplicar todavía.**
> La síntesis del workflow se cortó por límite de sesión, pero los confirmados
> crudos (≥2/3 verificadores) están capturados acá, deduplicados y triados.
> Origen: run `wte2tzjue` (3ra regresión, 2026-06-21).
>
> ⚠️ **Disciplina obligatoria** (ver `03-AUDITORIAS.md`): antes de aplicar cada uno,
> abrir el archivo, **trazar el flujo real y confirmar** que el bug existe y que el
> fix es correcto. Los fix specs de abajo vienen del agente de síntesis y a veces
> sub-analizan. Typecheck + build entre tandas. Deploy + smoke (ver `02-DEPLOY.md`).

---

## A. REGRESIONES de los fixes v5 (arrancar por acá)

### P1 — [ALTA] `rechazar` aprobación puede fallar con P2003 (FK RESTRICT)
`apps/api/src/routes/plata.ts` (rama `rechazar`, ~líneas 582-589)

El fix v5 agregó `tx.inquilino.deleteMany({ where: { contratoId: apr.entidadId } })`
al rechazar una aprobación CONTRATO_CARGADO (para liberar el email). **Pero** si el
inquilino del BORRADOR tiene hijos con FK obligatoria sin CASCADE (`CodigoOtp`,
`CertificadoInquilino`, `AnuncioAcuse`, `Documento`), el delete tira **P2003** → la tx
hace rollback → la aprobación vuelve a PENDIENTE y **no se puede rechazar nunca más**.
Repro: CARGA carga contrato → el inquilino abre la PWA y pide un OTP (crea `CodigoOtp`)
→ Admin intenta rechazar → falla permanentemente.

**Fix**: antes del `inquilino.deleteMany`, borrar los hijos en la misma tx:
```ts
const inqs = await tx.inquilino.findMany({
  where: { contratoId: apr.entidadId, inmobiliariaId: u.inmobiliariaId },
  select: { id: true },
});
const ids = inqs.map((i) => i.id);
await tx.codigoOtp.deleteMany({ where: { inquilinoId: { in: ids } } });
await tx.certificadoInquilino.deleteMany({ where: { inquilinoId: { in: ids } } });
await tx.anuncioAcuse.deleteMany({ where: { inquilinoId: { in: ids } } });
await tx.documento.deleteMany({ where: { inquilinoId: { in: ids } } });
await tx.inquilino.deleteMany({ where: { contratoId: apr.entidadId, inmobiliariaId: u.inmobiliariaId } });
```
**VERIFICAR primero**: qué FKs apuntan a `Inquilino` en `schema.prisma` y cuáles son
RESTRICT (default Prisma) vs Cascade. Borrar exactamente esas. (Alternativa más
robusta pero con migración: `onDelete: Cascade` en esas relaciones.)

### P2 — [ALTA] BORRADOR-rechazado infla KPIs y aparece en la lista de Pagos
`apps/inmobiliaria/src/app/(app)/pagos/page.tsx` (~164-192) y `/contratos/page.tsx` (~116)

El fix v5 borra el inquilino al rechazar pero **deja el contrato en estado BORRADOR**.
Ese BORRADOR-rechazado infla el KPI "Pendiente" y aparece en la lista de cobros/pagos.

**Fix**: filtrar `estado !== 'BORRADOR'` en `pagos/page.tsx` (front, donde aplica;
el endpoint `/contratos` debe seguir devolviendo BORRADORs para la pantalla de
contratos). Opcional: endpoint `DELETE /contratos/:id` (ADMIN/OPERADOR, solo
BORRADOR con `pendienteAprobacion=false`) para limpiar el draft rechazado, o
distinguir en el contador `pendienteAprobacion`.

### P3 — [MEDIA] `useDashboard.cargando` incompleto
`apps/inmobiliaria/src/lib/api/hooks.ts` (~1122-1197)

El guard de carga del dashboard (fix v5) usa `cargando` pero ése no incluye
`usePropietarios().cargando` ni `useLiquidaciones().cargando` → el dashboard puede
mostrarse antes de tener esos datos. **Fix**: incluirlos:
`cargando: cargC || cargP || cargOwn || cargLiq`.

### P4 — [BAJA] P2034 no mapeado por el error handler global
`apps/api/src/app.ts`

La baja de sociedad v5 usa tx `Serializable`, que puede tirar **P2034**
(serialization failure) bajo concurrencia → hoy cae a **500**. **Fix**: en el error
handler, mapear `err.code === 'P2034'` → 409 ("Conflicto de escritura concurrente,
reintentá") (o 503 con Retry-After).

### P5 — [ALTA] `aprobarApi`/`rechazarApi` no invalidan `['contrato', id]`
`apps/inmobiliaria/src/lib/api/hooks.ts` (~243-260)

Tras aprobar/rechazar, el **detalle** de contrato en cache queda stale (el badge
"pendiente aprobación" no se actualiza). **Fix**: en ambas, agregar
`void qc.invalidateQueries({ queryKey: ['contrato'] })` (prefix-match invalida todos
los detalles). (`['contratos']` —lista— ya se invalida; falta `['contrato', id]` —detalle.)

---

## B. Bugs preexistentes (no-regresión)

### P6 — [ALTA] Comprobante adjunto del checkout NUNCA se sube al backend (éxito falso)
`apps/inquilino/src/app/(full)/pago/[liqId]/checkout/page-client.tsx` (~935-973)

En prod, el inquilino adjunta el comprobante y la UI muestra éxito, pero **el archivo
nunca se manda al backend** (no hay endpoint de upload). **Fix**: (corto plazo) en
`StepConfirmado` no mostrar el thumbnail/nombre como si hubiera llegado cuando
`apiEnabled`, y avisar "adjuntá el comprobante por WhatsApp". (Correcto) implementar
endpoint de upload (multipart) + 2º POST con el File antes de `onEnviado`.

### P7 — [ALTA] Link de invitación de co-inquilino reusable (token sin uso único)
`apps/api/src/routes/auth.ts` (~275-307, `POST /co-invitacion/:token/aceptar`)

El endpoint emite una sesión nueva cada vez que se usa el link, sin verificar que ya
fue aceptado → el link sirve infinitas veces. **Fix**: `if (co.estado === 'ACEPTADO')
return reply.code(409).send({ message: 'Esta invitación ya fue aceptada...' })`.
(Re-enviar = vía `POST /co-inquilinos/:id/link`, que solo el titular autenticado.)

### P8 — [ALTA] KPI "cobrado por propietario" inflado con PROPIETARIO_DIRECTO
`apps/inmobiliaria/src/lib/api/hooks.ts` (~917-928, `usePropietarios`)

El KPI suma `montoAlquiler` de todas las liquidaciones PAGADAS sin filtrar
`modoCobranza`, pero `POST /rendiciones` (server) solo cuenta `INMOBILIARIA`. Un
propietario con contratos PROPIETARIO_DIRECTO ve un bruto inflado que no coincide con
lo que se va a rendir (incluso 409 si TODO es directo). **Fix**: exponer
`modoCobranza` del contrato en `GET /propiedades` (core.ts) + `PropiedadApi`, y filtrar
`!== 'INMOBILIARIA'` en el loop. (O calcular `totalCobradoMes` server-side.)

### P9 — [MEDIA] Filtro `?propietario=` usa `propiedadesMock` en modo API
`apps/inmobiliaria/src/app/(app)/contratos/page.tsx` (~94-110)

Desde `/propietarios` → "Ver contratos" pasa `?propietario=<uuid real>`, pero el filtro
se arma con `propiedadesMock` → en prod el Set queda vacío → **cero contratos**. **Fix**:
derivar de datos reales (agregar `propietariosIds` al DTO de `GET /contratos` y armar el
Set desde los contratos reales), o desactivar el filtro cuando `apiEnabled`.

### P10 — [MEDIA] `/pagos/informar` y `/boletas` aceptan sobre contrato FINALIZADO
`apps/api/src/routes/plata.ts` (~183) y `inquilino-mundo.ts` (~861)

Dentro del TTL del JWT (15 días), un inquilino de un contrato ya FINALIZADO puede
informar un pago de una liquidación PARCIAL pendiente, o subir boletas. **Fix**: tras
obtener la liq/contrato, verificar `contrato.estado === 'ACTIVO'` → si no, 409.

### P11 — [BAJA] `POST /rendiciones/:id/anular` sin lock atómico
`apps/api/src/routes/plata.ts` (~493-509) — dos anulaciones concurrentes: la 2ª da 404
en vez de 409. **Fix**: tx callback con `deleteMany` + check `count === 0` → 409 (o
capturar P2025 → 409).

### P12 — [BAJA] Validación de motivo de rechazo en front permite < 5 chars
`apps/inmobiliaria/src/components/bandeja-aprobaciones.tsx` (~91-105) — el API exige ≥5,
el front solo `.trim()` → 400 tras escribir el PIN. **Fix**: `motivoRechazo.trim().length < 5`.

### P13 — [BAJA] Badge de estado del detalle de contrato siempre verde
`apps/inmobiliaria/src/app/(app)/contratos/[id]/page-client.tsx` (~248-254) — hardcoded
`success`. **Fix**: `Record<EstadoContrato, variant>` (ACTIVO=success, BORRADOR=warning,
FINALIZADO=secondary, RESCINDIDO=destructive).

### P14 — [MEDIA] SelectorMonto muestra el total en vez del saldo (parciales)
`apps/inquilino/.../checkout/page-client.tsx` (~134-135, 265-269) — **= el #7 diferido de
la v5.** El backend ya rechaza `monto > saldo` (integridad cubierta); el fix UI completo
necesita exponer lo conciliado al front. Bajo el flujo multi-parcial, demo-céntrico.

---

## C. Long-tail diferido A PROPÓSITO (no son bugs)

Pantallas demo-gated que muestran "Próximamente" o mock en prod (features secundarias,
no rompen el core ni la plata): historial de propietario, servicios públicos del
inquilino, negociación iterativa, migración masiva, recordatorio automático a morosos
(WhatsApp/mail real), reset de PIN olvidado, billing/facturas, auditoría de eventos,
objetivos/métricas internas, consorcios. Y la lista de "FALSOS POSITIVOS conocidos" de
`03-AUDITORIAS.md` (NO re-arreglar).

---

## Orden sugerido

1. **P1** (regresión que rompe rechazar — verificar las FKs reales primero).
2. **P5, P3, P4, P2** (resto de regresiones v5 — rápidas).
3. **P7, P8, P10** (ALTA/MEDIA backend de integridad).
4. **P6** (comprobante — decidir corto plazo vs endpoint de upload).
5. **P9, P11, P12, P13** (UX/robustez).
6. **P14** (decisión/feature, dejar para cuando se exponga el saldo al front).
7. **Re-correr `AUDITORIA-PROFUNDA-PROMPT.md`** para validar.
