# 🧪 PROMPT — QA exhaustivo de TODO el proyecto (My Alquiler)

> Copiá TODO desde la línea `═══` y pegalo en Claude Code con el repo abierto.
> Cubre las **3 superficies**: app inquilino (:3000), panel inmobiliaria
> (:3001) y landing/públicos. Mide en viewports reales, no estima.

═══════════════════════════════════════════════════════════════════

# SOS UN QA SENIOR — recorré y rompé TODO My Alquiler

Tu trabajo es recorrer **todo el producto** —las dos apps, la landing y las
vistas públicas— en viewports reales, encontrar lo que está roto, mal o
confuso, y entregar un reporte accionable. No inventás nada: lo que no podés
medir, lo marcás BLOQUEADO, no PASS.

## QUÉ ES EL PROYECTO

Monorepo (Turborepo + pnpm) con 2 apps Next.js 14 + una landing:

- **Inquilino** (`apps/inquilino`, puerto **:3000**) — PWA **mobile-first**.
  Persona: **Mariela Sosa**. Auth por OTP (con bypass `?demo=1`).
- **Inmobiliaria** (`apps/inmobiliaria`, puerto **:3001**) — panel **desktop**
  con barra inferior tipo app en **mobile**. Persona: **Roberto Tapia**
  (auto-login mock).
- **Landing + públicos** — presentación, legales, y vistas sin login
  (garante, profesional, verificación de certificado).

Datos en localStorage (sin backend). Marca: violeta. **NO hay datos de otra
empresa**: si ves "Deenex", "Palta", "San Pedro", "Mi San Pedro" → estás en la
app equivocada (ver REGLA 0).

## SETUP (hacelo antes de medir)

```bash
# Levantar ambas apps (si alguna ocupa el puerto y hay que buildear, matar:
#   lsof -ti:3000 -ti:3001 | xargs kill -9 )
pnpm --filter inquilino dev      # :3000
pnpm --filter inmobiliaria dev   # :3001
```

Accesos:
- **Inquilino**: `localhost:3000/login?demo=1` → entra como Mariela sin OTP.
- **Inmobiliaria**: `localhost:3001` → auto-login como Roberto.
- Para forzar el login del inquilino: `localhost:3000/login?force=1`.

## LAS 3 REGLAS (no negociables)

**REGLA 0 — Verificá la identidad ANTES de medir.** Antes de tocar cada app,
confirmá que es My Alquiler y no otra cosa:
```bash
curl -s http://localhost:3000/login   | grep -ci "my alquiler"          # debe ser > 0
curl -s http://localhost:3000/login   | grep -ci "deenex\|palta\|san pedro"  # debe ser 0
curl -s http://localhost:3001/         | grep -ci "inmobiliaria\|my alquiler" # > 0
curl -s http://localhost:3001/         | grep -ci "deenex\|palta\|san pedro"  # 0
```
Si la identidad falla, PARÁ: estás midiendo la app equivocada. (Ya nos pasó.)

**REGLA 1 — Medí, no estimes.** Overflow, tamaños, contraste, conteos: con
herramienta (DOM en vivo / `getBoundingClientRect` / `scrollWidth` vs
`clientWidth`). Si no podés medir algo, es **BLOQUEADO**, nunca PASS.

**REGLA 2 — Verificá cada flag con una 2da medición antes de reportarlo.** La
mayoría de los "hallazgos" son falsos positivos. Ejemplo conocido: a 375px el
panel da `scrollWidth 380 > clientWidth 375` = **5px**; es la **scrollbar del
navegador headless**, NO overflow real (en celular real con scrollbar overlay
= 0). Comprobalo (¿elementos preexistentes también llegan a 380? ¿sigue el
"overflow" si ocultás el sospechoso?) antes de anotarlo.

## EJES A EVALUAR EN CADA PÁGINA

1. **Funcionalidad** — ¿carga sin error (sin "Application error")? ¿los flujos
   andan? ¿los botones/links llevan a donde dicen? ¿los forms guardan?
2. **UX / UI / responsive** — ¿overflow horizontal real (0)? ¿touch targets
   ≥44px en navegación primaria? ¿algo cortado, encimado o ilegible? ¿jerarquía
   clara? ¿estados vacíos/carga/error?
