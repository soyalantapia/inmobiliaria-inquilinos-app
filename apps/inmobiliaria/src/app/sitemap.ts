import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Sitemap del sitio de marketing. Sumar acá cada página de contenido nueva
// (comparativas, guías, herramientas gratis, glosario) a medida que se publican.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/inicio`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/precios`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/registro`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
