'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import type { Moneda } from '@/lib/types';

export interface DepositoContrato {
  contratoId: string;
  propiedad: string;
  inquilino: string;
  monto: number;
  /** Reparaciones imputadas al depósito (CargoContrato contraDeposito). */
  deducciones: number;
  /** monto − deducciones (lo que quedaría para devolver). */
  disponible: number;
  moneda: Moneda;
  estadoContrato: string;
  fechaInicio: string;
}

export interface DepositosEnCustodia {
  porMoneda: { moneda: Moneda; total: number; cantidad: number }[];
  contratos: DepositoContrato[];
}

export type DecisionDeposito = 'DEVOLVER' | 'NETEAR' | 'EJECUTAR';

const VACIO: DepositosEnCustodia = { porMoneda: [], contratos: [] };

/**
 * Depósitos de garantía en custodia (plata de terceros que la inmo tiene que cuidar):
 * total por moneda + listado por contrato. Feature de prod (los depósitos reales viven
 * en el API); en demo (!apiEnabled) devuelve vacío con flag para que la pantalla avise.
 *
 * `resolver` salda el depósito al egreso (devolver / netear / ejecutar-"pelear") de un
 * contrato ya terminado; tras resolverlo, el contrato sale del listado en-custodia.
 */
export function useDepositosEnCustodia(): {
  data: DepositosEnCustodia;
  cargando: boolean;
  disponible: boolean;
  error: boolean;
  resolver: (contratoId: string, decision: DecisionDeposito, montoDevuelto: number, motivo?: string) => Promise<void>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['depositos-en-custodia'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<DepositosEnCustodia>('/depositos/en-custodia');
    },
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  const resolver = async (
    contratoId: string,
    decision: DecisionDeposito,
    montoDevuelto: number,
    motivo?: string,
  ) => {
    await apiFetch(`/contratos/${contratoId}/deposito/resolver`, {
      method: 'POST',
      body: JSON.stringify({ decision, montoDevuelto, motivo }),
    });
    await qc.invalidateQueries({ queryKey: ['depositos-en-custodia'] });
  };
  if (!apiEnabled) return { data: VACIO, cargando: false, disponible: false, error: false, resolver };
  if (q.isError) return { data: VACIO, cargando: false, disponible: true, error: true, resolver };
  return { data: q.data ?? VACIO, cargando: q.isPending, disponible: true, error: false, resolver };
}
