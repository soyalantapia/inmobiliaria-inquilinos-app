# Plan — Ecosistema Propiedades + Contratos

> Plan de trabajo. **Estudiado contra el código real** (workflow de 5 investigadores, 08/07).
> Aún NO implementado — este doc es para acordar el alcance antes de avanzar.
> Fuente de verdad: `apps/api/src/routes/core.ts`, `plata.ts`, `apps/inmobiliaria/.../propiedades|contratos`, `schema.prisma`.

## Estado (08/07) — implementado en `main`, PENDIENTE DEPLOY
- ✅ **EJE 1** — flujo property-first (alta → ficha → contrato+inquilino desde la ficha). `cf4b7b1`.
- ✅ **EJE 2.1** — reclamos de la propiedad (actuales + de ex-inquilinos): endpoint nuevo `GET /propiedades/:id/reclamos` + front. Verificado E2E (401/200/404, datos reales). `6f3b469`.
- 🟡 **EJE 2.2** — contratos en la ficha: el código está correcto; la query a la DB de prod quedó inconclusa (`railway ssh` no respondió en la sesión headless). Verificar post-deploy: si esa propiedad no muestra contratos, es porque no tiene contrato cargado.
- ✅ **EJE 3** — ganancia por contrato (**rendido/congelado + proyección**, decisión del dueño): endpoint nuevo `GET /contratos/:id/ganancia` + card en el detalle. Verificado E2E. `d0e0256`.
- ⏳ **DEPLOY BLOQUEADO**: otra sesión tiene WIP pesado sin commitear (cargo→PWA del inquilino + canal email de anuncios; incluye migración `cargo_saldado`, `plata.ts`, `core.ts`, `schema.prisma`). `railway up` subiría ese trabajo a medias → **NO deployar** hasta que su árbol esté limpio. Todo lo mío quedó en `main` aislado con `git commit --only` (nunca toqué sus archivos; hice los backend como rutas NUEVAS para no editar `core.ts`).

---

## Objetivo (lo que pidió el dueño)
1. **Propiedades:** el alta debe cargar **únicamente la propiedad**; el **contrato + el inquilino** se cargan **después, desde dentro de la propiedad**.
2. En cada propiedad, ver el **tracking de todos los contratos con sus ex-inquilinos** y **todos los reclamos (actuales + pasados con su resolución)**.
3. Bug: en `/propiedades/:id` (ej. `cmqe2ce1l0008rup8zpeznl7g`) no se ven ni los contratos/reclamos actuales ni los pasados.
4. **Contrato:** saber **cuánto ganó la inmobiliaria por contrato**.

---

## Diagnóstico (estado real hoy)

**Lo bueno (ya alineado):**
- El **alta de propiedad ya crea SOLO la propiedad** + sus propietarios; el contrato/inquilino ya se sacaron del form (era "trampa de valor" que no persistía). `POST /propiedades` (`core.ts:622-697`) crea la propiedad en `estado DISPONIBLE`.
- El **inquilino se carga siempre al crear el contrato** (Paso 2 del wizard), con **reuso de Persona** por DNI (`GET /personas?q=`). Confirmado: no hay alta de inquilino standalone.
- El **modelo de datos para el historial es sólido**: sin `onDelete: Cascade` en ningún lado → al finalizar/rescindir **nada se borra**. `Propiedad.contratos[]` (histórico 1-N) + `Propiedad.contratoActualId` (puntero al vigente). Estado del contrato: `BORRADOR/ACTIVO/FINALIZADO/RESCINDIDO`.
- El **detalle de propiedad YA trae y renderiza** contrato actual + historial de contratos + ex-inquilinos (`core.ts:354-377` incluye `contratoActual` y `contratos`; front mapea `contrato` y `contratosPasados`, tab "Contratos anteriores").

