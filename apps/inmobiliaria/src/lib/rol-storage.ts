import type { Rol } from './permisos';

export const ROL_STORAGE_KEY = 'llave-inmo:rol-sesion:v1';

// Evento custom para notificar cambios de rol dentro de la misma pestaña.
// window.storage solo dispara en otras pestañas; este cubre el tab actual.
export const ROL_CHANGE_EVENT = 'inmo:rol-change';

export function getRolActual(): Rol {
  if (typeof window === 'undefined') return 'ADMIN';
  const v = localStorage.getItem(ROL_STORAGE_KEY);
  if (v === 'ADMIN' || v === 'OPERADOR' || v === 'CARGA' || v === 'LECTURA') return v;
  return 'ADMIN';
}

export function setRolActual(rol: Rol): void {
  localStorage.setItem(ROL_STORAGE_KEY, rol);
  window.dispatchEvent(new Event(ROL_CHANGE_EVENT));
}
