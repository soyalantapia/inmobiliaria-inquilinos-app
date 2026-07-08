'use client';

/**
 * Cargos del inquilino que NO nacen de una liquidación: reparación de un reclamo
 * imputada al inquilino (pagador INQUILINO) y penalidad por rescisión. El backend
 * (`GET /mis-cargos`) devuelve sólo los que el inquilino debe: excluye los que van
 * contra el depósito y los ya saldados por la inmo. En demo (sin API) → lista vacía.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';

export interface CargoInquilino {
  id: string;
  tipo: 'REPARACION' | 'PENALIDAD_RESCISION' | 'DANOS' | 'OTRO';
  concepto: string;
  monto: number;
  moneda: 'ARS' | 'USD';
  fecha: string;
  origen: 'RECLAMO' | 'RESCISION' | 'OTRO';
}

interface CargoApi extends Omit<CargoInquilino, 'monto'> {
  monto: string | number;
}

export function useMisCargos(): {
  cargos: CargoInquilino[];
  total: number;
  cargando: boolean;
  isError: boolean;
} {
  const q = useQuery({
    queryKey: ['mis-cargos'],
    queryFn: () => apiFetch<CargoApi[]>('/mis-cargos'),
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  if (!apiEnabled) return { cargos: [], total: 0, cargando: false, isError: false };
  if (q.isError) return { cargos: [], total: 0, cargando: false, isError: true };
  // Prisma serializa Decimal como string → normalizamos monto a number.
  const cargos = (q.data ?? []).map((c) => ({ ...c, monto: Number(c.monto) }));
  return {
    cargos,
    total: cargos.reduce((s, c) => s + c.monto, 0),
    cargando: q.isPending,
    isError: false,
  };
}
