'use client';

/**
 * Acuse de recibo de anuncios — lado inquilino (P0 del loop de comunicación).
 *
 * Guarda, por anuncio, si el inquilino lo LEYÓ (lo abrió) y si lo CONFIRMÓ
 * explícitamente ("Enterado"). Es estado local del inquilino. En backend real
 * sería la tabla AnuncioAcuse(anuncioId, inquilinoId, leidoAt, confirmadoAt),
 * que además alimentaría el "Leído X de N" del lado inmobiliaria.
 */

const KEY = 'llave:anuncios:acuses:v1';

export interface Acuse {
  leidoAt?: string;
  confirmadoAt?: string;
}

function read(): Record<string, Acuse> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Acuse>) : {};
  } catch {
    return {};
  }
}

function write(data: Record<string, Acuse>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function leerAcuses(): Record<string, Acuse> {
  return read();
}

export function acuseDe(id: string): Acuse | undefined {
  return read()[id];
}

/** Marca el anuncio como leído (al abrirlo). No pisa un leidoAt previo. */
export function marcarLeido(id: string): void {
  const data = read();
  if (data[id]?.leidoAt) return;
  data[id] = { ...data[id], leidoAt: new Date().toISOString() };
  write(data);
}

/** Acuse explícito "Enterado": confirma (e implica leído). */
export function marcarEnterado(id: string): void {
  const data = read();
  const now = new Date().toISOString();
  data[id] = { leidoAt: data[id]?.leidoAt ?? now, confirmadoAt: now };
  write(data);
}

/** Cuántos de estos anuncios siguen sin leer. */
export function contarNoLeidos(ids: string[]): number {
  const data = read();
  return ids.filter((id) => !data[id]?.leidoAt).length;
}
