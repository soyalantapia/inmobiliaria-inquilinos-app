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
  // `q.data ?? []` aplastaba TRES cosas: cargando, error y "no hay novedades". Con la caché
  // vacía, abrir la campana con la request en vuelo ya decía "Estás al día — No hay nada que
  // requiera tu atención". Es el mismo falso positivo que la home declara grave y bloquea con
  // un skeleton — y la campana viaja en el header de TODAS las pantallas, incluida la de error
  // de la home, así que la app se contradecía sola.
  //
  // El escenario que duele: al inquilino le rechazaron el comprobante y tiene la cuota vencida
  // hace seis días. Falla sólo este GET (el provider reintenta UNA vez). El resto de la PWA
  // carga bien, la campana no muestra badge y dice "Estás al día". Deja de pagar tranquilo
  // mientras corre la mora.
  if (q.isPending || q.isError) return null;
  return q.data ?? [];
}
