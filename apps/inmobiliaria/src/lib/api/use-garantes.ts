'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';

export type TipoGarante = 'PROPIETARIA' | 'CAUCION' | 'SUELDO' | 'DIGITAL';

export const TIPO_GARANTE_LABEL: Record<TipoGarante, string> = {
  PROPIETARIA: 'Garantía propietaria',
  CAUCION: 'Seguro de caución',
  SUELDO: 'Garante por sueldo',
  DIGITAL: 'Garantía digital',
};

export interface Garante {
  id: string;
  tipo: TipoGarante;
  nombreProveedor: string;
  dni: string | null;
  numeroPoliza: string | null;
  montoCobertura: string | number | null;
  vigenciaHasta: string | null;
  contactoNombre: string | null;
  contactoTelefono: string;
  contactoEmail: string | null;
}

export interface GaranteInput {
  tipo: TipoGarante;
  nombreProveedor: string;
  dni?: string;
  numeroPoliza?: string;
  montoCobertura?: number;
  vigenciaHasta?: string;
  contactoNombre?: string;
  contactoTelefono: string;
  contactoEmail?: string;
}

/**
 * Garantes del contrato (contacto/póliza). Feature de prod (sin equivalente demo): en
 * !apiEnabled devuelve lista vacía y marca `disponible=false` para que el panel avise.
 */
export function useGarantes(contratoId: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['garantes', contratoId],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<Garante[]>(`/contratos/${contratoId}/garantes`);
    },
    enabled: apiEnabled && !!contratoId,
    staleTime: 15_000,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ['garantes', contratoId] });

  const crear = useMutation({
    mutationFn: async (g: GaranteInput) => {
      await ensureApiSession();
      return apiFetch(`/contratos/${contratoId}/garantes`, { method: 'POST', body: JSON.stringify(g) });
    },
    onSuccess: invalidar,
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, ...g }: GaranteInput & { id: string }) => {
      await ensureApiSession();
      return apiFetch(`/contratos/${contratoId}/garantes/${id}`, { method: 'PUT', body: JSON.stringify(g) });
    },
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      await ensureApiSession();
      return apiFetch(`/contratos/${contratoId}/garantes/${id}`, { method: 'DELETE' });
    },
    onSuccess: invalidar,
  });

  return {
    garantes: apiEnabled ? (q.data ?? []) : [],
    cargando: apiEnabled ? q.isPending : false,
    disponible: apiEnabled,
    crear,
    actualizar,
    eliminar,
  };
}
