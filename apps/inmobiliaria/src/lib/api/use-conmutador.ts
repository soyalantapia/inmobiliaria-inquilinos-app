'use client';

/**
 * Conmutador de usuarios del mostrador (T-25). Sólo prod: los endpoints piden sesión real.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch, setToken } from './client';
import { ensureApiSession } from './session';
import { limpiarEstadoDeSesion } from '@/lib/sesion-limpieza';
import type { Rol } from '@/lib/permisos';

export interface UsuarioConmutable {
  id: string;
  nombre: string;
  rol: Rol;
  imageUrl: string | null;
  tienePin: boolean;
  bloqueado: boolean;
  /** Sólo lo manda el API si sos ADMIN: a un tercero le diría cuándo volver a probar. */
  bloqueadoHasta: string | null;
}

export function useConmutables(activo: boolean): {
  usuarios: UsuarioConmutable[];
  cargando: boolean;
  refrescar: () => void;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['conmutables'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<{ usuarios: UsuarioConmutable[] }>('/auth/usuario/conmutables');
    },
    // Sólo cuando el menú está abierto: es una lista que cambia poco y no vale pedirla en cada
    // render del topbar, que está en TODAS las pantallas.
    enabled: apiEnabled && activo,
    // staleTime 0: el estado "bloqueado" tiene que estar fresco. Si alguien se bloqueó hace 20
    // segundos, mostrarle el botón habilitado es hacerle perder un intento.
    staleTime: 0,
  });
  return {
    usuarios: q.data?.usuarios ?? [],
    cargando: apiEnabled && activo ? q.isPending : false,
    refrescar: () => void qc.invalidateQueries({ queryKey: ['conmutables'] }),
  };
}

/**
 * Cambia de usuario. El ORDEN de los tres pasos finales es obligatorio y no es cosmético.
 *
 * 1. `setToken` — pisa la credencial. No queda ninguna del anterior: a diferencia de la PWA acá
 *    hay UN solo token guardado.
 * 2. `limpiarEstadoDeSesion` — barre las claves `llave-inmo:` del que se va. Sin esto, el que
 *    entra hereda su caja, sus rendiciones y su razón social.
 * 3. **HARD nav**, no `router.replace`. Dos razones, las dos con precedente escrito en la PWA
 *    (`mis-alquileres/page.tsx`): (a) el QueryClient vive en el layout RAÍZ y sobrevive a
 *    cualquier soft nav, así que la home se pintaría con la caché del usuario anterior;
 *    (b) mata el race de un refetch disparado con el token viejo que resuelve DESPUÉS del
 *    setToken. `queryClient.clear()` no alcanza: no resuelve el race y deja vivo el localStorage.
 */
export async function conmutarUsuario(usuarioId: string, pin: string): Promise<void> {
  await ensureApiSession();
  const r = await apiFetch<{ token: string }>('/auth/usuario/conmutar', {
    method: 'POST',
    body: JSON.stringify({ usuarioId, pin }),
  });
  setToken(r.token);
  limpiarEstadoDeSesion();
  window.location.assign('/');
}

export async function definirPin(pinNuevo: string, pinActual?: string): Promise<void> {
  await ensureApiSession();
  await apiFetch('/auth/pin', {
    method: 'POST',
    body: JSON.stringify({ pinNuevo, ...(pinActual ? { pinActual } : {}) }),
  });
}

export async function desbloquearPin(usuarioId: string): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/auth/usuario/${usuarioId}/pin/desbloquear`, { method: 'POST' });
}

export async function borrarPin(usuarioId: string): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/auth/usuario/${usuarioId}/pin`, { method: 'DELETE' });
}
