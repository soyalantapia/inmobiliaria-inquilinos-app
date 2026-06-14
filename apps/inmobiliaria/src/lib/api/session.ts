'use client';

/**
 * Sesión del panel contra el API. El token lo provee la pantalla de login real
 * (`/login` → POST /auth/login) y lo guarda en localStorage; el `AuthGuard`
 * redirige a /login cuando no hay sesión. Ya NO auto-logueamos un usuario seed:
 * acá no queda ningún backdoor de demo.
 */
export function ensureApiSession(): Promise<void> {
  return Promise.resolve();
}
