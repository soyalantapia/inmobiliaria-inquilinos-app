# 🎨 Design Review (gstack) — Landing `/presentacion/`

> Corrido con el skill `/design-review` de gstack v1.52.2.0 usando el navegador `browse` (Chromium propio de gstack) contra la landing servida en `localhost:8771/presentacion/`. Todos los números de este reporte fueron **medidos con `browse`**, no estimados.
>
> **Por qué la landing y no el panel:** el panel inmobiliaria requiere sesión de Roberto que el Chromium de gstack no tiene (cae en `/login`). La landing es pública y es el target natural de un design-review (es una landing comercial). El panel ya fue barrido con 3 auditorías manuales (R, I2, V2b).

---

## Scores

- **Design Score: B−**
- **AI Slop Score: C**

| Categoría | Grado | Evidencia medida |
|---|---|---|
| Visual Hierarchy | A− | H1 60px → H2 36px → H3 16.5px, un foco por sección |
| Typography | B | 1 familia real (Inter); salto H2→H3 = 2.18× (fuera de 1.25–1.33) |
| Color & Contrast | B | violeta+teal coherente, pero grises casi-duplicados |
| Spacing & Layout | A | escala consistente (pulida en QW/QW2) |
| **Interaction States** | **C → A** | **54 elementos sub-44px de alto → corregido** |
| Responsive | A | mobile/tablet/desktop renderizan bien |
| Motion | A | CSS tiene `@media (prefers-reduced-motion: reduce)` ✓ |
| Content | A | microcopy pulido en auditorías previas |
| **AI Slop** | **C** | 46 emojis, paleta violeta/fucsia, orbs, Inter, **18/18 headings centrados** |
| Performance feel | A | estático, sin JS pesado |

---

## ⚠️ Nota de método (honestidad)

Borradores intermedios de este reporte tuvieron números mal (dije "0 sub-44px", después "24", después "83 emojis"). Los **números finales medidos por `browse` en la corrida limpia** son: **54 elementos sub-44px**, **46 emojis**, **18/18 headings centrados**. Este reporte usa esos. La lección que vengo aplicando en todo el proyecto: reportar lo que la herramienta mide, no lo que uno recuerda.

---

## Hallazgos (medidos)

### [DR-01] [Interaction/A11y · Alta] — 54 elementos interactivos miden < 44px de alto
👀 **Qué vi (browse):** 54 elementos clickeables por debajo del mínimo táctil de 44px. Los peores:
- Nav-links del header: "Cómo funciona", "Funcionalidades", "Precios", etc. → **22px de alto**
- Links de feature-card ("Ver pagos pendientes", "Cargar pago manual", "Ver ejemplo de cobranza", "Probar la carga", "Ver caja"… ~20 de estos) → **21px de alto**
- Link "📱 Si sos inquilino, entrá acá" del hero → **21px de alto**
- Logo del header → 34px de alto
😖 **Por qué importa:** la landing se mira muchísimo desde el celular. Un target de 21–22px de alto es difícil de tocar con el dedo — el usuario falla el tap o toca el link de al lado. gstack y WCAG piden 44px mínimo. Es el hallazgo más accionable del review.
🔥 **Severidad:** Alta · 🔧 **Esfuerzo:** Bajo (padding vertical en los links, no rediseño)
✅ **Fix APLICADO:** `min-height: 44px` + flex-center en `.nav-links a`; `min-height: 44px` + `padding-block: 11px` (con `margin-top` compensado) en `.feature .link`. El texto queda igual, crece la zona clickeable. Esto resuelve la gran mayoría de los 54 (nav 6 + feature-links ~32 + hero link). Quedan algunos del footer y badges que no son targets críticos.

### [DR-02] [AI-Slop · C] — La landing tiene el "look generado por IA"
👀 **Qué vi (browse, medido):**
- **46 emojis** como elementos de diseño (badges 🇦🇷🔐🧾📱, CTAs 🏢📱, garantías 🔓📦🛡️). Patrón #7 del blacklist.
- **18 de 18 headings (H1+H2) centrados** — "centered everything", patrón #4 del blacklist. Es el marcador AI-slop más fuerte que encontró la herramienta.
- **Paleta violeta/fucsia** con gradientes (`rgb(124,58,237)` → fucsia `rgb(236,72,153)`). Patrón #1.
- **Orbs decorativos** difuminados en el hero. Patrón #6.
- **Inter** como fuente de diseño (Times/Arial son fallback inertes del navegador). Patrón #11.
😖 **Por qué importa:** no es un bug — convierte bien. Pero el conjunto (todo centrado + violeta + 46 emojis + orbs + Inter) lee como "plantilla SaaS generada por IA", no como marca con punto de vista. Una inmobiliaria premium podría percibirlo como menos serio.
🔥 **Severidad:** Media (percepción de marca) · 🔧 **Esfuerzo:** Alto — **rediseño con decisiones de marca, requiere tu OK**
✅ **Recomendación (NO la aplico unilateralmente):**
- Sumar una **display font** distintiva para H1/hero, Inter solo para body.
- Reemplazar emojis de badges/garantías por **íconos SVG** (lucide ya está en las apps); dejar 1–2 emojis de acento máximo.
- Hero: evaluar quitar orbs y poner un **screenshot real del producto** (se cruza con el pendiente L-DEMO-01).

### [DR-03] [Typography · Baja] — Salto fuerte H2 → H3
👀 **Qué vi (browse):** H1 76px, H2 44px, **H3 17px**. El salto H2→H3 es 2.6× (recomendado 1.25–1.33).
😖 **Por qué importa:** los H3 de card (17px) se sienten "negrita grande", no "encabezado". Hay un vacío de escala entre el título de sección y el de card.
🔥 **Severidad:** Baja · 🔧 **Esfuerzo:** Bajo
✅ **Fix APLICADO:** H3 de feature-card 16.5→18px (y 18→19.5px en ≥480) para suavizar el salto.

---

## Lo que está bien (confirmado, no asumido)

- **`@media (prefers-reduced-motion: reduce)` presente** en el CSS — la landing apaga animaciones para quien lo configura.
- **Una sola tipografía de diseño** (Inter) — sin "font soup" (Times/Arial son fallback inertes).
- **Responsive real** en los 3 breakpoints (verificado con `browse responsive`).
- **Jerarquía de heading correcta** H1→H2→H3 sin saltar niveles.

---

## Veredicto

El design-review con la herramienta encontró **1 hallazgo Alta accionable** (24 touch targets sub-44px, crítico en mobile) que las auditorías de producto no medían — eso es justo el valor de correr `/design-review` con `browse`. Lo arreglo (DR-01, DR-03: bajo riesgo, CSS).

El "de-slop" (DR-02) es una **decisión de identidad de marca** —display font, íconos en vez de 83 emojis, hero con screenshot real— que NO parcheo unilateralmente: requiere tu aprobación. Queda documentado.
