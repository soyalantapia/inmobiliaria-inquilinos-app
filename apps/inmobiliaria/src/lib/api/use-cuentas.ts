'use client';

/**
 * Cuentas de caja de la inmobiliaria (GET/POST/PATCH/DELETE /cuentas). La inmobiliaria
 * define sus cuentas ("Gaspar MP", "efectivo"…) con una dirección (entrada/salida/ambas)
 * y ve el total por cuenta. Solo prod (los endpoints gatean `cuentas.*`).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';

export type DireccionCuenta = 'ENTRADA' | 'SALIDA' | 'AMBAS';

export interface CuentaCaja {
  id: string;
  nombre: string;
  direccion: DireccionCuenta;
  activa: boolean;
  entradas: number;
  salidas: number;
  saldo: number;
}

export interface MovimientoDeCuenta {
  id: string;
  tipo: 'GASTO' | 'INGRESO_EXTRA';
  categoria: string;
  descripcion: string;
  monto: number;
  fecha: string;
  proveedor: string | null;
  propiedad: { direccion: string } | null;
}

export function useCuentas(): { cuentas: CuentaCaja[]; cargando: boolean; refrescar: () => void } {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['cuentas'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<CuentaCaja[]>('/cuentas');
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  return {
    cuentas: apiEnabled ? (q.data ?? []) : [],
    cargando: apiEnabled ? q.isPending : false,
    refrescar: () => void qc.invalidateQueries({ queryKey: ['cuentas'] }),
  };
}

export async function crearCuenta(input: { nombre: string; direccion: DireccionCuenta }): Promise<void> {
  await ensureApiSession();
  await apiFetch('/cuentas', { method: 'POST', body: JSON.stringify(input) });
}

export async function editarCuenta(
  id: string,
  cambios: Partial<{ nombre: string; direccion: DireccionCuenta; activa: boolean }>,
): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/cuentas/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) });
}

export async function borrarCuenta(id: string): Promise<{ archivada?: boolean; eliminada?: boolean; movimientos?: number }> {
  await ensureApiSession();
  return apiFetch(`/cuentas/${id}`, { method: 'DELETE' });
}

export function useMovimientosDeCuenta(cuentaId: string | null): { movimientos: MovimientoDeCuenta[]; cargando: boolean } {
  const q = useQuery({
    queryKey: ['cuenta-movimientos', cuentaId],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<MovimientoDeCuenta[]>(`/cuentas/${cuentaId}/movimientos`);
    },
    enabled: apiEnabled && !!cuentaId,
    staleTime: 15_000,
  });
  return { movimientos: q.data ?? [], cargando: apiEnabled && !!cuentaId ? q.isPending : false };
}
