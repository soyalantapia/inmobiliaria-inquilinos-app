'use client';

// Redirect /pagos → / (home).
// El nav del inquilino marca "Pagos" como el primer item, pero su href es '/'
// porque el home es la pantalla de pagos. Sin esta página, escribir /pagos
// manualmente (URL natural) o un link viejo daban 404. Acá redirigimos.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PagosRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
