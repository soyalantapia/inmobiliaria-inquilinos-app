import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Config dual: dev SSR; build con STATIC_EXPORT=1 genera HTML estático apto
// para GitHub Pages bajo /inmobiliaria-inquilinos-app/inquilino.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isExport = process.env.STATIC_EXPORT === '1';
const clerkNoop = path.resolve(__dirname, '../../scripts/clerk-noop.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@llave/ui'],
  experimental: { typedRoutes: false },
  ...(isExport
    ? {
        output: 'export',
        trailingSlash: true,
        basePath: '/inmobiliaria-inquilinos-app/inquilino',
        images: { unoptimized: true },
        webpack: (config) => {
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
