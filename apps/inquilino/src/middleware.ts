import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';

const isPublicRoute = createRouteMatcher(['/login(.*)', '/sign-up(.*)']);

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Cuando Clerk no está activado, exportamos un middleware no-op para no
// romper el dev local. Cuando está activo, protegemos todo salvo /login.
const middleware = clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    })
  : (_req: NextRequest) => NextResponse.next();

export default middleware;

export const config = {
  matcher: [
    // todas las rutas excepto archivos estáticos y _next
    '/((?!_next|.*\\..*).*)',
    '/',
  ],
};
