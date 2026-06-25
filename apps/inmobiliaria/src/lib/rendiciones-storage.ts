'use client';

/**
 * Storage de rendiciones a propietarios. Cuando el admin marca como
 * "rendido" el pago del mes para un propietario, queda persistido acá
 * para que el badge de la card y los KPIs reflejen el estado real.
 *
 * En backend real esto vive en una tabla `rendicion` (propietario, periodo,
 * monto, comprobante, fecha). Acá lo simulamos en localStorage.
 */

const STORAGE_KEY = 'llave-inmo:rendiciones:v1';

/** Snapshot del gasto que se descontó al cerrar la rendición. Congelamos
 *  estos datos para que el comprobante histórico siga siendo consistente
 *  aunque después se editen los movimientos de origen. */
export interface GastoRendido {
  refId: string;
  tipo: 'CAJA' | 'TRABAJO';
  fecha: string;
  descripcion: string;
  proveedor: string | null;
  monto: number;
  montoTotal: number;
  participacion: number;
  propiedadId: string;
  direccion: string;
}

export interface Rendicion {
  id: string;
  propietarioId: string;
  /** YYYY-MM, ej "2026-05". */
  periodo: string;
  montoBruto: number;
  comisionPct: number;
  /** Gastos descontados al propietario (de caja + reclamos DESPERFECTO). */
  gastos?: GastoRendido[];
  /** Suma de gastos.monto — denormalizado para evitar recalcular. */
  totalGastos?: number;
  montoNeto: number;
  rendidoAt: string;
  /** Método (transferencia, mercadopago, efectivo). */
  metodo: 'TRANSFERENCIA' | 'MERCADOPAGO' | 'EFECTIVO';
  notas: string | null;
}

type Payload = Record<string, Rendicion>;

function read(): Payload {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Payload;
  } catch {
    return {};
  }
}

function write(payload: Payload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function key(propietarioId: string, periodo: string): string {
  return `${propietarioId}_${periodo}`;
}

export function obtenerRendicion(
  propietarioId: string,
  periodo: string,
): Rendicion | null {
  return read()[key(propietarioId, periodo)] ?? null;
}

export function marcarRendido(input: {
  propietarioId: string;
  periodo: string;
  montoBruto: number;
  comisionPct: number;
  /** Gastos atribuidos al propietario (caja + trabajos DESPERFECTO). */
  gastos?: GastoRendido[];
  metodo: Rendicion['metodo'];
  notas?: string;
}): Rendicion {
  const comisionMonto = Math.round(input.montoBruto * (input.comisionPct / 100));
  const totalGastos = (input.gastos ?? []).reduce((s, g) => s + g.monto, 0);
  // Nunca negativo (gastos > bruto−comisión): el preview del dialog ya clampa a 0,
  // y el path API rechaza con 409 — espejamos acá para no persistir/mostrar negativos.
  const montoNeto = Math.max(0, input.montoBruto - comisionMonto - totalGastos);
  const rendicion: Rendicion = {
    id: `rend_${Date.now().toString(36)}`,
    propietarioId: input.propietarioId,
    periodo: input.periodo,
    montoBruto: input.montoBruto,
    comisionPct: input.comisionPct,
    gastos: input.gastos ?? [],
    totalGastos,
    montoNeto,
    rendidoAt: new Date().toISOString(),
    metodo: input.metodo,
    notas: input.notas ?? null,
  };
  const all = read();
  all[key(input.propietarioId, input.periodo)] = rendicion;
  write(all);
  return rendicion;
}

export function revertirRendicion(propietarioId: string, periodo: string): void {
  const all = read();
  delete all[key(propietarioId, periodo)];
  write(all);
}

export function listarRendicionesDePropietario(propietarioId: string): Rendicion[] {
  return Object.values(read())
    .filter((r) => r.propietarioId === propietarioId)
    .sort((a, b) => b.rendidoAt.localeCompare(a.rendidoAt));
}

/** Periodo actual en formato YYYY-MM. */
export function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
