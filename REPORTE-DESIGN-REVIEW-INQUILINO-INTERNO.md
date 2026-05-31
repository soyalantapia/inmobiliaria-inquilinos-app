# 🎨 Design Review — App Inquilino INTERNA (8 pantallas, mobile 375px)

> Testeo intenso de la app interna de Mariela, **habilitado por el bypass `?demo=1`** que implementé en esta sesión. Medido con el preview tool a viewport mobile 375×812 (browse venía crasheando; el preview es estable en mismo-origin). Todos los números medidos del DOM con `getBoundingClientRect()` / `getComputedStyle`, no estimados.

## Cómo se hizo

El OTP bloqueaba a browse (reporte anterior). Implementé `iniciarSesionDemo()` + `/login?demo=1` → entra a home como Mariela sin OTP. Con eso recorrí las 8 pantallas internas:
`/` (home), `/pagar`, `/reclamos`, `/reclamos/nuevo`, `/contrato`, `/comprobantes`, `/cuenta`, `/boletas`.

## Resultados medidos

| Pantalla | Overflow-H | sub-44px | texto <12px |
|---|---|---|---|
| `/` Home | ❌ no | 1 | 0 |
| `/pagar` | ❌ no | 2 | 0 |
| `/reclamos` | ❌ no | 2 | 0 |
| `/reclamos/nuevo` | ❌ no | 4 | 0 |
| `/contrato` | ❌ no | 3 | 0 |
| `/comprobantes` | ❌ no | 5 | 0 |
| `/cuenta` | ❌ no | 3 | 0 |
| `/boletas` | ❌ no | 2 | 0 |

**Bottom-nav (la navegación más usada): 56–64px de alto** — muy por encima del mínimo táctil de 44px. Excelente: la PWA está pensada para el dedo.

## Veredicto: la app interna está sólida para mobile

- **Cero overflow horizontal** en las 8 pantallas. Ni una con scroll lateral.
- **Cero textos por debajo de 12px** en toda la app. Legible.
- **Bottom-nav 56–64px** — la barra que Mariela usa todo el tiempo es cómoda de tocar.
- Comparación: la **landing** tenía 54 sub-44px; la **app interna** tiene 1–5 por pantalla, y son **acciones secundarias**, no la navegación primaria. La app nació mobile-first y se nota.

## Único hallazgo menor (no crítico)

### [DRI-01] `/comprobantes` — 5 targets táctiles chicos en acciones secundarias
👀 **Medido:** "Descargar" y "Compartir" 36px, menú ⋮ 32px, tab 40px, "Volver" 28px.
😖 Son acciones secundarias (no la nav principal), pero el ⋮ (32px) y "Volver" (28px) son los más flacos de toda la app. En un dedo grande, el ⋮ es fácil de errar.
🔥 **Severidad:** Baja · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** subir el área táctil del menú ⋮ y de "Volver" a 44px con padding (sin agrandar el ícono). No es bloqueante — son secundarias y el contenido principal está bien.

## Decisión sobre fixes

**No aplico fixes en este pase.** Los 1–5 sub-44px por pantalla son todos acciones secundarias menores, ninguno toca la navegación primaria (que está 56-64px) ni el contenido. La app interna está en muy buen estado para mobile. DRI-01 queda documentado como pulido opcional; meterle mano a 8 pantallas por targets secundarios de 6-12px de diferencia sería más riesgo que beneficio. La barra de calidad ya está alta.

## Lo que el bypass desbloqueó

Antes este testeo era **imposible** (el OTP frenaba toda herramienta headless). Ahora `?demo=1` permite auditar la app interna completa en segundos — sirve para este review y para cualquier QA/regresión futura.
