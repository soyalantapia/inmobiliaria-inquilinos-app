'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiEnabled, getToken } from '@/lib/api/client';

/**
 * Protege el panel: en modo API, si no hay token JWT redirige a /login y no
 * renderiza nada (evita el flash del panel sin sesión). En modo demo
 * (`NEXT_PUBLIC_API_URL` vacío) deja pasar — la demo de GH Pages no tiene login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // En demo no hay puerta; en API arrancamos cerrados hasta confirmar token.
  const [autorizado, setAutorizado] = useState(!apiEnabled);

  useEffect(() => {
    if (!apiEnabled) return;
    if (getToken()) setAutorizado(true);
    else router.replace('/login');
  }, [router]);

  if (!autorizado) return null;
  return <>{children}</>;
}
