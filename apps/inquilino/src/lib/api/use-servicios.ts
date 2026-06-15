'use client';

/**
 * Servicios públicos + boletas del inquilino: API si hay NEXT_PUBLIC_API_URL,
 * localStorage (boletas-servicios-storage) si no — la demo offline sigue intacta.
 *
 * - useServicios(): datos de los servicios públicos de la propiedad (NIS,
 *   distribuidora, medidor) que necesita ver el inquilino para saber qué subir.
 * - useBoletas(): boletas subidas + acciones (subir, marcar pagada, eliminar).
 *   En prod las acciones que tienen endpoint (subir) van de verdad; marcar
 *   pagada / eliminar NO tienen endpoint en el API → se gatean a !apiEnabled.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import {
  type BoletaServicio,
  type TipoServicio,
  guardarBoleta,
  listarBoletasDe,
  marcarBoletaPagada as marcarBoletaPagadaLocal,
  eliminarBoleta as eliminarBoletaLocal,
} from '@/lib/boletas-servicios-storage';
import { contratoMock } from '@/lib/mock-data';

// ===== Servicios públicos de la propiedad =====

export interface ServicioPublico {
  id: string;
  tipo: TipoServicio;
  distribuidora: string;
  nis: string;
  numeroMedidor: string | null;
  titular: string | null;
  observaciones: string | null;
  consumoPromedioMensual: number | null;
}

interface ServicioPublicoApi {
  id: string;
  tipo: TipoServicio;
  distribuidora: string;
  nis: string;
  numeroMedidor: string | null;
  titular: string | null;
  observaciones: string | null;
  consumoPromedioMensual: string | number | null;
}

function mapServicio(s: ServicioPublicoApi): ServicioPublico {
  return {
    id: s.id,
    tipo: s.tipo,
    distribuidora: s.distribuidora,
    nis: s.nis,
    numeroMedidor: s.numeroMedidor ?? null,
    titular: s.titular ?? null,
    observaciones: s.observaciones ?? null,
    consumoPromedioMensual:
      s.consumoPromedioMensual != null ? Number(s.consumoPromedioMensual) : null,
  };
}

export function useServicios(): {
  servicios: ServicioPublico[];
  cargando: boolean;
  deApi: boolean;
} {
  const q = useQuery({
    queryKey: ['mis-servicios'],
    queryFn: () => apiFetch<ServicioPublicoApi[]>('/servicios'),
    enabled: apiEnabled,
    staleTime: 60_000,
  });
  // En modo demo no hay tabla de servicios públicos local: devolvemos vacío
  // (la pantalla lo trata como "sin datos cargados", no rompe nada).
  if (!apiEnabled) return { servicios: [], cargando: false, deApi: false };
  if (q.isError) return { servicios: [], cargando: false, deApi: true };
  return {
    servicios: (q.data ?? []).map(mapServicio),
    cargando: q.isPending,
    deApi: true,
  };
}

// ===== Boletas =====

// Shape de la fila Prisma BoletaServicio devuelta por GET/POST /boletas.
interface BoletaApi {
  id: string;
  contratoId: string;
  tipo: TipoServicio;
  periodo: string;
  monto: string | number;
  vencimiento: string; // ISO DateTime
  estado: BoletaServicio['estado'];
  nombreArchivo: string;
  tipoMime: string;
  tamanioBytes: number;
  archivoUrl: string;
  subidoAt: string; // ISO DateTime
  pagadoAt: string | null;
  notas: string | null;
}

function mapBoleta(b: BoletaApi): BoletaServicio {
  return {
    id: b.id,
    contratoId: b.contratoId,
    tipo: b.tipo,
    periodo: b.periodo,
    monto: Number(b.monto),
    vencimiento: (b.vencimiento ?? '').slice(0, 10),
    estado: b.estado,
    nombreArchivo: b.nombreArchivo,
    tipoMime: b.tipoMime,
    tamanioBytes: b.tamanioBytes,
    // El API guarda la URL del archivo en archivoUrl; la UI usa dataUrl para el
    // <img>/download. Mapeamos uno al otro.
    dataUrl: b.archivoUrl,
    subidoAt: b.subidoAt,
    pagadoAt: b.pagadoAt ?? undefined,
    notas: b.notas ?? undefined,
  };
}

export interface SubirBoletaInput {
  servicio: TipoServicio;
  periodo: string;
  monto: number;
  vencimiento?: string;
  nombreArchivo?: string;
  tipoMime?: string;
  tamanioBytes?: number;
  /** Solo demo: dataUrl del archivo para previsualizar/descargar offline. */
  dataUrl?: string;
}

