// Storage de la red de profesionales para el lado inmobiliaria. Hidrata
// desde profesionalesAdminMock si no hay nada en localStorage, después
// persiste las altas/ediciones/bajas. En backend real es un endpoint REST.

import { profesionalesAdminMock, type ProfesionalAdmin } from './mock-data';

const STORAGE_KEY = 'llave-inmo:profesionales:v1';

function leer(): ProfesionalAdmin[] {
  if (typeof window === 'undefined') return profesionalesAdminMock;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return profesionalesAdminMock;
    return JSON.parse(raw) as ProfesionalAdmin[];
  } catch {
    return profesionalesAdminMock;
  }
}

function guardar(lista: ProfesionalAdmin[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export function listarProfesionalesAdmin(): ProfesionalAdmin[] {
  return leer();
}

export function crearProfesional(
  data: Omit<ProfesionalAdmin, 'id' | 'rating' | 'cantTrabajos' | 'ultimoTrabajo' | 'activo'>,
): ProfesionalAdmin {
  const nuevo: ProfesionalAdmin = {
    ...data,
    id: `prof_${Date.now()}`,
    rating: 0,
    cantTrabajos: 0,
    ultimoTrabajo: null,
    activo: true,
  };
  const lista = leer();
  guardar([nuevo, ...lista]);
  return nuevo;
}

export function actualizarProfesional(id: string, cambios: Partial<ProfesionalAdmin>): void {
  const lista = leer().map((p) => (p.id === id ? { ...p, ...cambios } : p));
  guardar(lista);
}

export function eliminarProfesional(id: string): void {
  guardar(leer().filter((p) => p.id !== id));
}

export function toggleActivo(id: string): void {
  const lista = leer().map((p) => (p.id === id ? { ...p, activo: !p.activo } : p));
  guardar(lista);
}