3. **Contenido** — ¿copy claro y sin jerga? ¿números que cierran? ¿nada
   "Lorem", placeholder ni dato de otra empresa?

## VIEWPORTS

- **Inquilino**: **mobile 375px** (es PWA mobile-first). Tablet/desktop opcional.
- **Inmobiliaria**: **desktop 1280–1440px** (vista principal) **+ mobile 375px**
  (la barra inferior tipo app y los modales full-screen sólo viven en mobile).
- **Landing/públicos**: mobile 375px **y** desktop 1280px.

---

# SUPERFICIE A — App inquilino (:3000, mobile 375px)

Entrá con `?demo=1`. Recorré las 24 pantallas (todas mobile-first):

| Pantalla | Qué verificar puntual |
|---|---|
| `/` Inicio | Header "Hola, Mariela 👋" + avatar + campana. Banner de pago con **desglose** (Alquiler + Expensas + Intereses = Total, debe **sumar exacto**). Bottom-nav con **Asistente como FAB central**. Invitación "¿Primera vez?" opt-in (no muro). |
| `/comprobantes` (Pagos) | Header igual al de Inicio. Lista de recibos. CTA "Ponerte al día" (no "Regularizar"). |
| `/broker` (Asistente) | Chat IA, header "Asistente · Online". |
| `/contrato` | Header igual. Ficha del contrato, PDF, compartir garante (modal corto). |
| `/contrato/renovacion` | Flujo de renovación. |
| `/reclamos` + `/reclamos/nuevo` + `/reclamos/[id]` | Lista, alta (form), detalle. |
| `/servicios` + `/servicios/subir` | "Subir boleta" debe ser **página completa** (no modal). |
| `/cuenta` + `/cuenta/editar` | "Editar tus datos" **página completa**. Datos persisten al volver. |
| `/co-inquilinos` + `/co-inquilinos/invitar` | "Invitar" **página completa**; al enviar vuelve a la lista con el nuevo. |
| `/calendario` `/documentos` `/profesionales` `/certificado` `/ayuda` | Cargan, sin overflow, contenido coherente. |
| `/pago/[liqId]` + `/checkout` | Flujo de pago: datos copiables, monto exacto, subir comprobante. En la confirmación, la "lectura IA" muestra al **inquilino logueado** (Mariela), NO un nombre random. |
| `/login` | "Lo pedís una sola vez — te mantenemos la sesión abierta". Sin overflow. |

**Header consistente:** Inicio, Pagos, Contrato y Reclamos deben tener el
**mismo** header (saludo + avatar + campana). Si alguno difiere, es hallazgo.

---

# SUPERFICIE B — Panel inmobiliaria (:3001)

## B.1 — Desktop (1280–1440px)

Recorré las 23 secciones desde la sidebar:

`/` (dashboard "Para resolver hoy" + KPIs), `/propiedades` (+ `/[id]`,
`/nueva`), `/propietarios` (+ `/[id]`), `/pagos`, `/caja`, `/contratos` (+
`/[id]`, `/nuevo`), `/aprobaciones`, `/renovaciones`, `/consorcios` (+ `/[id]`),
`/reclamos` (+ `/[id]`), `/anuncios`, `/profesionales`, `/screening`,
`/roadmap`, `/configuracion`, `/admin/objetivos`.

Por cada una: carga sin error, 0 overflow a 1280px, KPIs/tablas con datos
coherentes, los modales abren centrados.

## B.2 — Mobile (375px) — lo nuevo

- **Barra inferior tipo app**: Inicio · Propiedades · **[FAB Cargar
  propiedad]** · Pagos · Reclamos. El FAB lleva a `/propiedades/nueva`. Badges
  de pendientes en **Pagos** y **Reclamos** (deben coincidir con el inbox
  "Para resolver hoy"). La pestaña Propiedades NO queda activa en
  `/propiedades/nueva` (ahí manda el FAB).
- **Hamburguesa** (arriba-izq): abre el resto de las secciones.
- **Modales full-screen**: abrí "Sumar propietario", "Cargar pago manual",
  "Editar propiedad", etc. → deben ocupar **toda la pantalla** y scrollear, con
  los botones de acción alcanzables (NO modal centrado que se corta). Las
  **confirmaciones** cortas ("¿Eliminar…?") sí van como tarjeta centrada.
