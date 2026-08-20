import { ImageResponse } from 'next/og';

/**
 * FUENTE de la imagen Open Graph (1200×630) de la landing — la que se ve cuando compartís el
 * link por WhatsApp, X, etc.
 *
 * **NO es una ruta.** Vive en `_og/`, y en el App Router una carpeta con guion bajo queda fuera
 * del ruteo. Lo que Next sirve es el PNG hermano, `../opengraph-image.png`.
 *
 * POR QUÉ DEJÓ DE GENERARSE EN CADA BUILD. `next/og` —el `@vercel/og` que Next 14 trae
 * bundleado— hace esto en el top level de su módulo:
 *
 *     fs.readFileSync(fileURLToPath(join(import.meta.url, '../noto-sans-....ttf')))
 *
 * Le pasa una URL a `path.join`. En POSIX queda `file:/...`, que Node acepta; en Windows
 * convierte las barras y devuelve algo que no es una URL válida → `TypeError: Invalid URL`. Como
 * la lectura es de módulo, revienta apenas se renderiza, sin importar qué opciones reciba
 * `ImageResponse`: se probó y **no hay arreglo por configuración**.
 *
 * Resultado: `next build` del panel moría en Windows, que es donde se trabaja. El PNG de al lado
 * es EXACTAMENTE el que este archivo generaba — se bajó de la landing publicada (1200×630,
 * generado por este mismo código en Linux), así que la imagen no cambió ni un pixel.
 *
 * CÓMO REGENERARLA si cambia el diseño:
 *   1. Editás este archivo.
 *   2. Lo copiás a `../opengraph-image.tsx` (ahí sí es una ruta).
 *   3. Buildeás en Linux, o dejás que lo haga CI, y bajás el PNG de la landing publicada.
 *   4. Lo guardás como `../opengraph-image.png` y borrás el `.tsx` de la ruta.
 *
 * El `alt` vive en `../opengraph-image.alt.txt`, que es de donde Next lo toma para una imagen
 * estática. Si lo cambiás acá, cambialo allá.
 *
 * Ver T-02-N2.
 */

export const runtime = 'nodejs';
export const alt = 'My Alquiler — Cobrá tus alquileres sin perseguir a nadie';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #2a1758 0%, #16092e 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        {/* logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              background: '#7c3aed',
              fontSize: '26px',
              fontWeight: 800,
            }}
          >
            My
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700 }}>My Alquiler</div>
        </div>

        {/* headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '76px', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            Cobrá tus alquileres
          </div>
          <div
            style={{
              fontSize: '76px',
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: '#c4b5fd',
            }}
          >
            sin perseguir a nadie.
          </div>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '28px', color: '#cbb9f0' }}>
          <span>Software para inmobiliarias argentinas</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>Gratis hasta el lanzamiento</span>
        </div>
      </div>
    ),
    size,
  );
}
