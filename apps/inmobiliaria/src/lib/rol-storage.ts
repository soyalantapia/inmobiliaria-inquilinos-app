import type { Rol } from './permisos';

export const ROL_STORAGE_KEY = 'llave-inmo:rol-sesion:v1';

// Evento custom para notificar cambios de rol dentro de la misma pestaña.
// window.storage solo dispara en otras pestañas; este cubre el tab actual.
export const ROL_CHANGE_EVENT = 'inmo:rol-change';

/**
 * Valida un string arbitrario a un Rol conocido; si no lo reconoce (o viene
 * null/undefined, p.ej. mientras `/auth/me` carga o falla) cae al `fallback`.
 * En prod el fallback debe ser el rol MÁS restrictivo (LECTURA): ante la duda,
 * mostrar de menos y nunca de más — así una auditora nunca ve el menú de admin
 * ni por un instante. En el path demo el fallback es ADMIN (ver getRolActual).
 */
export function normalizarRol(v: string | null | undefined, fallback: Rol = 'LECTURA'): Rol {
  if (v === 'ADMIN' || v === 'OPERADOR' || v === 'CARGA' || v === 'LECTURA') return v;
  return fallback;
}

// SOLO para el build demo (sin API): el rol se elige localmente. En prod el rol
// viene de la sesión real (`me.rol` de /auth/me), NO de acá.
export function getRolActual(): Rol {
  if (typeof window === 'undefined') return 'ADMIN';
  return normalizarRol(localStorage.getItem(ROL_STORAGE_KEY), 'ADMIN');
}

export function setRolActual(rol: Rol): void {
  localStorage.setItem(ROL_STORAGE_KEY, rol);
  window.dispatchEvent(new Event(ROL_CHANGE_EVENT));
}
