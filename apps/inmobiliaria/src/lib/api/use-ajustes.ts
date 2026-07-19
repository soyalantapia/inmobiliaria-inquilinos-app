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

/** Reemplaza los dueños y sus % de una propiedad (PUT /propiedades/:id/participaciones).
 *  El server valida que sumen 100, sin duplicados y con propietarios del tenant. */
export function useEditarParticipaciones(propiedadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (participaciones: { propietarioId: string; porcentaje: number }[]) => {
      await ensureApiSession();
      return apiFetch(`/propiedades/${propiedadId}/participaciones`, {
        method: 'PUT',
        body: JSON.stringify({ participaciones }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propiedad', propiedadId] });
      qc.invalidateQueries({ queryKey: ['propiedades'] });
      qc.invalidateQueries({ queryKey: ['propietarios'] });
    },
  });
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
