import { ImageResponse } from 'next/og';

/**
 * Imagen Open Graph (1200×630) de la landing — la que se ve cuando compartís el
 * link por WhatsApp, X, etc. Generada con next/og (Satori), sin assets externos.
 * Next la asocia automáticamente a /inicio.
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
