import { NextResponse, type NextRequest } from 'next/server';

// Sin Clerk: la auth corre client-side con OTP por email. El middleware
// queda como no-op para no bloquear rutas dinámicas. La protección real
// se hace en AuthProvider con leerSesion() y redirect a /login.

export default function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|.*\\..*).*)',
    '/',
  ],
};
