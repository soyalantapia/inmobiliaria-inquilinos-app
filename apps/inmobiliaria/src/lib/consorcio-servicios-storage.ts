'use client';

/**
 * Servicios técnicos comunes del consorcio (luz de pasillo, ascensor, gas
 * central, agua corriente del edificio, ABL del consorcio, etc.). Pedido
 * del feedback: "necesito tener el NIS del medidor del ascensor a mano
 * para llamar a Edesur sin tener que pedirle al encargado".
 *
 * Es paralelo a `servicios-publicos-storage.ts` (que opera a nivel de
 * unidad individual). Acá guardamos lo que paga el consorcio como un
 * todo.
 */

const STORAGE_KEY = 'llave-inmo:consorcio-servicios:v1';

export type TipoServicioConsorcio =
  | 'LUZ_PASILLO'
  | 'GAS_CENTRAL'
  | 'AGUA_GENERAL'
  | 'ASCENSOR'
  | 'CALEFACCION_CENTRAL'
  | 'ABL'
  | 'OTRO';

export interface ServicioComun {
  tipo: TipoServicioConsorcio;
  proveedor: string;
  nis: string;
  numeroMedidor?: string;
  /** Costo promedio mensual para anticipar la liquidación. */
  costoPromedioMensual?: number;
  /** Notas extras (titular, tarifa especial). */
  observaciones?: string;
  actualizadoAt: string;
}

type Payload = Record<string, ServicioComun[]>;

function read(): Payload {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Payload) : {};
  } catch {
    return {};
  }
}

function write(p: Payload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function leerServiciosDeConsorcio(consorcioId: string): ServicioComun[] {
  const all = read();
  const guardados = all[consorcioId];
  if (guardados && guardados.length > 0) return guardados;
  return SEEDS[consorcioId] ?? [];
}

export function guardarServicioConsorcio(
  consorcioId: string,
  servicio: ServicioComun,
): void {
  const all = read();
  const lista = all[consorcioId] ?? leerServiciosDeConsorcio(consorcioId).slice();
  const idx = lista.findIndex((s) => s.tipo === servicio.tipo);
  if (idx >= 0) {
    lista[idx] = servicio;
  } else {
    lista.push(servicio);
  }
  all[consorcioId] = lista;
  write(all);
}

export function eliminarServicioConsorcio(
  consorcioId: string,
  tipo: TipoServicioConsorcio,
): void {
  const all = read();
  const lista = (
    all[consorcioId] ?? leerServiciosDeConsorcio(consorcioId)
  ).filter((s) => s.tipo !== tipo);
  all[consorcioId] = lista;
  write(all);
}

export const TIPO_SERVICIO_CONSORCIO_LABEL: Record<TipoServicioConsorcio, string> = {
  LUZ_PASILLO: 'Luz de pasillos / consorcial',
  GAS_CENTRAL: 'Gas central',
  AGUA_GENERAL: 'Agua del edificio',
  ASCENSOR: 'Mantenimiento ascensor',
  CALEFACCION_CENTRAL: 'Calefacción central',
  ABL: 'ABL del consorcio',
  OTRO: 'Otro servicio común',
};

const SEEDS: Record<string, ServicioComun[]> = {
  cnsr_001: [
    {
      tipo: 'LUZ_PASILLO',
      proveedor: 'Edesur',
      nis: '442187-5',
      numeroMedidor: 'C1098721',
      costoPromedioMensual: 95000,
      observaciones: 'Tarifa T2 · 3 fases · medidor en hall PB.',
      actualizadoAt: '2026-02-12T10:00:00.000Z',
    },
    {
      tipo: 'ASCENSOR',
      proveedor: 'Ascensores Otis · contrato anual',
      nis: 'OT-12-CNSR-001',
      costoPromedioMensual: 230000,
      observaciones:
        'Mantenimiento mensual + 2 visitas técnicas anuales + cuota seguro.',
      actualizadoAt: '2026-01-15T15:30:00.000Z',
    },
    {
      tipo: 'AGUA_GENERAL',
      proveedor: 'AySA',
      nis: '88011287-002',
      observaciones:
        'Va a expensas — el consumo grueso se asigna por coeficiente.',
      actualizadoAt: '2026-02-12T10:00:00.000Z',
    },
    {
      tipo: 'ABL',
      proveedor: 'GCBA · Rentas CABA',
      nis: '021-554789-001',
      costoPromedioMensual: 142000,
      observaciones: 'Titular: Consorcio Gorriti 4521.',
      actualizadoAt: '2026-01-20T09:00:00.000Z',
    },
  ],
};
