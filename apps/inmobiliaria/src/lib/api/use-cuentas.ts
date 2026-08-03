'use client';

/**
 * Cuentas de caja de la inmobiliaria (GET/POST/PATCH/DELETE /cuentas). La inmobiliaria
 * define sus cuentas ("Gaspar MP", "efectivo"…) con una dirección (entrada/salida/ambas)
 * y ve el total por cuenta. Solo prod (los endpoints gatean `cuentas.*`).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import type { Moneda } from '../types';

export type DireccionCuenta = 'ENTRADA' | 'SALIDA' | 'AMBAS';

export interface CuentaCaja {
  id: string;
  nombre: string;
  direccion: DireccionCuenta;
  activa: boolean;
  /**
   * Cuenta a la que van los movimientos que registra el sistema solo (hoy: el ingreso
   * que se crea al saldar un cargo del inquilino). Una sola por inmobiliaria, y tiene
   * que aceptar entradas. Sin ninguna marcada, esa plata entra a la caja pero no a
   * ninguna cuenta y los totales por cuenta no cierran contra el total de la caja.
   */
  esPredeterminada: boolean;
  /**
   * Totales POR MONEDA, nunca uno plano: sumar dólares y pesos uno a uno da un número
   * sin significado y el símbolo de la primera moneda lo disfraza de total válido.
   * Siempre trae al menos un renglón (ARS en cero si la cuenta no tiene movimientos).
   */
  totales: Array<{ moneda: Moneda; entradas: number; salidas: number; saldo: number }>;
}

export interface MovimientoDeCuenta {
  id: string;
  tipo: 'GASTO' | 'INGRESO_EXTRA';
  categoria: string;
  descripcion: string;
  monto: number;
  /** Sin esto el detalle pintaba todo con símbolo de pesos, incluidos los USD. */
  moneda: Moneda;
  fecha: string;
  proveedor: string | null;
  propiedad: { direccion: string } | null;
}

/**
 * `error` se expone aparte a propósito: "la lista vino vacía" y "no pudimos traer la
 * lista" son cosas distintas y colapsarlas en `[]` hacía que la caja mintiera. Con la
 * cuenta obligatoria, quien consuma esto decide si bloquea o no según lo que crea que
 * hay del otro lado — y no puede creer que no hay cuentas sólo porque falló el pedido.
 */
export function useCuentas(): {
  cuentas: CuentaCaja[];
  cargando: boolean;
  error: boolean;
  refrescar: () => void;
} {
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
    error: apiEnabled ? q.isError : false,
    refrescar: () => void qc.invalidateQueries({ queryKey: ['cuentas'] }),
  };
}

export async function crearCuenta(input: { nombre: string; direccion: DireccionCuenta }): Promise<void> {
  await ensureApiSession();
  await apiFetch('/cuentas', { method: 'POST', body: JSON.stringify(input) });
}

export async function editarCuenta(
  id: string,
  cambios: Partial<{
    nombre: string;
    direccion: DireccionCuenta;
    activa: boolean;
    esPredeterminada: boolean;
  }>,
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
