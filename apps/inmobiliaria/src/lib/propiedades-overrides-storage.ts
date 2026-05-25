'use client';

/**
 * Overrides locales para Propiedades del mock. La propiedad base vive en
 * mock-data.ts (read-only); cuando el usuario edita dirección, ambientes,
 * m² o tipo, guardamos un PATCH acá y al renderizar la propiedad lo
 * mezclamos encima del mock. Patrón espejo a propietarios-extra-storage.
 *
 * En producción esto sería un PATCH /propiedades/:id contra el backend;
 * por ahora persistimos en localStorage para que la edición sobreviva al
 * refresh sin armar un mutable shared state.
 */

import type { Propiedad, TipoPropiedad } from './types';

const STORAGE_KEY = 'llave-inmo:propiedades-overrides:v1';

export interface PropiedadOverride {
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  tipo?: TipoPropiedad;
  ambientes?: number | null;
  m2?: number | null;
}

type Store = Record<string, PropiedadOverride>;

function read(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** Devuelve el patch guardado para esa propiedad (o `{}` si no hay). */
export function leerOverride(propiedadId: string): PropiedadOverride {
  return read()[propiedadId] ?? {};
}

/** Guarda/actualiza el patch de una propiedad. Dispara un evento custom
 * `propiedad-actualizada` para que componentes que escuchan se refresquen. */
export function guardarOverride(propiedadId: string, patch: PropiedadOverride): void {
  const store = read();
  store[propiedadId] = { ...store[propiedadId], ...patch };
  write(store);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('propiedad-actualizada', { detail: { propiedadId } }));
  }
}

/** Mezcla la propiedad base con el override guardado. */
export function aplicarOverride(base: Propiedad): Propiedad {
  const patch = leerOverride(base.id);
  return {
    ...base,
    ...(patch.direccion !== undefined ? { direccion: patch.direccion } : {}),
    ...(patch.ciudad !== undefined ? { ciudad: patch.ciudad } : {}),
    ...(patch.provincia !== undefined ? { provincia: patch.provincia } : {}),
    ...(patch.tipo !== undefined ? { tipo: patch.tipo } : {}),
    ...(patch.ambientes !== undefined ? { ambientes: patch.ambientes } : {}),
    ...(patch.m2 !== undefined ? { m2: patch.m2 } : {}),
  };
}
