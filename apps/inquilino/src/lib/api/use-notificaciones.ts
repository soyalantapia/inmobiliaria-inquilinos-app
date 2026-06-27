'use client';

/**
 * Feed de notificaciones del inquilino. En prod (apiEnabled) viene del API real
 * (GET /mis-notificaciones, derivado del estado: liquidaciones, pagos, reclamos);
 * en demo devuelve null y la campana usa su derivación local (construirNotifs).
 *
 * El `unread` lo resuelve el componente con su localStorage de leídas: acá solo
 * traemos los eventos accionables.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';

export interface NotifApi {
  id: string;
  titulo: string;
  detalle: string;
  href: string;
  cuando: string;
  icono: string;
  severidad: 'critica' | 'alta' | 'media' | 'baja';
}

/** Devuelve las notifs del API en prod, o null en demo (la campana cae a su mock). */
export function useMisNotificaciones(): NotifApi[] | null {
  const q = useQuery({
    queryKey: ['mis-notificaciones'],
    queryFn: () => apiFetch<NotifApi[]>('/mis-notificaciones'),
    enabled: apiEnabled,
    staleTime: 60_000,
  });
  if (!apiEnabled) return null;
  return q.data ?? [];
}
