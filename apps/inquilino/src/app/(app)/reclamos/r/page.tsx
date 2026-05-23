'use client';

// Ruta universal de detalle de reclamo: lee el id por query string y monta el
// mismo cliente que [id]/page.tsx. Esto nos da una sola página HTML estática
// que sirve para CUALQUIER id (incluidos los rec_xxx creados por el inquilino
// en localStorage, que no existen en generateStaticParams).
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Client from '../[id]/page-client';

function Inner() {
  const sp = useSearchParams();
  const id = sp?.get('id') ?? '';
  return <Client id={id} />;
}

export default function ReclamoDetallePorQueryPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
