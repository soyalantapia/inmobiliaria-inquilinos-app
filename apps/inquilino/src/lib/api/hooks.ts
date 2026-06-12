'use client';

/**
 * Hooks de datos del inquilino: API si hay NEXT_PUBLIC_API_URL, localStorage
 * si no (la demo offline sigue intacta). Mismos shapes que usan las pantallas.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import {
  listarAnunciosParaInquilino,
  type AnuncioInquilino,
} from '@/lib/anuncios-cross-app';
import {
  leerAcuses,
  marcarEnterado as marcarEnteradoLocal,
  marcarLeido as marcarLeidoLocal,
  type Acuse,
} from '@/lib/anuncios-acuses';

interface MiAnuncioApi extends Omit<AnuncioInquilino, 'enviadoAt'> {
  enviadoAt: string;
  acuse: { leidoAt: string | null; confirmadoAt: string | null } | null;
}

export function useMisAnuncios(): {
  anuncios: AnuncioInquilino[];
  acuses: Record<string, Acuse>;
  marcarLeido: (id: string) => Promise<void>;
  marcarEnterado: (id: string) => Promise<void>;
  hidratado: boolean;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['mis-anuncios'],
    queryFn: () => apiFetch<MiAnuncioApi[]>('/mis-anuncios'),
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['mis-anuncios'] });

  if (!apiEnabled || q.isError) {
    return {
      anuncios: listarAnunciosParaInquilino(),
      acuses: leerAcuses(),
      marcarLeido: async (id) => {
        marcarLeidoLocal(id);
      },
      marcarEnterado: async (id) => {
        marcarEnteradoLocal(id);
      },
      hidratado: true,
    };
  }

  const anuncios = (q.data ?? []) as unknown as AnuncioInquilino[];
  const acuses: Record<string, Acuse> = {};
  for (const a of q.data ?? []) {
    if (a.acuse) {
      acuses[a.id] = {
        leidoAt: a.acuse.leidoAt ?? undefined,
        confirmadoAt: a.acuse.confirmadoAt ?? undefined,
      };
    }
  }
  return {
    anuncios,
    acuses,
    marcarLeido: async (id) => {
      await apiFetch(`/anuncios/${id}/leido`, { method: 'POST' });
      invalidar();
    },
    marcarEnterado: async (id) => {
      await apiFetch(`/anuncios/${id}/enterado`, { method: 'POST' });
      invalidar();
    },
    hidratado: !q.isPending,
  };
}
