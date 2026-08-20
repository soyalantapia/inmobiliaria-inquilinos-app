import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';

// /inicio (home pública), /registro (alta de inmobiliaria) y /precios (landing)
// deben ser públicas: si Clerk está activo, sin esto auth.protect() las bloquea y
// un cliente nuevo no puede entrar ni registrarse. /sign-up se deja por compat
// con el flujo Clerk nativo.
const isPublicRoute = createRouteMatcher([
  '/inicio(.*)',
  '/login(.*)',
  '/registro(.*)',
  '/precios(.*)',
  '/sign-up(.*)',
  // El portal del propietario, que se sirve como estático desde `public/propietario/` de esta
  // misma app (ver work-agent/02-DEPLOY.md). No es una pantalla del panel: sus usuarios son
  // los DUEÑOS, y entran con su propio OTP contra la API, sin cuenta de Clerk.
  //
  // Hoy no cambia nada, porque `clerkEnabled` es false en producción y el middleware es un
  // pass-through. Pero el día que alguien prenda Clerk, `auth.protect()` mandaría a todos los
  // propietarios al login del back office de la inmobiliaria — una pantalla donde no tienen
  // usuario y que ni siquiera es para ellos. Es una línea ahora y una caída después.
  '/propietario(.*)',
]);

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const middleware = clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    })
  : (_req: NextRequest) => NextResponse.next();

export default middleware;

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/'],
};
