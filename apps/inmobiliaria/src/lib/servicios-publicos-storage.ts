'use client';

/**
 * Datos de servicios públicos por propiedad — pedido del feedback: las
 * inmobiliarias necesitan tener a mano el NIS, número de medidor y
 * distribuidora de cada servicio para poder gestionar reclamos, cortes,
 * cambios de titularidad y para que el inquilino sepa qué subir cuando
 * le piden la boleta del mes.
 *
 * Vive por propiedadId en localStorage. En backend real sería una
 * tabla `ServicioPublico(propiedadId, tipo, distribuidora, nis, medidor)`.
 */

const STORAGE_KEY = 'llave-inmo:servicios-publicos:v1';

export type TipoServicio = 'LUZ' | 'GAS' | 'AGUA' | 'INTERNET' | 'ABL' | 'CABLE';

export interface DatosServicio {
  tipo: TipoServicio;
  distribuidora: string;
  /** Número de cliente / Número de Identificación de Suministro. */
  nis: string;
  numeroMedidor?: string;
  /** Quién está a nombre — útil si todavía no se transfirió. */
  titular?: string;
  /** Tarifa social / categoría residencial habitual. */
  observaciones?: string;
  /** Promedio mensual del último año, para alertas de consumo anómalo. */
  consumoPromedioMensual?: number;
  actualizadoAt: string;
}

type Payload = Record<string, DatosServicio[]>;

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

export function leerServiciosDe(propiedadId: string): DatosServicio[] {
  const all = read();
  const guardados = all[propiedadId];
  if (guardados && guardados.length > 0) return guardados;
  return SEEDS[propiedadId] ?? [];
}

export function guardarServicio(
  propiedadId: string,
  servicio: DatosServicio,
): void {
  const all = read();
  const lista = all[propiedadId] ?? leerServiciosDe(propiedadId).slice();
  const idx = lista.findIndex((s) => s.tipo === servicio.tipo);
  if (idx >= 0) {
    lista[idx] = servicio;
  } else {
    lista.push(servicio);
  }
  all[propiedadId] = lista;
  write(all);
}

export function eliminarServicio(propiedadId: string, tipo: TipoServicio): void {
  const all = read();
  const lista = (all[propiedadId] ?? leerServiciosDe(propiedadId)).filter(
    (s) => s.tipo !== tipo,
  );
  all[propiedadId] = lista;
  write(all);
}

export const TIPO_SERVICIO_LABEL: Record<TipoServicio, string> = {
  LUZ: 'Luz',
  GAS: 'Gas natural',
  AGUA: 'Agua',
  INTERNET: 'Internet',
  ABL: 'ABL / Rentas',
  CABLE: 'Cable / TV',
};

export const DISTRIBUIDORAS_SUGERIDAS: Record<TipoServicio, string[]> = {
  LUZ: ['Edenor', 'Edesur', 'EPEC', 'EDEA', 'Edelap'],
  GAS: ['Metrogas', 'Naturgy', 'Camuzzi', 'Ecogas'],
  AGUA: ['AySA', 'Aguas Cordobesas', 'OSSE', 'Aguas Bonaerenses'],
  INTERNET: ['Fibertel', 'Telecentro', 'Movistar', 'Personal', 'Claro'],
  ABL: ['GCBA · Rentas CABA', 'ARBA', 'DGR Córdoba'],
  CABLE: ['Cablevisión', 'DirecTV', 'Telecentro'],
};

/**
 * Seeds para que el demo arranque con datos visibles en la propiedad
 * principal. Cuando la inmo edite, pasan al storage por propiedad.
 */
const SEEDS: Record<string, DatosServicio[]> = {
  prp_001: [
    {
      tipo: 'LUZ',
      distribuidora: 'Edesur',
      nis: '7841029-3',
      numeroMedidor: 'A21458732',
      titular: 'Mariela Sosa',
      consumoPromedioMensual: 28000,
      observaciones: 'Tarifa residencial categoría N2 · sin tarifa social.',
      actualizadoAt: '2026-02-10T11:00:00.000Z',
    },
    {
      tipo: 'GAS',
      distribuidora: 'Metrogas',
      nis: '07-1234567-0',
      numeroMedidor: 'M0099812',
      titular: 'Mariela Sosa',
      consumoPromedioMensual: 12500,
      actualizadoAt: '2026-02-10T11:00:00.000Z',
    },
    {
      tipo: 'AGUA',
      distribuidora: 'AySA',
      nis: '8801244-001',
      titular: 'Consorcio Gorriti 4521',
      observaciones: 'Va por expensas — no se factura al inquilino.',
      actualizadoAt: '2025-12-01T09:30:00.000Z',
    },
    {
      tipo: 'ABL',
      distribuidora: 'GCBA · Rentas CABA',
      nis: '021-456789-012',
      titular: 'Roberto Iglesias',
      observaciones: 'A cargo del propietario.',
      actualizadoAt: '2026-01-12T08:00:00.000Z',
    },
  ],
};
