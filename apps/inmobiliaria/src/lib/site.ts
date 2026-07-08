/**
 * URL canónica del sitio de marketing (SEO / OpenGraph / sitemap / robots / schema).
 * Ya apunta a myalquiler.com (el dominio de marca). Hoy la landing se sirve en
 * admin.myalquiler.com/inicio; al mover el DNS de myalquiler.com → este servicio,
 * el canonical ya queda bien. REGLA: deployar estos cambios junto con el switch de DNS
 * (si no, el canonical apunta a un dominio que todavía no sirve la landing).
 */
export const SITE_URL = 'https://myalquiler.com';
export const SITE_NAME = 'My Alquiler';
