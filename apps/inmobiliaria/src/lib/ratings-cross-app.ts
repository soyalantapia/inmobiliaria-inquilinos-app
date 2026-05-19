'use client';

/**
 * Lectura cross-app del storage de ratings del inquilino. Mismo origen,
 * mismo localStorage. Cuando el inquilino califica un reclamo resuelto
 * via RatingReclamoCard, el inmo lee esos ratings y los cruza con sus
 * reclamos asignados a profesionales para recalcular su rating real.
 *
 * Solo lectura — el inmo nunca escribe en el storage del inquilino.
 */

import { listarReclamos } from './reclamos-store';

const INQUILINO_RATINGS_KEY = 'llave:reclamo-ratings:v1';

interface RatingReclamoInquilino {
  reclamoId: string;
  estrellas: 1 | 2 | 3 | 4 | 5;
  comentario: string | null;
  enviadoAt: string;
}

function leerRatingsInquilino(): Record<string, RatingReclamoInquilino> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(INQUILINO_RATINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, RatingReclamoInquilino>;
  } catch {
    return {};
  }
}

export interface CalificacionRecibida {
  reclamoId: string;
  direccion: string;
  inquilino: string;
  estrellas: number;
  comentario: string | null;
  enviadoAt: string;
}

/**
 * Devuelve, por profesional, las calificaciones que el inquilino le dio a
 * los reclamos donde estuvo asignado.
 */
export function calificacionesPorProfesional(): Record<
  string,
  CalificacionRecibida[]
> {
  const ratings = leerRatingsInquilino();
  const reclamos = listarReclamos();
  const out: Record<string, CalificacionRecibida[]> = {};

  for (const r of reclamos) {
    if (!r.profesionalAsignadoId) continue;
    const rating = ratings[r.id];
    if (!rating) continue;
    const profId = r.profesionalAsignadoId;
    if (!out[profId]) out[profId] = [];
    out[profId].push({
      reclamoId: r.id,
      direccion: r.direccion,
      inquilino: r.inquilino,
      estrellas: rating.estrellas,
      comentario: rating.comentario,
      enviadoAt: rating.enviadoAt,
    });
  }

  // Ordenar cada array por fecha descendente (último primero).
  Object.values(out).forEach((arr) =>
    arr.sort((a, b) => b.enviadoAt.localeCompare(a.enviadoAt)),
  );

  return out;
}

/**
 * Calcula el rating final del profesional combinando:
 *   - su rating histórico del seed (peso = cantTrabajos)
 *   - las nuevas calificaciones recibidas (peso = cantidad)
 *
 * Si el seed marca 0 trabajos o rating 0, el resultado es directamente
 * el promedio de las nuevas.
 */
export function ratingPonderado(
  seedRating: number,
  seedCantTrabajos: number,
  nuevasCalifs: CalificacionRecibida[],
): { promedio: number; totalCalificaciones: number; nuevas: number } {
  const nuevas = nuevasCalifs.length;
  const sumaNuevas = nuevasCalifs.reduce((acc, c) => acc + c.estrellas, 0);
  const totalCalificaciones = seedCantTrabajos + nuevas;
  if (totalCalificaciones === 0) {
    return { promedio: 0, totalCalificaciones: 0, nuevas: 0 };
  }
  const sumaTotal = seedRating * seedCantTrabajos + sumaNuevas;
  return {
    promedio: sumaTotal / totalCalificaciones,
    totalCalificaciones,
    nuevas,
  };
}
