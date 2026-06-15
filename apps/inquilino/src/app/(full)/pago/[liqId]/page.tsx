import { liquidacionesMock } from '@/lib/mock-data';
import Client from './page-client';

export function generateStaticParams() {
  return liquidacionesMock.map((l) => ({ liqId: l.id }));
}

export const dynamicParams = process.env.STATIC_EXPORT !== '1';

export default function Page({ params }: { params: { liqId: string } }) {
  return <Client params={params} />;
}
