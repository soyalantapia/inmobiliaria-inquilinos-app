# 📋 Backlog — problemas a resolver

> Living doc. Cada ítem: qué reportó el usuario · qué entendí · causa raíz (código real) · plan · estado.
> Estados: `🔴 pendiente` · `🟡 en curso` · `🟢 hecho (rama/PR)` · `⏸️ parkeado (necesita decisión/insumo)`.
> Última actualización: 2026-07-14.

---

## Feedback del día (WhatsApp 14/07) — 4 ítems

### FB1 · Modo de cobranza: default silencioso + no editable — `P1` · 🟢 hecho (rama `feat/feedback-cobranza`)
> **Resuelto:** (a) wizard con radio-cards explícitas (commit 3e7d692); (b) `PATCH /contratos/:id/modo-cobranza` + card editable, con guard de rendición (409 si hay cobros del mes) y validación de cuenta del dueño (commit 7f69774). E2E verificado. _Nota: el seed dev tiene cnt_005 PROPIETARIO_DIRECTO sin cuenta del dueño (inconsistente); no afecta prod porque el alta exige la cuenta._
- **Reportó:** "cargué contrato y no puse que cobra el propietario, por defecto me puso *banco recaudador* y no me deja editar el modo de cobranza."
- **Entendí:** al no tocar el selector, el contrato queda en modo `INMOBILIARIA` (lo que el panel llama "cuenta recaudadora" / "banco recaudador") sin avisar el impacto; y una vez creado el contrato **no hay forma de cambiar el modo** (el botón dice "Próximamente" y no existe endpoint).
- **Causa raíz:** (1) UX — el modo es un `<Select>` con default silencioso `INMOBILIARIA` y labels inconsistentes entre wizard ("Cobra la inmobiliaria") y detalle ("Cuenta recaudadora"). (2) Feature faltante — nunca se construyó `PATCH /contratos/:id/modo-cobranza`; la card de edición está bloqueada en prod a propósito (para no escribir auditoría fantasma).
- **Plan:** (a) UX: elección explícita del modo en el wizard (radio-cards con explicación clara de cada uno), unificar labels. (b) Backend: `PATCH /contratos/:id/modo-cobranza` (plantilla = PATCH /monto), replicando la validación del alta (PROPIETARIO_DIRECTO exige cuenta del dueño), con guard si hay pagos/liquidaciones del período en curso. (c) Front: cablear la card de edición al PATCH real.
- **Riesgo:** cambiar el modo a mitad de contrato afecta rendiciones/cobranza y a dónde transfiere el inquilino. Guardas necesarias.

### FB2 · Nombre de complejo (agrupar propiedades/contratos) — `P2` · 🟢 hecho (rama `feat/feedback-cobranza`)
> **Resuelto (commit 2027212):** `Propiedad.complejo` (texto libre) + índice + migración aditiva; POST/PUT /propiedades; input en el alta; badge en el listado; búsqueda por complejo. Display híbrido consorcio→complejo. E2E ok. _Migración NO aplicada a prod (NIVEL=pr)._
- **Reportó:** "no me deja poner a qué complejo pertenece; no tengo nombre de complejo. Es importante para agrupar — varios del mismo complejo que no pagan o con reclamos."
- **Entendí:** quieren un **rótulo de complejo** para etiquetar propiedades y poder identificar/filtrar rápido las del mismo complejo (mora, reclamos).
- **Causa raíz:** existe un modelo `Consorcio` pesado (expensas/UFs/asambleas) con `Propiedad.consorcioId`, pero esa FK **no se puede setear desde la UI de alquileres** (solo seeds); y no existe un campo simple de nombre de complejo.
- **Plan (recomendado):** agregar `Propiedad.complejo String?` (texto libre) + índice. Display híbrido: `consorcio?.nombre ?? complejo`. Migración aditiva. UI: campo en alta/edición de propiedad + mostrar el complejo en listados + filtro por complejo (propiedades, pagos, reclamos). NO reusar el módulo Consorcio.
- **Riesgo:** bajo (aditivo). Migración en 2 DBs (dev 23651 + prod 57779).