**Los problemas:**
- 🔴 **Reclamos en la ficha de propiedad = roto por código.** `GET /propiedades/:id` **NO incluye** la relación `reclamos`, y el front **hardcodea `reclamos: []` / `reclamosAbiertos: 0`** (`use-propiedad.ts:239-240`). Afecta a **todas** las propiedades: pestaña Reclamos siempre vacía, stat "Reclamos abiertos" siempre 0, card "Últimos reclamos" nunca aparece. El markup existe; solo faltan los datos.
- 🟡 **Contratos no se ven en prod (esa propiedad):** el código está correcto y commiteado (`1fbd5ab`). Si no se ven, es (a) **deploy-lag** (prod corre un bundle anterior al historial) o (b) **datos** (`contratoActualId = null` / la propiedad no tiene filas de contrato). Hay que **verificar**, no cambiar el mapeo.
- 🟡 **Deep-link desconectado:** el wizard de contrato soporta `?propiedad=<id>` (preselecciona y salta al Paso 2 Inquilino), pero el botón "Cargar contrato" de la ficha va a `/contratos/nuevo` **pelado** (`[id]/page-client.tsx:706`) → obliga a re-elegir la propiedad.
- 🟡 **Alta empuja al contrato, no a la ficha:** tras crear, redirige a `/contratos/nuevo?propiedad=<id>` (`nueva/page.tsx:428`), no a `/propiedades/<id>`.
- 🆕 **Ganancia de la inmobiliaria por contrato: NO existe.** La comisión se congela **por rendición** (propietario+período), con tasa `Propietario.comisionPct` (default 8%). El campo `Contrato.comisionInmobiliaria` **existe pero está muerto** (se guarda del form y ningún cálculo de plata lo usa; solo el PDF con un `4.17` hardcodeado). No hay "$X ganado por ESTE contrato". Es **derivable on-read sin migración**.

---

## EJE 1 — Flujo "property-first" (alta → ficha → contrato+inquilino desde adentro)

**El backend ya hace lo pedido.** Solo cambia la UX del encadenado.

| # | Tarea | Dónde | Tamaño |
|---|---|---|---|
| 1.1 | Redirect del alta → a la **ficha** `/propiedades/:id` (no al wizard de contrato) + ajustar el toast | `propiedades/nueva/page.tsx:428` | 1 línea |
| 1.2 | Botón "Cargar contrato" de la ficha → `/contratos/nuevo?propiedad=${propiedad.id}` (el wizard ya salta al Paso 2 Inquilino) | `[id]/page-client.tsx:706` | 1 línea |
| 1.3 | Gating: mostrar "Cargar contrato" solo si `estado === 'DISPONIBLE'` (o manejar el caso en el wizard) para que el deep-link no se ignore en silencio | ficha + wizard | chico |

**Resultado:** cargás una propiedad → aterrizás en su ficha → desde ahí "Cargar contrato" → el wizard arranca en el Paso 2 (Inquilino), que carga/reusa la Persona. Exactamente el flujo pedido.

**Decisión de producto (D2):** el **propietario es obligatorio** en el alta hoy (`min(1)`). El propietario es parte de la propiedad (no del contrato), y varias rutas asumen que existen participaciones (cobranza directa, rendición). Recomendación: **mantenerlo obligatorio**. (Ver decisiones abajo.)

---

## EJE 2 — La ficha de propiedad = historia completa

### 2.1 🔴 FIX Reclamos (bug real — prioridad alta)
- **Backend** (`GET /propiedades/:id`, `core.ts:356`): incluir los reclamos de **TODOS los contratos de la propiedad** — patrón robusto `reclamo.findMany({ where: { contratoId: { in: [...contratos de la propiedad] } } })`, **no** por `propiedadId` (que es opcional y puede ser null). Traer estado + `resolucion` + `resueltoAt` + `costoTrabajo` + `pagador` + fecha, ordenados desc. Incluye reclamos de contratos FINALIZADOS/RESCINDIDOS (nada se borra).
- **Front** (`use-propiedad.ts:239-240`): dejar de hardcodear `[]`/`0`; declarar `reclamos` en el tipo `PropiedadApi`; mapear reales; calcular `reclamosAbiertos` con estado `ABIERTO/EN_CURSO` (patrón ya usado en la ficha de Persona, `core.ts:1849`).
- **UI:** el markup del tab Reclamos y la card "Últimos reclamos" **ya existen** — con datos reales muestran **actuales y pasados con su resolución**. Etiquetar cada reclamo con a qué contrato/inquilino perteneció (para distinguir los del inquilino actual vs ex-inquilinos).

### 2.2 🟡 Contratos + ex-inquilinos (código ya OK — VERIFICAR)
- Verificar en prod: (a) que corre **≥ `1fbd5ab`** (feature de historial), (b) query a la DB real (`myalquiler-db`) para `cmqe2ce1l0008rup8zpeznl7g`: `contratoActualId` + `count(contratos)`.
- Desambigua: **deploy-lag** (→ deploy) vs **datos** (la propiedad no tiene contratos → no es bug) vs **contrato en BORRADOR** (`contratoActualId null` → muestra "sin contrato activo" pero el historial igual debería listar).

