'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { leerSesion } from '@/lib/auth-otp';

const RUTAS_PUBLICAS = ['/login', '/garantes'];

/**
 * Protege las rutas privadas: si no hay sesión OTP activa y el usuario está
 * intentando entrar a una ruta de la app, redirige a /login.
 *
 * Las rutas públicas (login, garante con token) son libres.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const esPublica = RUTAS_PUBLICAS.some((r) => pathname?.startsWith(r));
    if (esPublica) return;
    const sesion = leerSesion();
    if (!sesion) {
      router.replace('/login');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
