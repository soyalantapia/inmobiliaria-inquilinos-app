# 🔬 PROMPT — QA EXHAUSTIVO por página de My Alquiler (para pegar en Claude Code)

> Copiá TODO desde la línea `═══` y pegalo en Claude Code con el repo abierto.
> Es el QA más profundo: cada página, cada funcionalidad, en 4 ejes
> (funcionalidad · UX/UI · responsive · detalles), a 3 viewports.

═══════════════════════════════════════════════════════════════════

# 🔬 QA EXHAUSTIVO — My Alquiler · página por página

Sos QA + diseñador de producto senior. Vas a revisar **las 49 páginas** del
producto, una por una, probando **cada funcionalidad concreta** (cada botón,
modal, formulario, estado) y evaluando **4 ejes** en cada una:

1. **🔧 Funcionalidad** — ¿cada botón/acción hace lo que dice? ¿el modal abre,
   valida, guarda, cierra? ¿el estado vacío / de error / de éxito aparece?
2. **🎨 UX/UI** — jerarquía visual, consistencia, espaciado, copy claro, foco
   visible, nada que parezca roto o a medio hacer.
3. **📱 Responsive** — probá CADA página en **mobile 390px, tablet 768px,
   desktop 1280px**. Sin scroll horizontal, sin texto cortado, touch targets
   ≥44px, layout que tenga sentido (no solo columnas apiladas).
4. **🔍 Detalles** — microcopy, números coherentes, fechas en formato correcto,
   placeholders útiles, sin lorem/TODO/datos fantasma.

## SETUP
- Repo `~/dev/inmobiliaria-inquilinos-app`. Next.js 14, mock en localStorage,
  sin backend. Levantar: `pnpm --filter inquilino dev` (:3000),
  `pnpm --filter inmobiliaria dev` (:3001).
- **REGLA 0 (identidad):** `curl -s localhost:3000/login | grep -ci "my alquiler"`
  > 0 y `grep -ci "deenex\|palta"` = 0 antes de empezar. Hay otros proyectos en
  puertos cercanos — si ves "Panel Administrador" o logo ajeno, estás en el
  equivocado. Pará.
- **REGLA 1:** cada hallazgo se basa en algo que VISTE (screenshot, DOM, código).
  Si no lo pudiste ver, es BLOCKED, no PASS.
- **REGLA 2 (verificá antes de reportar):** si algo parece un bug (404, número
  raro, "se ve mal"), confirmalo con una 2ª medición ANTES de anotarlo. En este
  proyecto ~5 de 6 banderas fueron falsos positivos (IDs inventados, regex
  case-sensitive, build viejo). Un bug real verificado > diez sospechas.
- **Accesos:** inquilina `localhost:3000/login?demo=1` (entra sin OTP).
  Inmobiliaria entra sola (mock Roberto). IDs reales: `prp_001`, `own_001..005`,
  `cnt_001`/`cnt_008`, `rec_006`, `cnsr_001`/`cnsr_002`. (NO inventes IDs.)
- **Herramienta:** usá el preview/browser para screenshots por viewport + leer
  el DOM. Para flujos con OTP usá `?demo=1`. Para medir touch targets/overflow:
  `document.documentElement.scrollWidth > clientWidth` y
  `[...document.querySelectorAll('a,button,input')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height<44})`.

---

## INVENTARIO COMPLETO A RECORRER (49 páginas)

### A — App Inquilino (PWA mobile, persona Mariela) — 24 rutas
Probá CADA UNA en mobile 390px primero (es PWA), luego tablet/desktop.

| Página | Funcionalidades concretas a probar |
|---|---|
| `/` (home) | banner pago atrasado + "Regularizar"; 4 accesos (Pagar/Reclamo/Contrato/Boleta); card inmobiliaria con WhatsApp+Llamar; anuncios; card Broker IA; últimos movimientos; bottom-nav 5 tabs |
| `/pagos` → checkout | monto, datos bancarios, botón "Copiar todos", carga de comprobante (3 pasos), N° operación con placeholder "Ej:" |
| `/reclamos` | lista con estado; ir a nuevo |
| `/reclamos/nuevo` | grid urgencia 2×2, subир foto, descripción, enviar |
| `/reclamos/[id]` | detalle, estado, timeline |
| `/contrato` | cláusulas, ajustes, depósito, vencimientos, "Ver opciones" renovación |
| `/contrato/renovacion` | propuesta de renovación |
| `/broker` | chat IA: preguntá del contrato, ¿responde citando cláusula? |
| `/comprobantes` | histórico, pago atrasado arriba, "Copiar todos" para contador |
| `/servicios` | boletas servicios, dialog "Subir boleta" (dropzone "Tocá o arrastrá"), menú ⋮ borrar |
| `/cuenta` | título "Tu hogar", dialog Editar datos, avatar "M" + chevron, no duplicar nav |
| `/co-inquilinos` | lista, ConfirmDialog (quitar) |
| `/documentos` | lista docs, ConfirmDialog |
| `/calendario` | eventos/vencimientos |
| `/certificado` | certificado del inquilino + link compartir |
| `/profesionales` | red de profesionales |
| `/ayuda` | FAQ / soporte |
| `/login` | OTP, banner demo, `?demo=1`, bg gradient continuo |

