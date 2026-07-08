'use client';

/**
 * Ganancia de la inmobiliaria por contrato (GET /contratos/:id/ganancia).
 * Solo en modo API (prod); en demo no existe este cálculo → el componente que lo
 * usa se oculta (retorna null) para no fabricar números.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import type { Moneda } from '@/lib/types';

export interface GananciaContrato {
  modoCobranza: string;
  moneda: Moneda;
  /** Comisión ponderada como % (ej. 8). */
  tasaComision: number;
  /** Comisión ya RENDIDA (congelada) en la vida del contrato. */
  ganado: number;
  /** Comisión PROYECTADA si se cobra todo el alquiler devengado. */
  proyeccion: number;
  /** proyeccion − ganado (nunca negativo). */
  faltaGanar: number;
}

export function useContratoGanancia(id: string): {
  ganancia: GananciaContrato | null;
  cargando: boolean;
} {
  const q = useQuery({
    queryKey: ['contrato-ganancia', id],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<GananciaContrato>(`/contratos/${id}/ganancia`);
    },
    enabled: apiEnabled && id.length > 0,
    staleTime: 30_000,
    retry: false,
  });
  return { ganancia: q.data ?? null, cargando: q.isPending };
}
