// Server wrapper para que `output: 'export'` pre-genere un HTML por cada
// contrato del mock. El contenido visual vive en page-client.tsx.
import { contratosMock } from '@/lib/mock-data';
import Client from './page-client';

export function generateStaticParams() {
  return contratosMock.map((c) => ({ id: c.id }));
}

export const dynamicParams = false;

export default function Page() {
  // El client lee el id via useParams(), no necesita props.
  return <Client />;
}