### B — Panel Inmobiliaria (desktop, persona Roberto) — 25 rutas
Probá en desktop 1280px primero, luego tablet/mobile (¿el panel desktop colapsa bien?).

| Página | Funcionalidades concretas a probar |
|---|---|
| `/` (dashboard) | bloques "Para resolver hoy" (clickeables→filtran), 4 KPIs plata, gráfico 4 semanas, agenda 14 días, selector "Todas las sociedades" |
| `/propietarios` | 5 cards, KPIs, SumarPropietarioDialog, RendirPropietarioDialog, HistorialPropietarioDialog (vista rápida), badge estado, buscador |
| `/propietarios/[id]` | ficha completa: KPIs, datos bancarios, ARCA, propiedades, editar |
| `/propiedades` | lista, estado, MigracionMasivaDialog, buscador |
| `/propiedades/[id]` | ficha: contrato, propietario, historial (usá prp_001) |
| `/propiedades/nueva` | formulario alta + validación |
| `/pagos` | lista pendientes, ValidadorResumenDialog, aprobar/rechazar/revertir, cargar pago manual |
| `/caja` | gastos, "Cargar gasto a caja", PinPromptDialog, ConfirmDialog eliminar |
| `/contratos` | lista, filtros |
| `/contratos/[id]` | ficha contrato (cnt_001) |
| `/contratos/nuevo` | wizard IA: subir PDF, lectura automática, revisar/confirmar |
| `/contratos/cnt_008` | conversación con IA funcionando |
| `/reclamos` | lista clasificada por categoría |
| `/reclamos/[id]` | detalle, AsignarProfesionalDialog (prioriza por categoría) |
| `/renovaciones` | Negociador IA, % aumento, prob. renovación, "Generar mensaje WhatsApp" |
| `/screening` | informe aspirante: identidad, familia, bienes, contacto |
| `/consorcios` | 2 consorcios, KPIs, deuda por UF |
| `/consorcios/[id]` | detalle (cnsr_001) |
| `/anuncios` | 3 anuncios, CrearAnuncioDialog, ConfirmDialog, prioridad+canales |
| `/profesionales` | red, Dialog alta (valida email), AsignarProfesionalDialog, notas |
| `/aprobaciones` | cola de aprobaciones (badge contador) |
| `/configuracion` | 8 tabs: Empresa, Sociedades, Equipo y permisos, Plan y facturas (CompararPlanesDialog), Convenios, Invitar colegas, Mercado, **Auditoría** (155 eventos + filtros) |
| `/roadmap` | items con votos, quarters |
| `/admin/objetivos` | objetivos |
| `/login` | mock auto-login |

### C — Landing + Legales (estáticas) — 2+ páginas
| `/presentacion/` | hero, problema (6), cómo funciona (3), 8 features, garantías (6), pricing (4 planes c/CTA), FAQ, changelog, footer 4 cols. Probá mobile+desktop. |
| `/legales/` | Términos, Privacidad, Datos, anchors |

### D — Públicos (sin login) — 3 páginas
| `/garantes/demo` · `/p/demo` · `/verificar/16NJ-PTVB-KF8B` | que NO redirijan a login, contenido correcto, CTAs |

---

## CÓMO REGISTRAR (una ficha por página)
```
### [ruta] — viewport(s) probados
🔧 Funcionalidad: ✅/⚠️/❌ + qué probaste (cada botón/modal/form)
🎨 UX/UI: ✅/⚠️/❌ + observación
📱 Responsive: ✅/⚠️/❌ + mobile/tablet/desktop (overflow, touch targets)
🔍 Detalles: ✅/⚠️/❌ + microcopy/números/fechas
🐛 Hallazgos: [lista con severidad Crítica/Alta/Media/Baja + archivo:línea]
```

## ENTREGABLE
1. `REPORTE-QA-EXHAUSTIVO.md`: una ficha por página (49) + resumen al inicio
   (X páginas OK, Y con hallazgos, Z bugs por severidad).
2. **Arreglá** los bugs Críticos/Altos de bajo riesgo (copy, CSS, dato mock,
   lógica clara): fix → `tsc --noEmit` verde → `next lint` verde → commit
   atómico (`fix(area): descripción`) → push. Un commit por bug.
3. **Deferí** (no toques solo): cambios de marca/estética de fondo, features
   nuevas, cualquier cosa que necesite backend. Anotalos con recomendación.
4. **Falsos positivos:** si una sospecha resulta tu error, anotala aparte como
   "descartado", NO como bug.
5. Cierre: `git status` limpio, 0 sin pushear; si tocaste la landing o apps,
   verificá en el build/producción que el fix está vivo.

Empezá por REGLA 0. Después recorré App Inquilino completa (mobile-first), luego
Inmobiliaria (desktop-first), luego Landing y Públicos. Reportá cada página a
medida que la terminás, no todo al final. Sé exhaustivo pero honesto: 49 fichas
reales valen más que un resumen optimista.

═══════════════════════════════════════════════════════════════════
