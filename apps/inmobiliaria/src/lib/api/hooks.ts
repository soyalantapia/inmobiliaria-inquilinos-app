'use client';

/**
 * Hooks de datos del panel: API si hay NEXT_PUBLIC_API_URL, mocks si no.
 * Los adaptadores devuelven los MISMOS tipos que usan las pantallas
 * (ContratoListado, etc.) para que la migración sea transparente.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import { contratosMock } from '@/lib/mock-data';
import type { ContratoListado } from '@/lib/types';

interface ContratoApi {
  id: string;
  estado: ContratoListado['estado'];
  monto: string | number;
  moneda: ContratoListado['moneda'];
  fechaInicio: string;
  fechaFin: string;
  proximoAjuste: string | null;
  tipoContrato: ContratoListado['tipoContrato'];
  montoExpensas: string | number | null;
  cbuAlias: string | null;
  titularCuenta: string | null;
  pendienteAprobacion: boolean;
  cargadoPor: string | null;
  cargadoRol: string | null;
  cargadoAt: string | null;
  aprobadoPor: string | null;
  propiedad: { id: string; direccion: string; ciudad: string };
  inquilinoTitular: { id: string; nombre: string; apellido: string | null } | null;
  /** Derivados por el server desde liquidaciones reales (Fase 3). */
  estadoPagoActual: ContratoListado['estadoPagoActual'];
  proximoVencimiento: string | null;
}

function mapContrato(c: ContratoApi): ContratoListado {
  return {
    id: c.id,
    inquilino: c.inquilinoTitular
      ? `${c.inquilinoTitular.nombre} ${c.inquilinoTitular.apellido ?? ''}`.trim()
      : '—',
    direccion: c.propiedad.direccion,
    monto: Number(c.monto),
    moneda: c.moneda,
    estado: c.estado,
    fechaInicio: c.fechaInicio.slice(0, 10),
    fechaFin: c.fechaFin.slice(0, 10),
    proximoVencimiento: (c.proximoVencimiento ?? c.fechaFin).slice(0, 10),
    estadoPagoActual: c.estadoPagoActual ?? 'PENDIENTE',
    cbuAlias: c.cbuAlias,
    titularCuenta: c.titularCuenta,
    ...(c.tipoContrato ? { tipoContrato: c.tipoContrato } : {}),
    ...(c.montoExpensas != null ? { montoExpensas: Number(c.montoExpensas) } : {}),
    ...(c.pendienteAprobacion ? { pendienteAprobacion: true } : {}),
    ...(c.cargadoPor ? { cargadoPor: c.cargadoPor } : {}),
    ...(c.aprobadoPor ? { aprobadoPor: c.aprobadoPor } : {}),
  } as ContratoListado;
}

export function useContratos(): { contratos: ContratoListado[]; cargando: boolean; deApi: boolean } {
  const q = useQuery({
    queryKey: ['contratos'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<ContratoApi[]>('/contratos');
      return data.map(mapContrato);
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  if (!apiEnabled) return { contratos: contratosMock, cargando: false, deApi: false };
  // Si el API falla (caído), caemos a los mocks para no dejar la pantalla vacía.
  if (q.isError) return { contratos: contratosMock, cargando: false, deApi: false };
  return { contratos: q.data ?? [], cargando: q.isPending, deApi: true };
}
