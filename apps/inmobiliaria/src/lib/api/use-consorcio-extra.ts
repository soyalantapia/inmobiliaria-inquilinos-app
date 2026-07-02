'use client';

/**
 * Servicios comunes + inventario del consorcio desde el API real, con fallback
 * al store local SOLO en build demo (!apiEnabled). Antes los tabs Servicios e
 * Inventario leían SEEDS de localStorage incluso en producción (mockup).
 *
 * Montos Decimal del API llegan como string → Number(). Fechas ISO tal cual.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import {
  guardarServicioConsorcio,
  leerServiciosDeConsorcio,
  type ServicioComun,
} from '@/lib/consorcio-servicios-storage';
import {
  cargarItem,
  listarInventarioDe,
  listarMovimientosDe,
  moverStock,
  type ItemInventario,
  type MovimientoInventario,
} from '@/lib/consorcio-inventario-storage';

/* ===================== Servicios comunes ===================== */

interface ServicioApi {
  tipo: ServicioComun['tipo'];
  proveedor: string;
  nis: string;
  numeroMedidor: string | null;
  costoPromedioMensual: string | number | null;
  observaciones: string | null;
  actualizadoAt: string;
}

function mapServicio(s: ServicioApi): ServicioComun {
  return {
    tipo: s.tipo,
    proveedor: s.proveedor,
    nis: s.nis,
    numeroMedidor: s.numeroMedidor ?? undefined,
    costoPromedioMensual: s.costoPromedioMensual != null ? Number(s.costoPromedioMensual) : undefined,
    observaciones: s.observaciones ?? undefined,
    actualizadoAt: s.actualizadoAt,
  };
}

export function useConsorcioServicios(consorcioId: string): {
  servicios: ServicioComun[];
  cargando: boolean;
  deApi: boolean;
  guardar: (s: ServicioComun) => Promise<void>;
} {
  const qc = useQueryClient();
  const key = ['consorcio-servicios', consorcioId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<ServicioApi[]>(`/consorcios/${consorcioId}/servicios`);
      return data.map(mapServicio);
    },
    enabled: apiEnabled && !!consorcioId,
    staleTime: 15_000,
  });

  if (!apiEnabled) {
    return {
      servicios: leerServiciosDeConsorcio(consorcioId),
      cargando: false,
      deApi: false,
      guardar: async (s) => {
        guardarServicioConsorcio(consorcioId, s);
      },
    };
  }

  return {
    servicios: q.data ?? [],
    cargando: q.isPending,
    deApi: true,
    guardar: async (s) => {
      await apiFetch(`/consorcios/${consorcioId}/servicios`, {
        method: 'PUT',
        body: JSON.stringify({
          tipo: s.tipo,
          proveedor: s.proveedor,
          nis: s.nis,
          numeroMedidor: s.numeroMedidor ?? null,
          costoPromedioMensual: s.costoPromedioMensual ?? null,
          observaciones: s.observaciones ?? null,
        }),
      });
      await qc.invalidateQueries({ queryKey: key });
    },
  };
}

/* ===================== Inventario ===================== */

interface ItemApi {
  id: string;
  consorcioId: string;
  categoria: ItemInventario['categoria'];
  nombre: string;
  unidad: string;
  cantidadActual: number;
  minimoStock: number;
  costoUnitario: string | number | null;
  notas: string | null;
  actualizadoAt: string;
}

interface MovApi {
  id: string;
  itemId: string;
  consorcioId: string;
  tipo: MovimientoInventario['tipo'];
  cantidad: number;
  motivo: string;
  ufDestino: string | null;
  fecha: string;
  cargadoPor: string;
}

function mapItem(i: ItemApi): ItemInventario {
  return {
    id: i.id,
    consorcioId: i.consorcioId,
    categoria: i.categoria,
    nombre: i.nombre,
    unidad: i.unidad,
    cantidadActual: i.cantidadActual,
    minimoStock: i.minimoStock,
    costoUnitario: i.costoUnitario != null ? Number(i.costoUnitario) : undefined,
    notas: i.notas ?? undefined,
    actualizadoAt: i.actualizadoAt,
  };
}

function mapMov(m: MovApi): MovimientoInventario {
  return {
    id: m.id,
    itemId: m.itemId,
    consorcioId: m.consorcioId,
    tipo: m.tipo,
    cantidad: m.cantidad,
    motivo: m.motivo,
    ufDestino: m.ufDestino ?? undefined,
    fecha: m.fecha,
    cargadoPor: m.cargadoPor,
  };
}

export function useConsorcioInventario(consorcioId: string): {
  items: ItemInventario[];
  movimientos: MovimientoInventario[];
  cargando: boolean;
  deApi: boolean;
  crearItem: (data: Omit<ItemInventario, 'id' | 'actualizadoAt'>) => Promise<void>;
  moverStock: (input: Omit<MovimientoInventario, 'id' | 'fecha'>) => Promise<void>;
} {
  const qc = useQueryClient();
  const key = ['consorcio-inventario', consorcioId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<{ items: ItemApi[]; movimientos: MovApi[] }>(`/consorcios/${consorcioId}/inventario`);
      return { items: data.items.map(mapItem), movimientos: data.movimientos.map(mapMov) };
    },
    enabled: apiEnabled && !!consorcioId,
    staleTime: 15_000,
  });

  if (!apiEnabled) {
    return {
      items: listarInventarioDe(consorcioId),
      movimientos: listarMovimientosDe(consorcioId),
      cargando: false,
      deApi: false,
      crearItem: async (data) => {
        cargarItem(data);
      },
      moverStock: async (input) => {
        moverStock(input);
      },
    };
  }

  const invalidar = () => qc.invalidateQueries({ queryKey: key });

  return {
    items: q.data?.items ?? [],
    movimientos: q.data?.movimientos ?? [],
    cargando: q.isPending,
    deApi: true,
    crearItem: async (data) => {
      await apiFetch(`/consorcios/${consorcioId}/inventario/items`, {
        method: 'POST',
        body: JSON.stringify({
          categoria: data.categoria,
          nombre: data.nombre,
          unidad: data.unidad,
          cantidadActual: data.cantidadActual,
          minimoStock: data.minimoStock,
          costoUnitario: data.costoUnitario ?? null,
          notas: data.notas ?? null,
        }),
      });
      await invalidar();
    },
    moverStock: async (input) => {
      await apiFetch(`/consorcios/${consorcioId}/inventario/movimientos`, {
        method: 'POST',
        body: JSON.stringify({
          itemId: input.itemId,
          tipo: input.tipo,
          cantidad: input.cantidad,
          motivo: input.motivo,
          ufDestino: input.ufDestino ?? null,
        }),
      });
      await invalidar();
    },
  };
}
