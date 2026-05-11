import { reclamosMock } from '@/lib/mock-data';
import Client from './page-client';

export function generateStaticParams() {
  return reclamosMock.map((r) => ({ id: r.id }));
}

export const dynamicParams = false;

export default function Page() {
  return <Client />;
}
