// Persiste la decisión del inquilino sobre renovación de contrato.
// En backend real esto vive en la tabla de contratos como `intencionRenovacion`,
// `intencionRenovacionAt` y dispara notificación a la inmobiliaria.

const STORAGE_KEY = 'llave:renovacion:v1';

export type DecisionRenovacion = 'RENOVAR' | 'NO_RENOVAR' | 'PENSANDO';

export interface EstadoRenovacion {
  contratoId: string;
  decision: DecisionRenovacion;
  comentario: string | null;
  decidiSAt: string; // ISO
}

export function leerRenovacion(contratoId: string): EstadoRenovacion | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, EstadoRenovacion>;
    return map[contratoId] ?? null;
  } catch {
    return null;
  }
}

export function guardarRenovacion(estado: EstadoRenovacion): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, EstadoRenovacion>;
    map[estado.contratoId] = estado;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function borrarRenovacion(contratoId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, EstadoRenovacion>;
    delete map[contratoId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

// Texto humano para mostrar en banners/cards
export function decisionLabel(d: DecisionRenovacion): string {
  if (d === 'RENOVAR') return 'Querés renovar';
  if (d === 'NO_RENOVAR') return 'No vas a renovar';
  return 'Lo estás pensando';
}