- **Avatar (RT)**: el logout vive **dentro** del menú del avatar (no botón
  suelto).
- **FAB "Reportar"** (cliente piloto): ícono de **bug**, no de magia. Al abrir,
  muestra el contexto real capturado (pantalla, resolución, navegador).
- **Detalle de reclamo** (`/reclamos/rec_001`): el badge dice **"Plazo de
  resolución"**, no "SLA". Al "Marcar como resuelto" con <5 caracteres, el
  botón Confirmar queda **deshabilitado** con hint inline (no toast de error).

---

# SUPERFICIE C — Landing + públicos

Mobile 375px **y** desktop 1280px:

- **Landing inquilino** `/presentacion/` (o el build estático en `out/`) — hero,
  CTAs "Empezar con [plan]", pricing, FAQ, footer. Sin overflow, CTAs andan.
- **Legales** `/legales/`.
- **Públicos del inquilino** (sin login, NO deben redirigir a /login):
  - `/garantes/demo` — vista del garante.
  - `/p/demo` — vista del profesional.
  - `/verificar/16NJ-PTVB-KF8B` — verificación de certificado (hash estable).
- **Landing inmobiliaria** `:3001/precios`.

---

# CHECKLIST DE REGRESIÓN (lo que se tocó último — que no se haya roto)

- [ ] Inquilino: home con desglose que **suma**; "Ponerte al día"; tour opt-in;
      header unificado en las 4 pestañas; FAB Asistente central.
- [ ] Inquilino: 3 ex-modales ahora son páginas (invitar co-inquilino, subir
      boleta, editar datos) y guardan + redirigen bien.
- [ ] Inquilino: comprobante muestra al inquilino real (no "Florencia Russo").
- [ ] Inmobiliaria: bottom-nav + FAB "Cargar propiedad" + badges Pagos/Reclamos.
- [ ] Inmobiliaria: TODOS los modales son full-screen en mobile; confirmaciones
      compactas.
- [ ] Inmobiliaria: logout en el menú del avatar; selector de sociedad ya NO
      está en el topbar.
- [ ] Inmobiliaria: "Reportar" con ícono bug + contexto real.
- [ ] Inmobiliaria: "Plazo de resolución" (no "SLA"); validación inline al
      resolver reclamo.
- [ ] Ambas apps: `pnpm --filter <app> exec tsc --noEmit` y `pnpm --filter
      <app> lint` → limpios.

---

# CÓMO REGISTRAR CADA HALLAZGO

```
[#ID] [Superficie/Pantalla] — Título corto
🔴/🟠/🟡/🔵 Severidad · Eje: Funcionalidad / UX / Contenido
📍 Dónde: ruta + viewport + archivo:línea si lo ubicás
👀 Qué vi (con la MEDICIÓN, no impresión): "scrollWidth 410 > 375 = 35px real"
✅ Verificación 2da medición (REGLA 2): cómo descartaste que sea artefacto
💡 Fix propuesto: concreto (no "mejorar la UX")
```

Severidad: 🔴 bloquea el flujo / rompe · 🟠 alto (confunde o se ve roto) ·
🟡 medio (pulido) · 🔵 bajo (cosmético).

# ENTREGABLE

Generá `REPORTE-QA-PROYECTO.md` con:
1. **Resumen** — tabla: páginas recorridas por superficie, # con overflow real,
   # bugs reales nuevos, # falsos positivos descartados, regresiones.
2. **Por superficie** (Inquilino / Inmobiliaria / Landing-públicos) — tabla
   página × (overflow, targets, estado) + notas.
3. **Hallazgos reales** ordenados por severidad, con el formato de arriba.
4. **Falsos positivos descartados** (qué parecían y por qué no lo eran).
5. **Veredicto** por superficie: ¿pasa el QA? ¿qué bloquea?

# REGLA DE ORO

No arregles código en este pase salvo que sea trivial y lo verifiques en vivo.
Primero **encontrá y documentá**. Y antes de anotar cualquier cosa como rota:
medila dos veces. Si no la medís, es BLOQUEADO, no PASS.

Arrancá por REGLA 0 (identidad de las dos apps) y después barré superficie por
superficie. Sé implacable pero honesto.

═══════════════════════════════════════════════════════════════════
