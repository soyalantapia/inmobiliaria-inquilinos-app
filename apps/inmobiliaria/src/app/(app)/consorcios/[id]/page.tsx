import { consorciosMock } from '@/lib/consorcios-storage';
import Client from './page-client';

// En static export pre-generamos un HTML por consorcio del mock; en runtime el
// detalle real lo trae `useConsorcio(id)` desde el API (GET /consorcios/:id).
// `dynamicParams=false` mantiene el export acotado a los ids conocidos.
export function generateStaticParams() {
  return consorciosMock.map((c) => ({ id: c.id }));
}

export const dynamicParams = process.env.STATIC_EXPORT !== '1';

export default function Page() {
  return <Client />;
}
