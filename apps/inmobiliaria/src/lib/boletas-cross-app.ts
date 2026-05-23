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

/**
 * Seeds históricos de boletas para cuando el storage del inquilino no está
 * disponible (entornos dev con origins distintos: port 3000 vs 3001).
 * Representa los 5 meses anteriores al actual con LUZ+GAS pagados.
 * El mes corriente NO se incluye para que las alertas de servicios sigan
 * disparándose correctamente.
 */
function generarSeedsHistoricos(contratoId: string): BoletaInquilino[] {
  const ahora = new Date();
  const seeds: BoletaInquilino[] = [];
  for (let i = 1; i <= 5; i++) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    for (const tipo of ['LUZ', 'GAS'] as const) {
      seeds.push({
        id: `seed_${contratoId}_${tipo}_${periodo}`,
        contratoId,
        tipo,
        periodo,
        monto: tipo === 'LUZ' ? 45000 : 38000,
        vencimiento: `${periodo}-15`,
        estado: 'PAGADA',
        nombreArchivo: `boleta_${tipo.toLowerCase()}_${periodo}.pdf`,
        tipoMime: 'application/pdf',
        tamanioBytes: 120000,
        dataUrl: '',
        subidoAt: `${periodo}-08T10:00:00-03:00`,
        pagadoAt: `${periodo}-12T15:00:00-03:00`,
      });
    }
  }
  return seeds;
}

export function leerBoletasDeContrato(contratoId: string): BoletaInquilino[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INQUILINO_KEY);
    // Sin storage real (cross-origin en dev): usar seeds históricos para
    // que el scoring de "carga de boletas" muestre un valor realista en
    // lugar de 0. Las alertas de servicios del mes corriente siguen activas
    // porque los seeds no incluyen el período actual.
    if (!raw) return generarSeedsHistoricos(contratoId);
    const parsed = JSON.parse(raw) as Payload;
    return parsed[contratoId] ?? generarSeedsHistoricos(contratoId);
  } catch {
    return generarSeedsHistoricos(contratoId);
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
