import { reclamosMock } from '@/lib/mock-data';
import Client from './page-client';

export function generateStaticParams() {
  return reclamosMock.map((r) => ({ id: r.id }));
}

export const dynamicParams = process.env.STATIC_EXPORT !== '1';

export default function Page() {
  return <Client />;
}
