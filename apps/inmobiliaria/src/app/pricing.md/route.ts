// /pricing.md — precios legibles por máquina (para agentes de IA que comparan/eligen
// software antes de que un humano visite el sitio). Mantener sincronizado con /precios.
export const dynamic = 'force-static';

const PRICING = `# Precios — My Alquiler

Software de gestión de alquileres para inmobiliarias argentinas. Precio fijo mensual en
pesos (ARS) según el tamaño de la cartera. Gratis hasta el lanzamiento (sin tarjeta, sin
permanencia). Las primeras 50 inmobiliarias: -20% para siempre. Sin comisión por transferencia.

## Plan Alquileres
- Hasta 10 propiedades: $50.000 ARS / mes
- Hasta 50 propiedades: $100.000 ARS / mes
- Hasta 100 propiedades: $200.000 ARS / mes
- Más de 100 propiedades: $350.000 ARS / mes

Incluye en todos los tramos: cobranza en vivo, app del inquilino (paga y sube comprobante),
rendición a propietarios calculada, reclamos con red de profesionales, ajustes ICL/IPC
automáticos, caja y auditoría, depósitos en custodia. La plata va directo al CBU de la
inmobiliaria (no pasa por My Alquiler).

## Plan Consorcios
- Administración de PH / consorcios. Hasta 40% más barato como add-on del Plan Alquileres.
- Precio según cantidad de unidades — se cotiza por WhatsApp.

## Condiciones
- Gratis hasta el lanzamiento.
- Sin permanencia; te llevás tus datos cuando quieras.
- Soporte por WhatsApp con gente real.

Última actualización: 2026-07.
`;

export function GET(): Response {
  return new Response(PRICING, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
