import { liquidacionesMock } from '@/lib/mock-data';
import Client from './page-client';

export function generateStaticParams() {
  return liquidacionesMock.map((l) => ({ liqId: l.id }));
}

export const dynamicParams = false;

export default function Page({ params }: { params: { liqId: string } }) {
  return <Client params={params} />;
}
