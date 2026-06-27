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
