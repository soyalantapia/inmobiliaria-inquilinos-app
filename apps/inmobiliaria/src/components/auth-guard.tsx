'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiEnabled, getToken } from '@/lib/api/client';

/**
 * Protege el panel: en modo API, si no hay token JWT no renderiza nada (evita el
 * flash del panel sin sesión) y redirige. El visitante sin sesión que entra a la
 * raíz `/` va a la home pública `/inicio` (la puerta de entrada que lo invita a
 * crear su inmobiliaria); un deep-link sin sesión va a `/login` (suele ser una
 * sesión vencida que quiere volver a entrar). En modo demo (`NEXT_PUBLIC_API_URL`
 * vacío) deja pasar — la demo de GH Pages no tiene login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  // En demo no hay puerta; en API arrancamos cerrados hasta confirmar token.
  const [autorizado, setAutorizado] = useState(!apiEnabled);

  useEffect(() => {
    if (!apiEnabled) return;
    if (getToken()) setAutorizado(true);
    else router.replace(pathname === '/' ? '/inicio' : '/login');
  }, [router, pathname]);

  if (!autorizado) return null;
  return <>{children}</>;
}