### 2.3 🆕 (opcional) Ex-inquilinos deduplicados por Persona
- El historial hoy sale de `contratos[].inquilinoTitular` (una fila por contrato). Para "ex-inquilinos únicos" agrupar por `personaId`. Mejora de claridad; no bloqueante.

---

## EJE 3 — Ganancia de la inmobiliaria por contrato

**No existe hoy; es 100% derivable on-read sin migración**, respetando las reglas LOCKED (comisión solo sobre alquiler; `PROPIETARIO_DIRECTO` no genera ingreso; expensas fuera).

**Decisión de producto (D1) — fuente + base del número:**
- **A) `Propietario.comisionPct` sobre lo COBRADO** _(recomendado)_ — reusa la fórmula de `/caja/cierre` (`plata.ts:203-213`) scopeada a `contratoId`, sin ventana de fecha: `alquilerPortion = min(pago, liq.montoTotal) × (liq.montoAlquiler/liq.montoTotal)`; `tasa = Σ(participación × comisionPct)`; solo si `modoCobranza === 'INMOBILIARIA'`. Número "vivo" = ganancia real acumulada. _Caveat: `comisionPct` es mutable y no hay snapshot por pago → usa la tasa actual para pagos históricos (aproximación)._
- **B) Sobre lo RENDIDO (congelado, exacto histórico)** — suma `AlquilerRendido.monto × rendicion.comisionPct` (tasa congelada por rendición). Exacto, pero **solo cuenta lo ya rendido** al dueño (ignora cobrado-no-rendido).
- **C) Usar `Contrato.comisionInmobiliaria`** (campo por contrato, hoy muerto) — implica reconectarlo como fuente de verdad de la plata (más invasivo; hoy diverge de lo que factura el sistema).

**Tareas (una vez elegida la base):**
- 3.1 Backend: extender `GET /contratos/:id` (`core.ts:229-245`) con `gananciaInmoAcumulada` derivado (o `GET /contratos/:id/ganancia`). Sin migración.
- 3.2 Front: mostrar "La inmobiliaria ganó **$X** en este contrato" en el detalle de contrato (+ opcional en la ficha de propiedad, por contrato del historial).
- 3.3 Limpieza: resolver la divergencia `Contrato.comisionInmobiliaria` (muerto) vs `Propietario.comisionPct` (real) — o conectarlo, o marcarlo/quitarlo para que no confunda (el PDF del contrato usa un `4.17` hardcodeado).

---

## Secuencia sugerida
1. **EJE 2.1 (fix reclamos)** + **2.2 (verificar contratos en prod)** — bug real, alto impacto, ya visible. *(arrancar acá)*
2. **EJE 1 (flujo property-first)** — cambios chicos, gran mejora de UX.
3. **EJE 3 (ganancia por contrato)** — tras decidir la base (D1).

## Riesgos y constraints
- ⚠️ **Otra sesión tiene WIP sin commitear** (canal email de anuncios + refactor de nav en `core.ts`, `sidebar.tsx`, `topbar.tsx`, etc.). **No lo toco**; aíslo mis commits con `git commit --only`. Ojo: `core.ts` está tocado por esa sesión → coordinar los edits ahí (mis cambios de reclamos/ganancia en core.ts pueden convivir, pero cuidar el commit).
- Verificación **E2E contra la DEV DB con cleanup** (nunca el tenant real); **deploy con confirmación**.
- Respetar LOCKED: comisión sobre alquiler, `PROPIETARIO_DIRECTO` no gana, participaciones = 100.

## Decisiones (RESUELTAS por el dueño, 08/07)
- **D1 — Ganancia por contrato → base B (RENDIDO/congelado) + PROYECCIÓN.** Mostrar dos números:
  1. **Ganado (congelado):** `Σ AlquilerRendido.monto × rendicion.comisionPct/100` (exacto histórico, tasa congelada por rendición).
  2. **Proyección a ganar (vida del contrato):** `Σ liquidacion.montoAlquiler (todas las del contrato) × tasaComisión` donde `tasaComisión = Σ(participación × propietario.comisionPct)`. Solo si `modoCobranza === 'INMOBILIARIA'`. Sin migración.
  (Opcional: "falta ganar" = proyección − ganado.)
- **D2 — Propietario en el alta → OBLIGATORIO** (se mantiene `min(1)`). "Solo la propiedad" = sin contrato ni inquilino, pero con dueño.
