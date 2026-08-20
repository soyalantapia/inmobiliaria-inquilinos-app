import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Config dual: dev funciona como SSR; build acepta `STATIC_EXPORT=1` para
// generar HTML estático apto para GitHub Pages. Cuando exportamos, sirve bajo
// el basePath /inmobiliaria-inquilinos-app/inmobiliaria.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isExport = process.env.STATIC_EXPORT === '1';
const clerkNoop = path.resolve(__dirname, '../../scripts/clerk-noop.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@llave/ui', '@llave/shared'],
  ...(isExport
    ? {
        output: 'export',
        trailingSlash: true,
        basePath: '/inmobiliaria-inquilinos-app/inmobiliaria',
        images: { unoptimized: true },
        webpack: (config) => {
          // En static export reemplazamos Clerk por noops para evitar el
          // import de server actions. Auth queda deshabilitada (no hay
          // env var de Clerk en el deploy de GH Pages).
          config.resolve.alias['@clerk/nextjs'] = clerkNoop;
          config.resolve.alias['@clerk/nextjs/server'] = clerkNoop;
          return config;
        },
      }
    : {
        /**
         * El portal del propietario, servido como `/propietario` de este mismo host.
         *
         * POR QUÉ ACÁ Y NO EN UN SERVICIO PROPIO: el portal es una app de SÓLO LECTURA y
         * totalmente estática (ya se exporta así para la demo). Un servicio de Railway
         * aparte serían dólares por mes y un dominio más para mantener, cuando lo único
         * que hace falta es que alguien sirva unos HTML. El build del panel deja el export
         * en `public/propietario/` y Next lo sirve desde ahí.
         *
         * POR QUÉ HACEN FALTA ESTOS REWRITES: Next sirve `public/` archivo por archivo y NO
         * resuelve índices de directorio. Sin esto, `/propietario/` redirige a
         * `/propietario` (trailingSlash false) y eso es un 404, aunque el
         * `public/propietario/index.html` esté ahí.
         *
         * VAN EN `afterFiles` A PROPÓSITO: esa etapa corre DESPUÉS del filesystem, así que
         * los assets reales (`/propietario/_next/...js`, el `index.html`) se sirven tal cual
         * y nunca llegan al rewrite. En `beforeFiles` la regla comodín les pegaría a todos y
         * les pediría un `/index.html` que no existe.
         *
         * POR QUÉ EL PANEL Y NO LA PWA DEL INQUILINO: la PWA registra un service worker con
         * scope `/`, que tomaría el control de `/propietario/*`. El panel no tiene ninguno.
         */
        rewrites: async () => ({
          beforeFiles: [],
          afterFiles: [
            { source: '/propietario', destination: '/propietario/index.html' },
            { source: '/propietario/:ruta*', destination: '/propietario/:ruta*/index.html' },
          ],
          fallback: [],
        }),
        headers: async () => [
          {
            source: '/(.*)',
            headers: [
              { key: 'X-Frame-Options', value: 'DENY' },
              { key: 'X-Content-Type-Options', value: 'nosniff' },
              { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            ],
          },
        ],
      }),
};

export default nextConfig;
