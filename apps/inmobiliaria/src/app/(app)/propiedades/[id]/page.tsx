import { propiedadesMock } from '@/lib/mock-data';
import Client from './page-client';

export function generateStaticParams() {
  return propiedadesMock.map((p) => ({ id: p.id }));
}

export const dynamicParams = false;

export default function Page({ params }: { params: { id: string } }) {
  return <Client params={params} />;
}
