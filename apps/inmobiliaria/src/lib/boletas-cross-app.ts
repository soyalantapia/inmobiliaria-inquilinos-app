'use client';

/**
 * Lectura cross-app de las boletas de servicios que sube el inquilino.
 * Las dos apps comparten origin (github.io o localhost dev), así que el
 * storage del inquilino (`llave:boletas-servicios:v1`) está visible.
 *
 * Solo lectura — la inmo no escribe sobre el storage del inquilino. Si
 * la inmo quiere marcar algo como "confirmado", lo persistimos en un
 * storage propio (no implementado todavía).
 */

const INQUILINO_KEY = 'llave:boletas-servicios:v1';

export type TipoServicioBoleta =
  | 'LUZ'
  | 'GAS'
  | 'AGUA'
  | 'INTERNET'
  | 'ABL'
  | 'CABLE';
export type EstadoBoletaInquilino = 'SUBIDA' | 'PAGADA' | 'EN_REVISION';

export interface BoletaInquilino {
  id: string;
  contratoId: string;
  tipo: TipoServicioBoleta;
  periodo: string;
  monto: number;
  vencimiento: string;
  estado: EstadoBoletaInquilino;
  nombreArchivo: string;
  tipoMime: string;
  tamanioBytes: number;
  dataUrl: string;
  subidoAt: string;
  pagadoAt?: string;
}

type Payload = Record<string, BoletaInquilino[]>;

export function leerBoletasDeContrato(contratoId: string): BoletaInquilino[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INQUILINO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Payload;
    return parsed[contratoId] ?? [];
  } catch {
    return [];
  }
}

export const TIPO_BOLETA_LABEL: Record<TipoServicioBoleta, string> = {
  LUZ: 'Luz',
  GAS: 'Gas',
  AGUA: 'Agua',
  INTERNET: 'Internet',
  ABL: 'ABL',
  CABLE: 'Cable',
};

export const ESTADO_BOLETA_LABEL: Record<EstadoBoletaInquilino, string> = {
  SUBIDA: 'Subida',
  PAGADA: 'Pagada',
  EN_REVISION: 'En revisión',
};

export function formatPeriodoBoleta(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  if (!anio || !mes) return periodo;
  const fecha = new Date(parseInt(anio, 10), parseInt(mes, 10) - 1, 1);
  return fecha.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
}
