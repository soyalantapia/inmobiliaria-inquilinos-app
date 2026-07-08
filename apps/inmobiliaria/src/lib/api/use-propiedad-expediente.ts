'use client';

/**
 * Expediente de vida de la propiedad: salud de pago (morosidad + puntualidad + depósito),
 * seguros/garantías y línea de tiempo. Cada uno de un endpoint /propiedades/:id/*. Solo
 * modo API; en demo los componentes que los usan se ocultan.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import type { EstadoContrato, Moneda } from '@/lib/types';

/* ---------- Salud de pago ---------- */
export interface SaludPagoContrato {
  contratoId: string;
  inquilino: string;
  estado: EstadoContrato;
  moneda: Moneda;
  deudaImpaga: number;
  cuotasVencidas: number;
  cuotasPagadas: number;
  pagadasATiempo: number;
  pagadasTarde: number;
  diasAtrasoPromedio: number;
  puntualidadPct: number | null;
  deposito: { monto: number; estado: string | null; devueltoMonto: number | null; devueltoAt: string | null } | null;
}
export interface SaludPago {
  totales: {
    deudaImpagaPorMoneda: Record<string, number>;
    cuotasVencidas: number;
    cuotasPagadas: number;
    pagadasATiempo: number;
    pagadasTarde: number;
    puntualidadPct: number | null;
  };
  contratos: SaludPagoContrato[];
}

/* ---------- Seguros / garantías ---------- */
export interface Garantia {
  id: string;
  contratoId: string;
  contratoEstado: EstadoContrato | null;
  inquilino: string;
  tipo: string;
  esPoliza: boolean;
  nombre: string;
  numeroPoliza: string | null;
  montoCobertura: number | null;
  vigenciaHasta: string | null;
  estadoPoliza: 'VIGENTE' | 'POR_VENCER' | 'VENCIDA' | null;
  diasParaVencer: number | null;
}
export interface Seguros {
  garantias: Garantia[];
  alertas: { vencidas: number; porVencer: number };
}

/* ---------- Timeline ---------- */
export interface EventoTimeline {
  fecha: string;
  tipo: string;
  titulo: string;
  detalle: string;
  contratoId: string;
  inquilino: string;
}

function usePropiedadRecurso<T>(id: string, recurso: string, key: string) {
  const q = useQuery({
    queryKey: [key, id],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<T>(`/propiedades/${id}/${recurso}`);
    },
    enabled: apiEnabled && id.length > 0,
    staleTime: 30_000,
    retry: false,
  });
  return { data: q.data ?? null, cargando: q.isPending };
}

export function usePropiedadSaludPago(id: string) {
  return usePropiedadRecurso<SaludPago>(id, 'salud-pago', 'propiedad-salud-pago');
}
export function usePropiedadSeguros(id: string) {
  return usePropiedadRecurso<Seguros>(id, 'seguros', 'propiedad-seguros');
}
export function usePropiedadTimeline(id: string) {
  return usePropiedadRecurso<{ eventos: EventoTimeline[] }>(id, 'timeline', 'propiedad-timeline');
}

/* ---------- Gastos / mantenimiento ---------- */
export interface GastoItem {
  id: string;
  categoria: string;
  descripcion: string;
  monto: number;
  fecha: string;
  proveedor: string | null;
  contratoId: string | null;
  comprobanteUrl: string | null;
}
export interface Gastos {
  total: number;
  cantidad: number;
  porCategoria: Record<string, { monto: number; cantidad: number }>;
  gastos: GastoItem[];
}
export function usePropiedadGastos(id: string) {
  return usePropiedadRecurso<Gastos>(id, 'gastos', 'propiedad-gastos');
}

/* ---------- Documentos ---------- */
export interface DocumentoItem {
  id: string;
  contratoId: string;
  tipo: string;
  etiqueta: string;
  nombreArchivo: string;
  tipoMime: string;
  tamanioBytes: number;
  archivoUrl: string;
  subidoAt: string;
  inquilino: string;
}
export function usePropiedadDocumentos(id: string) {
  return usePropiedadRecurso<{ documentos: DocumentoItem[] }>(id, 'documentos', 'propiedad-documentos');
}