### FB3 · CBU/alias del propietario: flujo confuso, el alta falla — `P1` · 🟢 hecho quick-win (rama `feat/feedback-cobranza`)
> **Resuelto (commit 029372c):** copy — label + hint del CBU del propietario (aclara que es para rendirle, no cobro directo) + mensajes de error del alta/PATCH que nombran la card exacta 'Cuenta de cobranza directa'. _La parte 'media' (unificar dónde se carga la cuenta directa) queda como follow-up._
- **Reportó:** "cargué propietario, puse el alias como pide, llené el contrato, le quise dar el alta y me dice que falta CBU o alias en el propietario. No sé dónde cargarlo o qué hice mal."
- **Entendí:** el usuario cargó el alias en la ficha del propietario, pero al dar de alta un contrato de cobranza directa el sistema exige **otra** cuenta (la de cobro directo) que se carga en otro lado → cree que ya lo hizo y el alta le falla.
- **Causa raíz:** **dos modelos distintos** para "la cuenta del propietario": `Propietario.cbuAlias` (para que la inmo le **rinda**) vs `CuentaCobranzaDirecta` (para que el **inquilino le transfiera directo**). El form del propietario captura solo `cbuAlias` con un **hint FALSO** ("los pagos del inquilino se acreditan directo a esta cuenta" — eso lo hace la otra). El alta de contrato `PROPIETARIO_DIRECTO` exige la `CuentaCobranzaDirecta`, con un mensaje que no dice dónde cargarla.
- **Plan:** (1) **quick win, copy, sin migración:** corregir el hint falso del form de propietario + el mensaje de error del alta para que nombre exactamente la card donde se carga la cuenta de cobranza directa. (2) medio: unificar/simplificar dónde se carga la cuenta del propietario (que desde la ficha del propietario o el mismo alta se pueda cargar la cuenta directa sin ir a otra pantalla).
- **Riesgo:** el quick-win es solo texto (cero riesgo). El (2) toca el flujo de cobranza directa.

### FB4 · Carga de contrato por PDF + IA — `P1` (pero `L`/`XL`) · ⏸️ parkeado
- **Reportó:** "los contratos los cargo a mano, no me deja subir el PDF y que lo haga la IA."
- **Entendí:** quieren subir el PDF del contrato y que la IA precargue los campos del wizard, en vez de tipear todo.
- **Causa raíz:** la capacidad **nunca se implementó en prod** — quedó como cáscara demo (mock). El wizard prod es carga manual pura. Está en el roadmap de PROJECT.MD, bloqueada por decisión de producto + presupuesto de IA.
- **Ya construido (aprovechable):** multipart + uploads aceptan PDF; el wizard tiene todos los campos destino; existe `ContratoDraft`; el `PasoIa` demo sirve de andamiaje visual.
- **Falta (construir):** `@anthropic-ai/sdk` en el back, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` en env, endpoint `POST /contratos/parse` que mande el PDF a Claude y devuelva JSON validado, y cablear el `PasoIa` real en el wizard.
- **Bloqueo (necesita tu OK):** (a) confirmar `ANTHROPIC_API_KEY` para prod (costo por uso); (b) es esfuerzo L/XL. Lo dejo parkeado hasta tu decisión; puedo dejar la infraestructura lista y gated por env si querés.

---

## Orden de ataque sugerido
1. **FB1** (P1, impacto alto, empezado) — UX del default + editar el modo.
2. **FB3 quick-win** (P1, 10 min, desbloquea altas) — arreglar los textos confusos del CBU.
3. **FB2** (P2, aditivo) — campo complejo + filtro.
4. **FB3 medio** — simplificar la carga de la cuenta directa del propietario.
5. **FB4** (parkeado) — decisión tuya sobre IA/costo.

---

## Backlog técnico heredado (follow-ups de auditorías previas)
- Rendiciones: KPI "por rendir" es **bruto, no neto** de lo ya rendido (display-only; server no doble-paga). `hooks.ts` usePropietarios.
- Conciliación bancaria: el endpoint **no registra eventos de auditoría** (ni CONCILIADO ni el auto-rechazo de #1). `resumenes-bancarios.ts`.
- Hardening: `updateMany` del auto-rechazo (#1) sin `inmobiliariaId` (defensa en profundidad, no explotable).
- PIN: `PinPromptDialog` sigue vivo en **9 pantallas** aunque el PIN es no-op — decisión de UX (¿sacarlo de todas?).
- Avatar del usuario del panel: backend `PUT /me/avatar` vivo, falta UI de subida (hoy muestra iniciales).
