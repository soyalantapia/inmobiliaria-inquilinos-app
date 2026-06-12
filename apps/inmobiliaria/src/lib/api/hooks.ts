'use client';

/**
 * Hooks de datos del panel: API si hay NEXT_PUBLIC_API_URL, mocks si no.
 * Los adaptadores devuelven los MISMOS tipos que usan las pantallas
 * (ContratoListado, etc.) para que la migración sea transparente.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import { contratosMock } from '@/lib/mock-data';
import type { ContratoListado } from '@/lib/types';
import {
  cargarMovimiento as cargarMovimientoLocal,
  eliminarMovimiento as eliminarMovimientoLocal,
  listarMovimientosCaja,
  type MovimientoCaja,
} from '@/lib/caja-storage';

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

// ===== Anuncios (acuses REALES del server) =====

import {
  contarAcuses,
  contarDestinatarios,
  crearAnuncio as crearAnuncioLocal,
  eliminarAnuncio as eliminarAnuncioLocal,
  listarAnuncios,
  type Anuncio,
} from '@/lib/anuncios-storage';

export type AnuncioConConteos = Anuncio & {
  conteos?: { leido: number; confirmado: number; total: number };
};

interface AnuncioApi extends Omit<Anuncio, 'enviadoAt'> {
  enviadoAt: string;
  conteos: { leido: number; confirmado: number; total: number };
}

export interface NuevoAnuncio {
  titulo: string;
  cuerpo: string;
  prioridad: Anuncio['prioridad'];
  audiencia: Anuncio['audiencia'];
  audienciaIds?: string[];
}

export function useAnuncios(): {
  anuncios: AnuncioConConteos[];
  cargando: boolean;
  crear: (a: NuevoAnuncio) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['anuncios'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<AnuncioApi[]>('/anuncios');
      return data as AnuncioConConteos[];
    },
    enabled: apiEnabled,
    staleTime: 10_000,
    refetchInterval: 30_000, // los acuses de los inquilinos van llegando
  });
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['anuncios'] });

  if (!apiEnabled || q.isError) {
    return {
      anuncios: listarAnuncios().map((a) => ({ ...a, conteos: { ...contarAcuses(a), total: a.destinatariosCount } })),
      cargando: false,
      crear: async (input) => {
        crearAnuncioLocal({
          ...input,
          audienciaIds: input.audienciaIds ?? [],
          canales: ['APP', 'EMAIL'],
          enviadoPor: 'Roberto Tapia',
          destinatariosCount: contarDestinatarios(input.audiencia, input.audienciaIds ?? []),
        });
      },
      eliminar: async (id) => {
        eliminarAnuncioLocal(id);
      },
    };
  }

  return {
    anuncios: q.data ?? [],
    cargando: q.isPending,
    crear: async (input) => {
      await apiFetch('/anuncios', { method: 'POST', body: JSON.stringify(input) });
      invalidar();
    },
    eliminar: async (id) => {
      await apiFetch(`/anuncios/${id}`, { method: 'DELETE' });
      invalidar();
    },
  };
}

// ===== Aprobaciones =====

import {
  aprobar as aprobarLocal,
  listarAprobaciones,
  rechazar as rechazarLocal,
  type Aprobacion,
} from '@/lib/aprobaciones-storage';

interface AprobacionApi extends Omit<Aprobacion, 'cargadoPor' | 'monto' | 'aprobadoPor'> {
  monto: string | number | null;
  cargadoPor: { nombre: string; apellido: string; rol: string };
  aprobadoPorId: string | null;
}

function mapAprobacion(a: AprobacionApi): Aprobacion {
  return {
    ...a,
    monto: a.monto != null ? Number(a.monto) : undefined,
    cargadoPor: `${a.cargadoPor.nombre} ${a.cargadoPor.apellido}`.trim(),
    aprobadoPor: a.aprobadoPorId ?? undefined,
  } as Aprobacion;
}

export function useAprobaciones(): {
  aprobaciones: Aprobacion[];
  cargando: boolean;
  aprobarApi: (id: string, pin: string, comentario?: string) => Promise<Aprobacion>;
  rechazarApi: (id: string, pin: string, motivo: string) => Promise<Aprobacion>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['aprobaciones'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<AprobacionApi[]>('/aprobaciones');
      return data.map(mapAprobacion);
    },
    enabled: apiEnabled,
    staleTime: 10_000,
  });
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['aprobaciones'] });

  if (!apiEnabled || q.isError) {
    return {
      aprobaciones: listarAprobaciones(),
      cargando: false,
      aprobarApi: async (id, _pin, comentario) => {
        const r = aprobarLocal(id, 'Roberto Tapia', comentario);
        if (!r) throw new Error('No se pudo aprobar');
        return r;
      },
      rechazarApi: async (id, _pin, motivo) => {
        const r = rechazarLocal(id, 'Roberto Tapia', motivo);
        if (!r) throw new Error('No se pudo rechazar');
        return r;
      },
    };
  }

  return {
    aprobaciones: q.data ?? [],
    cargando: q.isPending,
    aprobarApi: async (id, pin, comentario) => {
      const r = await apiFetch<AprobacionApi>(`/aprobaciones/${id}/aprobar`, {
        method: 'POST',
        body: JSON.stringify({ pin, comentario }),
      });
      invalidar();
      void qc.invalidateQueries({ queryKey: ['contratos'] }); // aprobar contrato lo activa
      return mapAprobacion(r);
    },
    rechazarApi: async (id, pin, motivo) => {
      const r = await apiFetch<AprobacionApi>(`/aprobaciones/${id}/rechazar`, {
        method: 'POST',
        body: JSON.stringify({ pin, comentario: motivo }),
      });
      invalidar();
      return mapAprobacion(r);
    },
  };
}

// ===== Caja de gastos =====

interface MovimientoCajaApi {
  id: string;
  propiedadId: string;
  contratoId: string | null;
  tipo: MovimientoCaja['tipo'];
  categoria: MovimientoCaja['categoria'];
  descripcion: string;
  monto: string | number;
  fecha: string;
  proveedor: string | null;
  comprobanteUrl: string | null;
  cargadoPor: string;
  createdAt: string;
  descontadoEnRendicion: boolean;
}

function mapMovimiento(m: MovimientoCajaApi): MovimientoCaja {
  return {
    id: m.id,
    propiedadId: m.propiedadId,
    contratoId: m.contratoId,
    tipo: m.tipo,
    categoria: m.categoria,
    descripcion: m.descripcion,
    monto: Number(m.monto),
    fecha: m.fecha.slice(0, 10),
    proveedor: m.proveedor,
    comprobante: m.comprobanteUrl,
    cargadoPor: m.cargadoPor,
    createdAt: m.createdAt,
    descontadoEnRendicion: m.descontadoEnRendicion,
  };
}

export interface NuevoGasto {
  propiedadId: string;
  categoria: MovimientoCaja['categoria'];
  descripcion: string;
  monto: number;
  fecha: string;
  proveedor?: string | null;
}

export function useCaja(): {
  movimientos: MovimientoCaja[];
  cargando: boolean;
  crearGasto: (g: NuevoGasto) => Promise<void>;
  eliminarGasto: (id: string, pin: string) => Promise<void>;
  refrescar: () => void;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['caja'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<MovimientoCajaApi[]>('/caja/movimientos');
      return data.map(mapMovimiento);
    },
    enabled: apiEnabled,
    staleTime: 10_000,
  });
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['caja'] });

  if (!apiEnabled || q.isError) {
    // Modo local (o API caída): mismo contrato de funciones sobre localStorage
    return {
      movimientos: listarMovimientosCaja(),
      cargando: false,
      crearGasto: async (g) => {
        cargarMovimientoLocal({
          propiedadId: g.propiedadId,
          contratoId: null,
          tipo: 'GASTO',
          categoria: g.categoria,
          descripcion: g.descripcion,
          monto: g.monto,
          fecha: g.fecha,
          proveedor: g.proveedor ?? null,
          comprobante: null,
          cargadoPor: 'Roberto Tapia',
        });
      },
      eliminarGasto: async (id) => {
        eliminarMovimientoLocal(id);
      },
      refrescar: invalidar,
    };
  }

  return {
    movimientos: q.data ?? [],
    cargando: q.isPending,
    crearGasto: async (g) => {
      await apiFetch('/caja/movimientos', { method: 'POST', body: JSON.stringify(g) });
      invalidar();
    },
    eliminarGasto: async (id, pin) => {
      await apiFetch(`/caja/movimientos/${id}`, { method: 'DELETE', body: JSON.stringify({ pin }) });
      invalidar();
    },
    refrescar: invalidar,
  };
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
