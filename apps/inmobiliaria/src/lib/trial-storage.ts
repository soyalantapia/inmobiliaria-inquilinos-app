'use client';

/**
 * Trial gratuito para promotores estratégicos (típicamente 6 meses).
 * Lo activa el equipo de ventas desde el backend. Mientras está activo,
 * no se cobran las facturas y aparece un banner con countdown.
 */

const STORAGE_KEY = 'llave-inmo:trial:v1';

export interface Trial {
  /** Slug interno. */
  tipo: 'PROMOTOR' | 'LANZAMIENTO' | 'CUSTOM';
  /** Texto descriptivo (ej. "Trial 6 meses · acuerdo con CUCICBA"). */
  motivo: string;
  /** Fecha desde la cual está vigente. */
  desde: string;
  /** Fecha hasta la cual es gratis. */
  hasta: string;
  activadoPor: string;
}

const DEFAULT_TRIAL: Trial | null = null;

export function leerTrial(): Trial | null {
  if (typeof window === 'undefined') return DEFAULT_TRIAL;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Trial) : DEFAULT_TRIAL;
  } catch {
    return DEFAULT_TRIAL;
  }
}

export function activarTrial(input: {
  tipo: Trial['tipo'];
  motivo: string;
  meses: number;
  activadoPor: string;
}): Trial {
  const desde = new Date();
  const hasta = new Date(desde);
  hasta.setMonth(hasta.getMonth() + input.meses);
  const trial: Trial = {
    tipo: input.tipo,
    motivo: input.motivo,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    activadoPor: input.activadoPor,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trial));
    } catch {
      // ignore
    }
  }
  return trial;
}

export function cancelarTrial(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** True si el trial está vigente hoy. */
export function trialVigente(trial: Trial | null = leerTrial()): boolean {
  if (!trial) return false;
  return new Date(trial.hasta) >= new Date();
}

/** Días restantes del trial. Negativo si ya venció. */
export function diasRestantesTrial(trial: Trial | null = leerTrial()): number {
  if (!trial) return 0;
  const ms = new Date(trial.hasta).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}
