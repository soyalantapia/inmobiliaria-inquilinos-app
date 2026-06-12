'use client';

import { apiEnabled, apiFetch, getToken, setToken } from './client';

/**
 * Sesión del panel contra el API. Mientras no exista la pantalla de login del
 * panel (pendiente — hoy el panel auto-entra como Roberto), en modo API hacemos
 * el login dev con el usuario seed ADMIN. Cuando haya login real, esto
 * desaparece y el token viene de esa pantalla.
 */
let bootPromise: Promise<void> | null = null;

export function ensureApiSession(): Promise<void> {
  if (!apiEnabled || getToken()) return Promise.resolve();
  bootPromise ??= apiFetch<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'roberto@delsol.com', password: 'delsol123' }),
  })
    .then((r) => setToken(r.token))
    .catch(() => {
      // API caída: los hooks caen al fallback localStorage
    })
    .finally(() => {
      bootPromise = null;
    });
  return bootPromise;
}
