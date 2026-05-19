'use client';

/**
 * Lectura cross-app del storage de la inmobiliaria. Las dos apps viven en
 * el mismo origen (github.io subpath o localhost dev), así que comparten
 * localStorage. Cuando el inmo asigna un profesional al reclamo, en
 * backend real esto vendría por websocket / push. En la demo lo emulamos
 * leyendo el storage del inmo y mergeando los campos del profesional.
 *
 * Solo lectura — el inquilino nunca escribe en el storage del inmo.
 */

const INMO_RECLAMOS_KEY = 'llave-inmo:reclamos:v1';

interface InmoReclamo {
  id: string;
  asignadoA?: string | null;
  profesionalAsignadoId?: string | null;
  profesionalAsignadoNombre?: string | null;
  profesionalAsignadoTelefono?: string | null;
  profesionalAsignadoCategoria?: string | null;
  estado?: string;
  resolucion?: string | null;
  resueltoAt?: string | null;
}

interface InmoPayload {
  v: 1;
  reclamos: InmoReclamo[];
}

function leerReclamosInmo(): InmoReclamo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INMO_RECLAMOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InmoPayload;
    if (parsed.v !== 1 || !Array.isArray(parsed.reclamos)) return [];
    return parsed.reclamos;
  } catch {
    return [];
  }
}

/**
 * Devuelve los datos del profesional que el inmo asignó al reclamo, o
 * null si todavía no se asignó (o el reclamo no existe del lado inmo).
 */
export function datosProfesionalDeInmo(reclamoId: string): {
  nombre: string;
  telefono: string;
  categoria: string;
} | null {
  const r = leerReclamosInmo().find((x) => x.id === reclamoId);
  if (!r?.profesionalAsignadoNombre) return null;
  return {
    nombre: r.profesionalAsignadoNombre,
    telefono: r.profesionalAsignadoTelefono ?? '',
    categoria: r.profesionalAsignadoCategoria ?? '',
  };
}

/**
 * Devuelve el operador interno (asignadoA) que tomó el reclamo del lado inmo.
 */
export function operadorDeInmo(reclamoId: string): string | null {
  const r = leerReclamosInmo().find((x) => x.id === reclamoId);
  return r?.asignadoA ?? null;
}
