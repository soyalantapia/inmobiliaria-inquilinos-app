# 🧪 REPORTE — QA exhaustivo de TODO el proyecto (My Alquiler)

> Sweep de las 3 superficies (inquilino :3000 · inmobiliaria :3001 · landing/
> públicos) siguiendo el prompt `PROMPT-QA-PROYECTO-COMPLETO.md`. Medido con
> smoke HTTP + DOM en vivo (preview tool), viewports reales. REGLA 0
> (identidad) verificada: ambas apps son My Alquiler, 0 contaminación
> (Deenex/Palta/San Pedro = 0).

## Resumen

| | Resultado |
|---|---|
| Rutas recorridas | ~50 (24 inquilino + 25 inmobiliaria + 4 públicos/landing) |
| Smoke HTTP | **todas 200**, 0 errores de servidor |
| Overflow horizontal REAL encontrado | **2** (ambos arreglados en el pase) |
| Bugs reales nuevos | **2** (overflow `/reclamos/[id]` + overflow header `/precios`) — **resueltos** |
| Falsos positivos descartados (REGLA 2) | **2** (scrollbar headless 5px · toast viewport) |
| Regresiones de la sesión | **0** — todo el checklist pasa |

**Veredicto general: el proyecto pasa el QA.** Se encontraron 2 overflows reales
en mobile (uno expuesto por el propio cambio de copy del SLA), ambos
diagnosticados con 2da medición y **arreglados + verificados en vivo** (0px).
Toda la regresión de la sesión quedó verde.

---

## Hallazgos reales (encontrados y ARREGLADOS)

### 🟠 F1 · `/reclamos/[id]` (inmobiliaria) — overflow horizontal ~10px a 375px
- **Qué vi (medido):** con el diálogo cerrado, `scrollWidth 385 > clientWidth
  375 = 10px`. Las cards (`rounded-xl border bg-card`) median 369px y arrancaban
  en `left:16` → `right:385`. Afectaba a **todas** las cards del detalle
  (Plazo, Historial, Responder, Clasificación…), no sólo el badge.
- **Verificación 2da (REGLA 2):** no es el artefacto de scrollbar — el home da
  5px, esta página 10px. Subiendo por ancestros: el `div.grid gap-6
  lg:grid-cols-[…]` cabía (343px) pero su columna `div.space-y-4` medía 369px.
- **Causa raíz:** el grid no tenía `grid-cols-1` en mobile → la columna
  implícita se auto-dimensiona al contenido más ancho (el badge "Plazo de
  resolución · Vencido — …" no wrappeaba). El copy del SLA, ahora más largo, lo
  **expuso** (antes el texto corto entraba dentro del baseline).
- **Fix (aplicado):** `grid` → `grid grid-cols-1` en `reclamos/[id]/
  page-client.tsx:189`. Acota la columna y el badge wrappea.
- **Verificado:** overflow **10px → 0px**; badge en 3 líneas, cards 343px. tsc +
  lint limpios.

### 🟠 F2 · `/precios` (landing inmobiliaria) — overflow header ~24px a 375px
- **Qué vi (medido):** `scrollWidth 398 > clientWidth 375 = 23px`. El row del
  header `div.flex gap-2` (botones "Iniciar sesión" + "Probar gratis") llegaba a
  `right:399`.
- **Verificación 2da (REGLA 2):** distinguido del `<ol>` del ToastViewport
  (399, artefacto conocido, no causa overflow visible). El row de botones es
  contenido real: logo + 2 botones no entran en 343px (px-4).
- **Fix (aplicado):** ocultar "Iniciar sesión" en mobile (`hidden sm:inline-flex`)
  — es secundario y ya está en el footer; el CTA "Probar gratis" queda. En
  `(landing)/precios/page.tsx:106`.
- **Verificado:** overflow **23px → 0px**; header limpio (logo + Probar gratis).

---

## Falsos positivos descartados (REGLA 2)

1. **Overflow 5px en inmobiliaria mobile** (home y varias secciones):
   `scrollWidth 380 > clientWidth 375`. Es la **scrollbar del navegador
   headless** (ancho fijo) — en celular real (scrollbar overlay) = 0. Confirmado:
   elementos preexistentes también llegan a 380; la bottom-nav `inset-x-0` mide
   380 = ancho del documento (correcto). NO es bug.
2. **`<ol>` del ToastViewport a 399 en `/precios`** — contenedor de toasts
   `fixed w-full left-1/2 -translate-x-1/2`, vacío y `pointer-events-none`. Es el
   mismo patrón de BUG-02 ya investigado: no genera overflow visible. NO es bug.

---

## Por superficie

### A — App inquilino (:3000, mobile 375px) — 24 pantallas
Todas smoke **200**, **0 overflow real** en todas las medidas. Regresión OK:

| Check | Resultado |
|---|---|
| Home — desglose suma exacto | ✅ $480.000 + $92.000 + $26.598 = **$598.598** |
| Home — "Ponerte al día" (no "Regularizar") | ✅ |
| Home — FAB Asistente central + saludo Mariela | ✅ |
| Header unificado (Inicio/Pagos/Contrato/Reclamos) | ✅ mismo header (saludo + avatar compacto) |
| `/servicios/subir` · `/cuenta/editar` · `/co-inquilinos/invitar` | ✅ son **páginas** (no modales), prefill OK |
| `/pago/liq_001/checkout` | ✅ carga, datos de transferencia + monto |

### B — Panel inmobiliaria (:3001)
**Desktop 1280–1440:** dashboard + secciones smoke 200, **0 overflow**, sin
selector de sociedad, sidebar visible. **Mobile 375:**

| Check | Resultado |
|---|---|
| Bottom-nav: Inicio · Propiedades · [FAB Cargar] · Pagos · Reclamos | ✅ con **badges** Pagos[5] · Reclamos[3] (= inbox del día) |
| FAB "Reportar" = ícono bug | ✅ |
| Logout dentro del menú del avatar · sin botón suelto | ✅ |
| Selector de sociedad ausente | ✅ |
| `/reclamos/[id]` — "Plazo de resolución" (no "SLA") | ✅ |
| `/reclamos/[id]` — validación inline (botón disabled + hint, sin toast) | ✅ |
| `/reclamos/[id]` — overflow | 🟠 **F1 (arreglado)** |

### C — Landing + públicos
| Página | Overflow | Estado |
|---|---|---|
| `/garantes/demo` (sin login) | ✅ 0 | no redirige a login, contenido de garante |
| `/p/demo` (sin login) | ✅ 0 | brand presente |
| `/verificar/16NJ-PTVB-KF8B` | ✅ 0 | certificado válido, no login |
| `/precios` (landing inmo) | 🟠 **F2 (arreglado)** → 0 | pricing OK |

---

## Conclusión

50 rutas recorridas, todas cargan (smoke 200), 2 overflows reales encontrados
con medición + verificados como no-artefacto (REGLA 2) y **arreglados en el
pase** (ambos a 0px), 2 falsos positivos descartados limpiamente, y **toda la
regresión de la sesión en verde**. El producto está consistente en las 3
superficies. Los únicos defectos reales fueron responsive de mobile (uno
expuesto por el copy nuevo del SLA), corregidos con cambios mínimos y
verificados en vivo.
