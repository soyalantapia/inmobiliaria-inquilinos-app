'use client';

// Datos editables del inquilino, persistidos en localStorage. En backend real
// esto pega contra el endpoint del propio usuario. Compartido entre /cuenta
// (que los muestra) y /cuenta/editar (que los edita).

const PROFILE_KEY = 'llave-inquilino:profile:v1';

export interface ProfileOverride {
  fullName?: string;
  phone?: string;
  email?: string;
}

export function leerProfile(): ProfileOverride {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as ProfileOverride) : {};
  } catch {
    return {};
  }
}

export function guardarProfile(p: ProfileOverride): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}
