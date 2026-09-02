# T-02-N2 · El panel no compila en Windows

**Prioridad:** 🟡 · **Experto:** FE

---

## Lo primero que se descartó: no hay arreglo por configuración

La tarea ofrecía tres opciones y una parecía la barata: darle a la ruta `force-static`, o pasarle
fuentes explícitas a `ImageResponse`. **No sirve ninguna**, y se comprobó en vez de suponerlo.

`next/og` —el `@vercel/og` que Next 14 trae bundleado— hace esto en el **top level de su módulo**
(`index.node.js:18988`):

```js
var fontData = fs.readFileSync(fileURLToPath(join(import.meta.url, '../noto-sans-....ttf')));
```

Le pasa una **URL** a `path.join`. En POSIX el resultado sigue siendo `file:/...`, que Node
acepta; en Windows convierte las barras y devuelve algo que no es una URL válida → `TypeError:
Invalid URL`.

Al ser una lectura de módulo, ocurre apenas se **renderiza**, antes de mirar ninguna opción.
Verificado con un script mínimo:

```
import next/og.js  → OK          (el módulo pesado se carga tarde)
new ImageResponse(...).arrayBuffer()  → TypeError: Invalid URL
```

O sea: renderizar cualquier cosa falla. Ninguna prop de `ImageResponse` puede evitarlo.

## Lo que se hizo

**La imagen pasa a ser un PNG estático, y el JSX queda como fuente regenerable.**

- `opengraph-image.png` — **el mismo PNG que ya estaba publicado**. Se bajó de
  `myalquiler.com/inicio/…` (1200×630, 114.844 bytes), generado por este mismo código en Linux.
  No cambió ni un pixel: es literalmente el archivo que la landing ya servía.
- `opengraph-image.alt.txt` — el `alt` que antes exportaba el `.tsx`. Es de donde Next lo toma
  para una imagen estática.
- `_og/opengraph-image.fuente.tsx` — el JSX, movido a una carpeta con guion bajo, que en el App
  Router queda **fuera del ruteo**. Sigue en el repo como diseño versionado, con las
  instrucciones de cómo regenerarlo si cambia.

## Cómo se verificó

- **`next build` del panel en Windows: exit 0**, con `out/` completo. Era el objetivo entero.
- El PNG servido sale en `out/inicio/opengraph-image-b368cs.png`: **mismo nombre con hash, mismos
  114.844 bytes, mismo 1200×630** que el que estaba publicado.
- La metadata sobrevive completa — `og:image`, `:type`, `:width` 1200, `:height` 630 y `:alt` con
  el texto de siempre.
- `tsc` 0 en los cinco paquetes y 583 tests verdes.

## Lo que se pierde, dicho de frente

El diseño de la imagen deja de renderizarse en cada build. Si cambia, hay que regenerarla a mano
—editar el `.fuente.tsx`, copiarlo a la ruta, buildear en Linux o dejar que lo haga CI, y bajar
el PNG— y eso está escrito en el encabezado del propio archivo. Es el precio elegido a cambio de
que el panel se pueda buildear en la máquina donde se trabaja.
