import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Config dual, igual que las otras dos apps: dev SSR; build con STATIC_EXPORT=1 genera HTML
// estático para GitHub Pages, acá bajo /inmobiliaria-inquilinos-app/propietario.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isExport = process.env.STATIC_EXPORT === '1';

// Bajo qué ruta se sirve el export estático.
//
// El default es el de GitHub Pages, que es de donde salió esto y lo que espera
// `scripts/build-static.sh` (no pasa nada y cuenta con que el config lo hornee).
// Se puede pisar con BASE_PATH para servir el portal como un subdirectorio de otro host
// —por ejemplo `/propietario` adentro del panel— y así no hace falta un servicio aparte
// sólo para una app de sólo lectura.
const basePath = process.env.BASE_PATH ?? '/inmobiliaria-inquilinos-app/propietario';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@llave/ui'],
  experimental: { typedRoutes: false },
  ...(isExport
    ? {
        output: 'export',
        trailingSlash: true,
        basePath,
        env: { NEXT_PUBLIC_BASE_PATH: basePath },
        images: { unoptimized: true },
      }
    : {
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
