'use client';

/**
 * Visita del profesional asignado a un reclamo (link mágico /p/:token en la
 * app inquilino). GET /reclamos/:id ya incluye `visita` (operacion.ts); acá
 * solo la extraemos + agregamos regenerar-link. Sin fallback demo: es una
 * pieza nueva, prod-only (en demo el progreso vive en visitas-cross-app.ts,
 * intacto — ver progreso-visita-card.tsx).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch, urlDeArchivo } from './client';
import { ensureApiSession } from './session';

export type EstadoVisita = 'ASIGNADO' | 'CONFIRMADA' | 'EN_CAMINO' | 'LISTO';

interface VisitaApi {
  id: string;
  estado: EstadoVisita;
  token: string;
  fechaVisita: string | null;
  confirmadaAt: string | null;
  enCaminoAt: string | null;
  listoAt: string | null;
  notaFinal: string | null;
  montoCobrado: string | number | null;
  fotoAntes: string | null;
  fotoDespues: string | null;
}

export interface VisitaReclamoView {
  id: string;
  estado: EstadoVisita;
  token: string;
  fechaVisita: string | null;
  confirmadaAt: string | null;
  enCaminoAt: string | null;
  listoAt: string | null;
  notaFinal: string | null;
  montoCobrado: number | null;
  fotoAntes: string | undefined;
  fotoDespues: string | undefined;
}

function mapVisita(v: VisitaApi): VisitaReclamoView {
  return {
    id: v.id,
    estado: v.estado,
    token: v.token,
    fechaVisita: v.fechaVisita,
    confirmadaAt: v.confirmadaAt,
    enCaminoAt: v.enCaminoAt,
    listoAt: v.listoAt,
    notaFinal: v.notaFinal,
    montoCobrado: v.montoCobrado != null ? Number(v.montoCobrado) : null,
    fotoAntes: urlDeArchivo(v.fotoAntes),
    fotoDespues: urlDeArchivo(v.fotoDespues),
  };
}

export function useVisitaReclamo(reclamoId: string | undefined): {
  visita: VisitaReclamoView | null;
  cargando: boolean;
  regenerarLink: () => Promise<string>;
} {
  const qc = useQueryClient();
  const key = ['reclamo-visita', reclamoId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      await ensureApiSession();
      const r = await apiFetch<{ visita: VisitaApi | null }>(`/reclamos/${reclamoId}`);
      return r.visita;
    },
    enabled: apiEnabled && !!reclamoId,
    staleTime: 10_000,
    // El profesional actualiza desde su link mágico — no hay push, así que
    // refrescamos cada tanto para reflejar su progreso sin recargar la página.
    refetchInterval: 20_000,
  });

  return {
    visita: q.data ? mapVisita(q.data) : null,
    cargando: q.isPending,
    regenerarLink: async () => {
      const res = await apiFetch<{ visitaToken: string }>(`/reclamos/${reclamoId}/visita/regenerar-link`, {
        method: 'POST',
      });
      await qc.invalidateQueries({ queryKey: key });
      return res.visitaToken;
    },
  };
}
