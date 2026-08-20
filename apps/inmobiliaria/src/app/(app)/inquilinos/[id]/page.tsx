import { contratosMock } from '@/lib/mock-data';
import Client from './page-client';

/**
 * Esta ficha era el ÚNICO `[id]` del panel sin wrapper de servidor: el archivo era
 * `'use client'` directo, sin `generateStaticParams`. Con `output: export` eso es un error
 * duro de build, así que el workflow de GitHub Pages venía fallando desde el 05/07/2026 y
 * la demo pública quedó congelada en ese estado. Sus cinco hermanas (consorcios, contratos,
 * propiedades, propietarios, reclamos) ya seguían este patrón.
 *
 * Los ids son los MISMOS que arma el fallback demo de `usePersonas`/`usePersona`
 * (`personasMock`, en lib/api/use-inquilinos.ts): una persona por contrato mock, con id
 * `per_<contratoId>`. Si se generaran otros, el export produciría páginas que después no
 * resuelven a ninguna persona.
 */
export function generateStaticParams() {
  return contratosMock.map((c) => ({ id: `per_${c.id}` }));
}

// En dev/SSR aceptamos cualquier id (la ficha se resuelve contra el API); en el export
// estático el universo se acota a los ids de arriba. Mismo criterio que las hermanas.
export const dynamicParams = process.env.STATIC_EXPORT !== '1';

export default function Page({ params }: { params: { id: string } }) {
  return <Client params={params} />;
}
