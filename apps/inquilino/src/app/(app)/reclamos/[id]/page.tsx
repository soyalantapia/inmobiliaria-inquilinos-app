import { misReclamosMock } from '@/lib/mock-data';
import Client from './page-client';

export function generateStaticParams() {
  return misReclamosMock.map((r) => ({ id: r.id }));
}

export const dynamicParams = process.env.STATIC_EXPORT !== '1';

export default function Page({ params }: { params: { id: string } }) {
  return <Client id={params.id} />;
}
