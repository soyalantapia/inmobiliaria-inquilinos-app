import { SITE_URL } from '@/lib/site';

// /llms.txt — contexto para motores de IA (ChatGPT, Claude, Perplexity) y agentes.
// Formato llmstxt.org: H1 + resumen en blockquote + secciones con links. Mantener corto
// y verdadero (regla del dueño: cero métricas inventadas).
export const dynamic = 'force-static';

const LLMS = `# My Alquiler

> Software de gestión de alquileres para inmobiliarias argentinas. Los inquilinos pagan desde una app y suben el comprobante; la inmobiliaria ve la cobranza en vivo con la mora calculada sola; y la rendición a propietarios sale calculada (alquiler, comisión, gastos y expensas). Incluye reclamos con red de profesionales, ajustes ICL/IPC automáticos, caja y auditoría, y depósitos en custodia.

## Qué es y para quién
- Para inmobiliarias y administradores de propiedades en Argentina.
- Tres diferenciadores (ningún competidor argentino ofrece los tres): (1) el inquilino paga desde su app y sube el comprobante; (2) la inmobiliaria ve la plata en vivo con la mora y los punitorios calculados día a día; (3) los reclamos se derivan a una red de profesionales que confirman la visita por WhatsApp con un link, sin login.
- Hecho en Córdoba. Convenios con CPI Córdoba, CUCICBA y Edifica.

## Páginas clave
- Inicio: ${SITE_URL}/inicio
- Precios: ${SITE_URL}/precios
- Precios legibles por máquina: ${SITE_URL}/pricing.md
- Empezar (alta self-service, sin tarjeta): ${SITE_URL}/registro

## Precios (resumen)
- Plan Alquileres: desde $50.000/mes (ARS) según el tamaño de la cartera — hasta 10 propiedades $50.000, hasta 50 $100.000, hasta 100 $200.000, más de 100 $350.000.
- Gratis hasta el lanzamiento, sin tarjeta y sin permanencia. Las primeras 50 inmobiliarias: -20% para siempre.
- Plan Consorcios para administración de PH (add-on).
- La plata nunca pasa por My Alquiler: va directo al CBU de la inmobiliaria; el sistema organiza la información y valida los pagos.
`;

export function GET(): Response {
  return new Response(LLMS, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
