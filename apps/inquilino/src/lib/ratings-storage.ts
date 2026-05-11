'use client';

// Storage local de ratings de reclamos. En backend real esto sería una
// columna `rating` + `ratingComment` en la tabla reclamos. Acá guardamos
// solo el rating del lado del inquilino para que sobreviva refreshes.

const STORAGE_KEY = 'llave:reclamo-ratings:v1';

export interface RatingReclamo {
  reclamoId: string;
  estrellas: 1 | 2 | 3 | 4 | 5;
  comentario: string | null;
  enviadoAt: string; // ISO
}

type Payload = Record<string, RatingReclamo>;

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

export function obtenerRating(reclamoId: string): RatingReclamo | null {
  return read()[reclamoId] ?? null;
}

export function guardarRating(rating: RatingReclamo): void {
  const all = read();
  all[rating.reclamoId] = rating;
  write(all);
}
