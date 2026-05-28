'use client';

/**
 * Boletas de servicios públicos que sube el inquilino — luz, gas, agua,
 * ABL, internet, cable. La inmobiliaria las ve cross-app y puede
 * confirmar el pago o pedir aclaración.
 *
 * Pedido del feedback: "el inquilino sube la boleta del mes y nosotros
 * la archivamos contra la propiedad para tener todo el historial".
 *
 * Storage local con dataUrl (mock). En backend real esto sería S3 +
 * tabla BoletaServicio con FK a contrato/propiedad.
 */

const STORAGE_KEY = 'llave:boletas-servicios:v1';

export type TipoServicio = 'LUZ' | 'GAS' | 'AGUA' | 'INTERNET' | 'ABL' | 'CABLE';
export type EstadoBoleta = 'SUBIDA' | 'PAGADA' | 'EN_REVISION';

export interface BoletaServicio {
  id: string;
  contratoId: string;
  tipo: TipoServicio;
  /** Período "YYYY-MM" al que corresponde la boleta. */
  periodo: string;
  monto: number;
  vencimiento: string; // ISO
  estado: EstadoBoleta;
  nombreArchivo: string;
  tipoMime: string;
  tamanioBytes: number;
  dataUrl: string;
  subidoAt: string;
  pagadoAt?: string;
  notas?: string;
}

type Payload = Record<string, BoletaServicio[]>;

function read(): Payload {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Payload;
  } catch {
    // ignore
  }
  return SEEDS;
}

function write(p: Payload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function listarBoletasDe(contratoId: string): BoletaServicio[] {
  const all = read();
  return (all[contratoId] ?? []).sort((a, b) =>
    b.periodo.localeCompare(a.periodo) || b.subidoAt.localeCompare(a.subidoAt),
  );
}

export function guardarBoleta(boleta: BoletaServicio): void {
  const all = read();
  const lista = all[boleta.contratoId] ?? [];
  lista.unshift(boleta);
  all[boleta.contratoId] = lista;
  write(all);
}

export function marcarBoletaPagada(contratoId: string, id: string): void {
  const all = read();
  const lista = all[contratoId] ?? [];
  const idx = lista.findIndex((b) => b.id === id);
  if (idx >= 0) {
    lista[idx] = {
      ...lista[idx]!,
      estado: 'PAGADA',
      pagadoAt: new Date().toISOString(),
    };
    all[contratoId] = lista;
    write(all);
  }
}

export function eliminarBoleta(contratoId: string, id: string): void {
  const all = read();
  const lista = (all[contratoId] ?? []).filter((b) => b.id !== id);
  all[contratoId] = lista;
  write(all);
}

export function leerArchivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function formatTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const TIPO_LABEL: Record<TipoServicio, string> = {
  LUZ: 'Luz',
  GAS: 'Gas',
  AGUA: 'Agua',
  INTERNET: 'Internet',
  ABL: 'ABL',
  CABLE: 'Cable',
};

export const ESTADO_LABEL: Record<EstadoBoleta, string> = {
  // "Subida" era ambiguo para servicios públicos en Argentina —
  // se podía leer como "la tarifa subió". "Cargada" describe la
  // acción real (la boleta está cargada en la app, pendiente de pago).
  SUBIDA: 'Cargada',
  PAGADA: 'Pagada',
  EN_REVISION: 'En revisión',
};

export const TAMANIO_MAX = 2 * 1024 * 1024;

/**
 * Convierte "2026-04" → "Abr 2026". Capitalizamos manualmente porque
 * toLocaleDateString en es-AR devuelve "abr" en minúscula, y "Luz · abr 2026"
 * se leía como typo en la lista.
 */
export function formatPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  if (!anio || !mes) return periodo;
  const fecha = new Date(parseInt(anio, 10), parseInt(mes, 10) - 1, 1);
  const raw = fecha.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Seed con dos boletas del mes pasado pagadas + una del mes actual
 * para que la pantalla arranque con historial visible en el demo.
 * dataUrl placeholder (1x1 png base64) — solo para que abra como
 * imagen sin romper.
 */
const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const SEEDS: Payload = {
  cnt_001: [
    {
      id: 'bol-seed-1',
      contratoId: 'cnt_001',
      tipo: 'LUZ',
      periodo: '2026-04',
      monto: 32400,
      vencimiento: '2026-05-08',
      estado: 'PAGADA',
      nombreArchivo: 'Edesur-Abril-2026.pdf',
      tipoMime: 'application/pdf',
      tamanioBytes: 184230,
      dataUrl: PLACEHOLDER,
      subidoAt: '2026-04-30T11:24:00.000Z',
      pagadoAt: '2026-05-07T09:00:00.000Z',
    },
    {
      id: 'bol-seed-2',
      contratoId: 'cnt_001',
      tipo: 'GAS',
      periodo: '2026-04',
      monto: 18900,
      vencimiento: '2026-05-12',
      estado: 'PAGADA',
      nombreArchivo: 'Metrogas-Abr.pdf',
      tipoMime: 'application/pdf',
      tamanioBytes: 142100,
      dataUrl: PLACEHOLDER,
      subidoAt: '2026-04-28T15:11:00.000Z',
      pagadoAt: '2026-05-05T10:30:00.000Z',
    },
    {
      id: 'bol-seed-3',
      contratoId: 'cnt_001',
      tipo: 'LUZ',
      periodo: '2026-05',
      monto: 34200,
      vencimiento: '2026-06-08',
      estado: 'SUBIDA',
      nombreArchivo: 'Edesur-mayo.jpg',
      tipoMime: 'image/jpeg',
      tamanioBytes: 421120,
      dataUrl: PLACEHOLDER,
      subidoAt: '2026-05-20T14:08:00.000Z',
    },
  ],
};
