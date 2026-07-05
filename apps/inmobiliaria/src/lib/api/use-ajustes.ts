'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';

export interface AjusteAlquiler {
  id: string;
  montoAnterior: string | number;
  montoNuevo: string | number;
  periodoDesde: string;
  motivo: string | null;
  createdAt: string;
}

/** Historial de ajustes del alquiler de un contrato. */
export function useAjustes(contratoId: string): { ajustes: AjusteAlquiler[]; disponible: boolean } {
  const q = useQuery({
    queryKey: ['ajustes', contratoId],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<AjusteAlquiler[]>(`/contratos/${contratoId}/ajustes`);
    },
    enabled: apiEnabled && !!contratoId,
    staleTime: 30_000,
  });
  return { ajustes: apiEnabled ? (q.data ?? []) : [], disponible: apiEnabled };
}

/** Ajustar el alquiler: nuevo canon + desde qué período. Actualiza el contrato y las
 *  cuotas futuras impagas, y registra el ajuste en el historial. */
export function useAjustarAlquiler(contratoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { montoNuevo: number; periodoDesde: string; motivo?: string }) => {
      await ensureApiSession();
      return apiFetch<{ liquidacionesActualizadas: number; montoNuevo: number }>(
        `/contratos/${contratoId}/ajustar`,
        { method: 'POST', body: JSON.stringify(input) },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ajustes', contratoId] });
      qc.invalidateQueries({ queryKey: ['contrato', contratoId] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
    },
  });
}
