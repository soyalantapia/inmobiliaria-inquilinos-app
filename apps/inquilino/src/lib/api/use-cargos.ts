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
  /** Un total POR MONEDA: los cargos de un contrato pueden no compartirla. */
  totales: Array<{ moneda: CargoInquilino['moneda']; total: number }>;
  cargando: boolean;
  isError: boolean;
} {
  const q = useQuery({
    queryKey: ['mis-cargos'],
    queryFn: () => apiFetch<CargoApi[]>('/mis-cargos'),
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  if (!apiEnabled) return { cargos: [], totales: [], cargando: false, isError: false };
  if (q.isError) return { cargos: [], totales: [], cargando: false, isError: true };
  // Prisma serializa Decimal como string → normalizamos monto a number.
  const cargos = (q.data ?? []).map((c) => ({ ...c, monto: Number(c.monto) }));
  // Total POR MONEDA. Antes era un `reduce` plano rotulado con la moneda del primer cargo:
  // con una penalidad en USD y una reparación en ARS daba un número sin sentido y con el
  // símbolo equivocado. Cada CargoContrato lleva su propia moneda, así que no se pueden
  // sumar entre sí.
  const porMoneda = new Map<CargoInquilino['moneda'], number>();
  for (const c of cargos) porMoneda.set(c.moneda, (porMoneda.get(c.moneda) ?? 0) + c.monto);
  return {
    cargos,
    totales: [...porMoneda.entries()].map(([moneda, total]) => ({ moneda, total })),
    cargando: q.isPending,
    isError: false,
  };
}
