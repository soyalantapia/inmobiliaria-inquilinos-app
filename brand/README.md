# My Alquiler — kit de marca (SVG)

Isotipo **puerta-cerradura**: la casa cuya puerta es una cerradura = "abrí tu alquiler".
Todos los archivos son **SVG vectorial** → escalan a cualquier tamaño sin perder calidad.

## Archivos y para qué sirve cada uno

| Archivo | Qué es | Usalo para |
|---|---|---|
| `isotipo.svg` | Ícono principal (tile violeta + marca) | Web, avatar, redes, uso general |
| `isotipo-favicon.svg` | Ícono con el ojo más grande | Tamaños chicos: **favicon 16–48px** |
| `isotipo-glyph.svg` | La marca sola, un color (`currentColor`) | Ponerla de cualquier color / monocromo / sellos |
| `logo-horizontal.svg` | Isotipo + "My Alquiler" ("My" en violeta) | Header, firma de mail, web, tarjetas |
| `logo-apilado.svg` | Isotipo arriba + wordmark abajo | Espacios cuadrados, splash, redes |
| `logo-reverso.svg` | Versión para **fondo oscuro** | Footers oscuros, slides dark |
| `app-icon.svg` | Ícono full-bleed (sin esquinas redondeadas) | Ícono al **instalar la app** (PWA/iOS/Android) |
| `app-icon-maskable.svg` | Ícono con zona segura (padding extra) | PWA `purpose: "maskable"` (Android adaptive) |

## Colores

- Violeta principal `#6D28D9` · Violeta CTA/reverso `#7C3AED` · Lila claro `#A78BFA`
- Tinta (texto) `#0F1020` · Blanco `#FFFFFF`

## Tipografía del wordmark

**Space Grotesk 700** ("My" en `#6D28D9`, "Alquiler" en `#0F1020`).
Los SVG del logo traen la fuente por `@import` de Google Fonts → se ven bien en el navegador.
Para que sea 100% portable (impresión, otros programas), abrí el SVG en Figma/Illustrator y
**convertí el texto a curvas/outlines** (Type → Outline). El isotipo NO usa fuente (es vector puro).

## Medidas recomendadas (para exportar PNG desde el SVG)

El SVG sirve para todo; si necesitás PNG a medida, exportá desde estos archivos:

- **Favicon** — de `isotipo-favicon.svg` → `favicon.svg` + PNG **16, 32, 48**
- **Apple touch icon** — de `isotipo.svg` → PNG **180×180**
- **PWA / instalar app** — de `app-icon.svg` → PNG **192, 512**; de `app-icon-maskable.svg` → PNG **512** (maskable)
- **Logo web (header)** — `logo-horizontal.svg` tal cual (vectorial)
- **Redes (avatar)** — de `isotipo.svg` → PNG **512×512** o **1000×1000**
- **OG / compartir** — armar sobre `logo-horizontal.svg` a **1200×630**

### Convertir SVG → PNG (si lo necesitás)

- **Figma / Illustrator**: abrir el SVG y exportar al tamaño que quieras (1 clic).
- **Terminal** (si tenés alguno instalado):
  - `rsvg-convert -w 512 -h 512 isotipo.svg -o isotipo-512.png`
  - `inkscape isotipo.svg -w 512 -h 512 -o isotipo-512.png`
  - `npx svgexport isotipo.svg isotipo-512.png 512:512`

## Wiring en la app (opcional, lo puedo hacer yo)

- `favicon.svg` + `apple-touch-icon.png` en `apps/inmobiliaria/public/` y `apps/inquilino/public/`
- `manifest.webmanifest` (PWA): `icons` con `app-icon` 192/512 + `app-icon-maskable` 512 (`purpose: "maskable"`)
