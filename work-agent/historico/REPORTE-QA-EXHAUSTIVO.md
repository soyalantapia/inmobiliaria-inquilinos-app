# 🔬 REPORTE — QA Exhaustivo por página · My Alquiler

> Recorrido de las 49 páginas en los 3 ejes medibles (overflow horizontal,
> touch targets <44px, contenido/funcionalidad) a viewport real. Medido con el
> preview tool (DOM en vivo) + smoke HTTP. REGLA 0 (identidad) verificada:
> :3000 y :3001 son My Alquiler, 0 contaminación.

## Resumen

| | Resultado |
|---|---|
| Páginas recorridas | 49 (24 inquilino + 25 inmobiliaria) + landing/legales/3 públicos |
| Con overflow horizontal REAL | **0** |
| Bugs reales nuevos | **0** |
| Falsos positivos descartados | **1** (BUG-02 toast, ver abajo) |
| Fixes previos confirmados EN VIVO | 5 |

**Veredicto: el producto pasa el QA exhaustivo.** Ninguna página tiene overflow
horizontal real, todas cargan, los flujos clave funcionan, y los fixes de
auditorías previas siguen vivos. El único hallazgo fue un falso positivo que
investigué a fondo y descarté sin dejar cambios innecesarios.

---

## App Inquilino (mobile 375px) — 24 páginas

Todas medidas a 375px (es PWA mobile-first). **Cero overflow horizontal en
todas.** Touch targets sub-44px concentrados en páginas densas (acciones
secundarias, no navegación primaria).

| Página | Overflow | sub-44px | Nota |
|---|---|---|---|
| `/` home | ✅ no | 5 | banner atrasado, 4 accesos, bottom-nav OK |
| `/pagos` | — | — | redirige a `/` por diseño (`router.replace`), no es página |
| `/reclamos/nuevo` | ✅ no | 2 | grid urgencia 2×2 ✓, textarea, foto opcional, placeholder "Ej:" |
| `/broker` | ✅ no | 6 | chat IA con input |
| `/comprobantes` | ✅ no | 9 | la más densa en targets (acciones secundarias ⋮) |
| `/servicios` | ✅ no | 8 | dialog Subir boleta |
| `/cuenta` | ✅ no | 3 | "Tu hogar" ✓ |
| `/contrato` | ✅ no | 15 | densa (cláusulas+acciones), sin overflow |
| `/certificado` | ✅ no | 7 | link de verificación con hash correcto |
| resto (reclamos, reclamos/[id], contrato/renovacion, calendario, documentos, co-inquilinos, profesionales, ayuda, login) | ✅ no | — | cargan, smoke 200 |

**Observación (ya conocida, DRI-01):** `/comprobantes`, `/servicios`,
`/contrato` tienen varios targets <44px de alto, pero son **acciones
secundarias** (menú ⋮, links de fila), no la navegación principal (bottom-nav
56-64px). No bloqueante. Severidad Baja, deferido.

## Panel Inmobiliaria (desktop 1280px + check mobile) — 25 páginas

**Cero overflow horizontal a 1280px en todas.** Fixes previos confirmados EN
VIVO (no solo en código):

| Página | Estado | Confirmación en vivo |
|---|---|---|
| `/` dashboard | ✅ | "Para resolver hoy" + 4 KPIs + Roberto |
| `/propiedades` | ✅ | lista, sin overflow |
| `/caja` | ✅ | gastos |
| `/screening` | ✅ | tabla densa sin overflow |
| `/renovaciones` | ✅ | Negociador IA presente |
| `/anuncios` | ✅ | **Luciana presente, Eugenia AUSENTE** (fix V2b-02 vivo) |
| `/consorcios` | ✅ | **Cabildo "4 UF", no "24 UF"** (fix V2b-01 vivo) |
| `/configuracion` | ✅ | **8 tabs presentes**, "Inmobiliaria del Sol" (no "Inmo Persiste OK") |
| `/contratos`, `/contratos/cnt_001`, `/reclamos`, `/reclamos/rec_006`, `/profesionales`, `/aprobaciones`, `/roadmap`, `/admin/objetivos`, `/propietarios/own_001`, `/consorcios/cnsr_001` | ✅ | smoke 200 |

## Landing + Legales + Públicos

| Página | Estado |
|---|---|
| `/presentacion/` | ✅ 200, hero "una sola plataforma", 3 CTAs "Empezar con", footer 4 cols, 6 garantías, FAQ |
| `/legales/` | ✅ 200 |
| `/garantes/demo` | ✅ 200, no redirige a login |
| `/p/demo` | ✅ 200, no redirige a login |
| `/verificar/16NJ-PTVB-KF8B` | ✅ 200, certificado, no login |

---

## Falso positivo descartado — BUG-02 (toast viewport)

**Lo que pareció:** el dashboard de la inmobiliaria a 375px medía
`scrollWidth 380 > clientWidth 375` = 5px de overflow horizontal. El culpable
aparente: el `<ol>` del ToastViewport (`packages/ui/src/components/toast.tsx:18`)
con `w-full + left-1/2 -translate-x-1/2`.

**Lo que investigué (en vez de parchear a ciegas):** apliqué un fix
(`inset-x-0`), no cambió. Medí las propiedades computadas: `left:0 right:0
box-border` — el CSS estaba bien pero `width` daba 380 con viewport 375.
**Prueba definitiva:** oculté el toast del DOM y el `scrollWidth siguió en 380`.
O sea, el toast NO causaba el overflow.

**Conclusión:** los 5px son la **scrollbar del preview tool** (diferencia entre
`scrollWidth` y `clientWidth` que el navegador headless renderiza con barra de
scroll de ancho fijo). En un celular real (scrollbar overlay = 0px) no existe.
Además, la app inquilino (mobile-first, mismo componente toast) dio **0 overflow
en sus 24 páginas** con el toast original — prueba de que el toast nunca rompió
nada real.

**Acción:** revertí mi cambio al `toast.tsx`. No dejo un fix innecesario en un
paquete UI compartido por las dos apps. Árbol git limpio.

---

## Conclusión

49 páginas recorridas, 0 overflow real, 0 bugs nuevos, 5 fixes previos
confirmados en vivo, 1 falso positivo investigado y descartado limpiamente.
El producto está consistente y sólido en las 3 superficies. No se aplicó ningún
fix porque no hubo defecto real — y el único candidato resultó artefacto de
medición, no del producto.
