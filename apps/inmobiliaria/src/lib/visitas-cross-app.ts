'use client';

/**
 * Lectura cross-app del storage de visitas que confirma el profesional
 * desde su link mágico /p/[token]. Mismo origen → mismo localStorage.
 *
 * Solo lectura — el inmo nunca escribe acá. Para que el progreso del
 * trabajo se vea en el timeline del reclamo y en la card del profesional.
 */

const STORAGE_KEY = 'llave-prof:visitas:v1';

export interface VisitaProfesional {
  reclamoId: string;
  profesionalId: string;
  fechaVisita: string | null;
  estado: 'ASIGNADO' | 'CONFIRMADA' | 'EN_CAMINO' | 'LISTO';
  confirmadaAt: string | null;
  enCaminoAt: string | null;
  listoAt: string | null;
  notaFinal: string | null;
  montoCobrado: number | null;
}

function read(): Record<string, VisitaProfesional> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, VisitaProfesional>) : {};
  } catch {
    return {};
  }
}

export function visitaDeReclamo(reclamoId: string): VisitaProfesional | null {
  return read()[reclamoId] ?? null;
}
