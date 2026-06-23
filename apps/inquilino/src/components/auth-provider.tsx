'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { leerSesion } from '@/lib/auth-otp';

// `/verificar/[hash]` es PÚBLICA por diseño: la usa cualquier otra
// inmobiliaria para chequear el certificado de un inquilino antes de
// alquilarle. Si no la listamos acá, el AuthProvider la redirige a
// /login y la inmo externa abandona — caso de uso "certificado social"
// muerto. Faltaba en la lista, ahora está.
const RUTAS_PUBLICAS = ['/login', '/garantes', '/p', '/verificar', '/invitacion'];

/**
 * Protege las rutas privadas: si no hay sesión OTP activa y el usuario está
 * intentando entrar a una ruta de la app, redirige a /login.
 *
 * Las rutas públicas (login, garante con token, profesional, verificar
 * certificado) son libres.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Match por BOUNDARY de segmento, no por prefijo crudo: con startsWith, el
    // prefijo '/p' (del token route /p/[token]) eximía de auth a /profesionales,
    // /pago/[liqId], /pagos y /perfil → un usuario deslogueado veía datos
    // financieros privados. `pathname === r || startsWith(r + '/')` deja público
    // solo el segmento exacto y sus subrutas reales.
    const esPublica =
      !!pathname &&
      RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(r + '/'));
    if (esPublica) return;
    const sesion = leerSesion();
    if (!sesion) {
      router.replace('/login');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
