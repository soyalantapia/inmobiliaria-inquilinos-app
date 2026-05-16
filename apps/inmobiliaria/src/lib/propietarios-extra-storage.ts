'use client';

/**
 * Propietarios creados al vuelo desde el wizard de "Nueva propiedad".
 * En backend real se persisten en la tabla `propietario`, acá viven en
 * localStorage y se mezclan con `propietariosMock` para el selector.
 */

const STORAGE_KEY = 'llave-inmo:propietarios-extra:v1';

export interface PropietarioExtra {
  id: string;
  nombre: string;
  apellido: string;
  cuit: string;
  email: string;
  telefono: string;
  cbuAlias: string | null;
  comisionPct: number;
  createdAt: string;
}

export function listarPropietariosExtra(): PropietarioExtra[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PropietarioExtra[]) : [];
  } catch {
    return [];
  }
}

export interface AgregarPropietarioInput {
  nombre: string;
  apellido: string;
  cuit?: string;
  email?: string;
  telefono?: string;
  cbuAlias?: string;
  comisionPct?: number;
}

export function agregarPropietarioExtra(input: AgregarPropietarioInput): PropietarioExtra {
  const nuevo: PropietarioExtra = {
    id: `own_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    nombre: input.nombre.trim(),
    apellido: input.apellido.trim(),
    cuit: (input.cuit ?? '').trim(),
    email: (input.email ?? '').trim().toLowerCase(),
    telefono: (input.telefono ?? '').trim(),
    cbuAlias: (input.cbuAlias ?? '').trim() || null,
    comisionPct: input.comisionPct ?? 8,
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      const lista = listarPropietariosExtra();
      lista.unshift(nuevo);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch {
      // ignore
    }
  }
  return nuevo;
}
