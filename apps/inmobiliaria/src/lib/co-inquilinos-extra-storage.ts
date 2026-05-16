'use client';

/**
 * Co-inquilinos sumados a una propiedad desde el panel inmo,
 * independientemente del inquilino principal (que puede ser un seed mock
 * como Mariela). Se persisten en localStorage y aparecen en el tab
 * "Inquilino" de la propiedad.
 *
 * En backend real esto vive en una tabla `coinquilino` con FK al contrato.
 */

const STORAGE_KEY = 'llave-inmo:co-inquilinos-extra:v1';

export type PermisoCoInquilino = 'VER' | 'PAGAR' | 'COMPLETO';
export type EstadoCoInquilino = 'PENDIENTE_ACTIVACION' | 'ACTIVO';

export interface CoInquilinoExtra {
  id: string;
  propiedadId: string;
  contratoId: string | null;
  nombre: string;
  apellido: string;
  email: string;
  dni?: string;
  celular?: string;
  relacion: string; // "Conviviente", "Cónyuge", etc.
  permiso: PermisoCoInquilino;
  estado: EstadoCoInquilino;
  invitadoAt: string;
  activadoAt: string | null;
}

export function listarCoInquilinosExtra(): CoInquilinoExtra[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CoInquilinoExtra[]) : [];
  } catch {
    return [];
  }
}

export function coInquilinosDePropiedad(propiedadId: string): CoInquilinoExtra[] {
  return listarCoInquilinosExtra().filter((c) => c.propiedadId === propiedadId);
}

export interface AgregarCoInquilinoInput {
  propiedadId: string;
  contratoId?: string | null;
  nombre: string;
  apellido: string;
  email: string;
  dni?: string;
  celular?: string;
  relacion: string;
  permiso: PermisoCoInquilino;
}

export function agregarCoInquilino(input: AgregarCoInquilinoInput): CoInquilinoExtra {
  const ahora = new Date().toISOString();
  const nuevo: CoInquilinoExtra = {
    id: `coi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    propiedadId: input.propiedadId,
    contratoId: input.contratoId ?? null,
    nombre: input.nombre.trim(),
    apellido: input.apellido.trim(),
    email: input.email.trim().toLowerCase(),
    dni: input.dni?.trim() || undefined,
    celular: input.celular?.trim() || undefined,
    relacion: input.relacion,
    permiso: input.permiso,
    estado: 'PENDIENTE_ACTIVACION',
    invitadoAt: ahora,
    activadoAt: null,
  };
  if (typeof window !== 'undefined') {
    try {
      const lista = listarCoInquilinosExtra();
      lista.unshift(nuevo);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch {
      // ignore
    }
  }
  return nuevo;
}

export function eliminarCoInquilino(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const lista = listarCoInquilinosExtra().filter((c) => c.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export const PERMISO_LABEL: Record<PermisoCoInquilino, string> = {
  VER: 'Solo ver',
  PAGAR: 'Ver y pagar',
  COMPLETO: 'Todo',
};
