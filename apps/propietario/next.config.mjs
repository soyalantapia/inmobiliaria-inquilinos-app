import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Config dual, igual que las otras dos apps: dev SSR; build con STATIC_EXPORT=1 genera HTML
// estático para GitHub Pages, acá bajo /inmobiliaria-inquilinos-app/propietario.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isExport = process.env.STATIC_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@llave/ui'],
  experimental: { typedRoutes: false },
  ...(isExport
    ? {
        output: 'export',
        trailingSlash: true,
        basePath: '/inmobiliaria-inquilinos-app/propietario',
        env: { NEXT_PUBLIC_BASE_PATH: '/inmobiliaria-inquilinos-app/propietario' },
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
