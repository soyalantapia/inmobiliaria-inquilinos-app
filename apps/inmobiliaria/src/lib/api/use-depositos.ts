'use client';

import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import type { Moneda } from '@/lib/types';

export interface DepositoContrato {
  contratoId: string;
  propiedad: string;
  inquilino: string;
  monto: number;
  moneda: Moneda;
  estadoContrato: string;
  fechaInicio: string;
}

export interface DepositosEnCustodia {
  porMoneda: { moneda: Moneda; total: number; cantidad: number }[];
  contratos: DepositoContrato[];
}

const VACIO: DepositosEnCustodia = { porMoneda: [], contratos: [] };

/**
 * Depósitos de garantía en custodia (plata de terceros que la inmo tiene que cuidar):
 * total por moneda + listado por contrato. Feature de prod (los depósitos reales viven
 * en el API); en demo (!apiEnabled) devuelve vacío con flag para que la pantalla avise.
 */
export function useDepositosEnCustodia(): {
  data: DepositosEnCustodia;
  cargando: boolean;
  disponible: boolean;
  error: boolean;
} {
  const q = useQuery({
    queryKey: ['depositos-en-custodia'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<DepositosEnCustodia>('/depositos/en-custodia');
    },
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  if (!apiEnabled) return { data: VACIO, cargando: false, disponible: false, error: false };
  if (q.isError) return { data: VACIO, cargando: false, disponible: true, error: true };
  return { data: q.data ?? VACIO, cargando: q.isPending, disponible: true, error: false };
}
