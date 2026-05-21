import PaginaProfesional from './page-client';

/**
 * Ruta pública para profesionales que recibieron un link mágico.
 *
 * El token = ID del profesional (en backend real sería un JWT firmado).
 * Para static export pre-generamos los tokens del seed.
 */

const TOKENS_SEED = [
  'prof_001',
  'prof_002',
  'prof_003',
  'prof_004',
  'prof_005',
  'prof_006',
  'prof_007',
  'demo',
];

export function generateStaticParams() {
  return TOKENS_SEED.map((token) => ({ token }));
}

export const dynamicParams = false;

export default function Page({ params }: { params: { token: string } }) {
  return <PaginaProfesional token={params.token} />;
}
