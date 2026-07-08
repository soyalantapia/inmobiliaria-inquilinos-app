'use client';

/**
 * Ganancia de la inmobiliaria en todos los contratos de una propiedad + total
 * (GET /propiedades/:id/ganancias). Solo modo API; en demo el componente que lo usa
 * se oculta para no fabricar números.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import type { EstadoContrato, Moneda } from '@/lib/types';

export interface GananciaContratoItem {
  contratoId: string;
  inquilino: string;
  estado: EstadoContrato;
  fechaInicio: string | null;
  fechaFin: string | null;
  moneda: Moneda;
  modoCobranza: string;
  tasaComision: number;
  ganado: number;
  proyeccion: number;
  faltaGanar: number;
}

export interface GananciasPropiedad {
  moneda: Moneda;
  tasaComision: number;
  total: { ganado: number; proyeccion: number; faltaGanar: number };
  contratos: GananciaContratoItem[];
}

export function usePropiedadGanancias(id: string): {
  ganancias: GananciasPropiedad | null;
  cargando: boolean;
} {
  const q = useQuery({
    queryKey: ['propiedad-ganancias', id],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<GananciasPropiedad>(`/propiedades/${id}/ganancias`);
    },
    enabled: apiEnabled && id.length > 0,
    staleTime: 30_000,
    retry: false,
  });
  return { ganancias: q.data ?? null, cargando: q.isPending };
}
