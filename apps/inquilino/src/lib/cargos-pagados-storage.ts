'use client';

/**
 * Registro de cargos USO_Y_GOCE que el inquilino ya pagó. Cuando el
 * inquilino paga el alquiler vencido o un cargo puntual, marcamos los
 * cargos como pagados acá. El storage es del inquilino pero el inmo lo
 * lee cross-app para saber qué cargos siguen pendientes de cobro.
 *
 * En backend real es una tabla `CargoPagado` con FK a reclamo. Acá vive
 * en localStorage como mapa por reclamoId.
 */

const STORAGE_KEY = 'llave:cargos-pagados:v1';

export interface CargoPagado {
  reclamoId: string;
  monto: number;
  pagadoAt: string; // ISO
  metodo: 'TRANSFERENCIA' | 'MERCADOPAGO' | 'OTRO';
}

type Payload = Record<string, CargoPagado>;

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

export function listarCargosPagados(): Record<string, CargoPagado> {
  return read();
}

export function estaPagado(reclamoId: string): boolean {
  return !!read()[reclamoId];
}

export function marcarCargoPagado(input: {
  reclamoId: string;
  monto: number;
  metodo?: CargoPagado['metodo'];
}): CargoPagado {
  const cargo: CargoPagado = {
    reclamoId: input.reclamoId,
    monto: input.monto,
    pagadoAt: new Date().toISOString(),
    metodo: input.metodo ?? 'TRANSFERENCIA',
  };
  const all = read();
  all[input.reclamoId] = cargo;
  write(all);
  return cargo;
}

export function marcarVariosPagados(
  reclamoIds: string[],
  metodo: CargoPagado['metodo'] = 'TRANSFERENCIA',
): void {
  const all = read();
  const ahora = new Date().toISOString();
  for (const id of reclamoIds) {
    if (all[id]) continue; // ya estaba
    all[id] = { reclamoId: id, monto: 0, pagadoAt: ahora, metodo };
  }
  write(all);
}