export function useBoletas(): {
  boletas: BoletaServicio[];
  cargando: boolean;
  hidratado: boolean;
  deApi: boolean;
  /** Habilitadas solo cuando hay endpoint (prod) o en demo local. */
  puedeGestionar: boolean;
  subirBoleta: (input: SubirBoletaInput) => Promise<void>;
  marcarPagada: (b: BoletaServicio) => Promise<void>;
  eliminar: (b: BoletaServicio) => Promise<void>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['mis-boletas'],
    queryFn: () => apiFetch<BoletaApi[]>('/boletas'),
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['mis-boletas'] });

  // ===== Modo demo (sin API): localStorage como hoy =====
  if (!apiEnabled) {
    const boletas = listarBoletasDe(contratoMock.id);
    return {
      boletas,
      cargando: false,
      hidratado: true,
      deApi: false,
      puedeGestionar: true,
      subirBoleta: async (input) => {
        guardarBoleta({
          id: `bol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          contratoId: contratoMock.id,
          tipo: input.servicio,
          periodo: input.periodo,
          monto: input.monto,
          vencimiento: input.vencimiento || new Date().toISOString().slice(0, 10),
          estado: 'SUBIDA',
          nombreArchivo: input.nombreArchivo ?? `boleta-${input.servicio.toLowerCase()}-${input.periodo}.pdf`,
          tipoMime: input.tipoMime ?? 'application/octet-stream',
          tamanioBytes: input.tamanioBytes ?? 0,
          // En demo guardamos el dataUrl del archivo subido (lo pasa la página).
          dataUrl: input.dataUrl ?? '',
          subidoAt: new Date().toISOString(),
        });
      },
      marcarPagada: async (b) => {
        marcarBoletaPagadaLocal(b.contratoId, b.id);
      },
      eliminar: async (b) => {
        eliminarBoletaLocal(b.contratoId, b.id);
      },
    };
  }

  // ===== Modo API (prod) =====
  if (q.isError) {
    return {
      boletas: [],
      cargando: false,
      hidratado: true,
      deApi: true,
      puedeGestionar: false,
      subirBoleta: async () => {},
      marcarPagada: async () => {},
      eliminar: async () => {},
    };
  }

  return {
    boletas: (q.data ?? []).map(mapBoleta),
    cargando: q.isPending,
    hidratado: !q.isPending,
    deApi: true,
    // marcar pagada / eliminar NO tienen endpoint en el API → deshabilitadas en prod.
    puedeGestionar: false,
    subirBoleta: async (input) => {
      await apiFetch('/boletas', {
        method: 'POST',
        body: JSON.stringify({
          servicio: input.servicio,
          periodo: input.periodo,
          monto: input.monto,
          ...(input.vencimiento ? { vencimiento: input.vencimiento } : {}),
          ...(input.nombreArchivo ? { nombreArchivo: input.nombreArchivo } : {}),
          ...(input.tipoMime ? { tipoMime: input.tipoMime } : {}),
          ...(input.tamanioBytes != null ? { tamanioBytes: input.tamanioBytes } : {}),
        }),
      });
      invalidar();
    },
    marcarPagada: async () => {},
    eliminar: async () => {},
  };
}
