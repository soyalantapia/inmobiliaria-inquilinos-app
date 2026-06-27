# Changelog — My Alquiler

> Historial de cambios. Formato inspirado en Keep a Changelog. Las fechas son las de
> los commits en `main`. Para el detalle técnico de cada hito ver [`PROJECT.MD`](./PROJECT.MD)
> y [`work-agent/03-AUDITORIAS.md`](./work-agent/03-AUDITORIAS.md).

---

## [Sin versionar] — estado actual

Plataforma SaaS multi-tenant para inmobiliarias (panel) e inquilinos (PWA). Estado de cambios desde el handoff inicial hasta hoy.

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

