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
  transpilePackages: ['@llave/ui'],
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
