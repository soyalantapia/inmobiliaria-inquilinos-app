import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Rutas del PANEL/app (privadas, ya noindex): las bloqueamos para no gastar crawl
// budget ni exponer superficies internas. El marketing (/, /inicio, /precios, /registro
// y el contenido futuro de SEO) queda permitido.
const APP_PATHS = [
  '/contratos', '/propiedades', '/propietarios', '/pagos', '/caja', '/rendiciones',
  '/reclamos', '/depositos', '/equipo', '/configuracion', '/screening', '/anuncios',
  '/consorcios', '/personas', '/renovaciones', '/mi-inmobiliaria', '/login', '/api',
];

// Bots de los motores de IA que SÍ queremos que nos puedan leer y citar.
const AI_BOTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot',
  'anthropic-ai', 'Google-Extended', 'Bingbot', 'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: APP_PATHS },
      // Explícito para los bots de IA: que nunca queden bloqueados por accidente.
      ...AI_BOTS.map((ua) => ({ userAgent: ua, allow: '/', disallow: APP_PATHS })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
