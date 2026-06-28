'use client';

/**
 * Cliente HTTP del API de My Alquiler.
 * Si NEXT_PUBLIC_API_URL está vacío (demo GH Pages / dev sin back), `apiEnabled`
 * es false y los hooks de datos caen al modo localStorage actual.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const apiEnabled = API_URL.length > 0;

const TOKEN_KEY = 'llave:auth:token';
// Token de "persona" (lo emite /auth/otp/verify tras el OTP). Es DISTINTO del
// token activo: solo habilita listar/elegir alquileres del email. Lo guardamos
// aparte para que el switcher "Cambiar de alquiler" funcione después del login
// sin re-pedir el OTP, mientras el token activo sigue siendo el del contrato.
const PERSONA_KEY = 'llave:auth:persona';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token === null) window.localStorage.removeItem(TOKEN_KEY);
    else window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage lleno/bloqueado: seguimos sin persistir
  }
}

export function getPersonaToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(PERSONA_KEY);
  } catch {
    return null;
  }
}

export function setPersonaToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token === null) window.localStorage.removeItem(PERSONA_KEY);
    else window.localStorage.setItem(PERSONA_KEY, token);
  } catch {
    // storage lleno/bloqueado: seguimos sin persistir
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      // Content-Type solo si hay body: Fastify rechaza JSON vacío con 400
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Sesión vencida/invalidada: si mandamos un token y el server lo rechaza
    // (401), limpiamos la sesión y mandamos a re-loguear. Si no, el inquilino
    // queda atrapado en "No pudimos cargar tu cuenta · Reintentar" para siempre
    // (reintentar con un token muerto nunca funciona). Solo aplica a requests
    // autenticados (token presente) y fuera del propio /login (evita loops y no
    // pisa el manejo de error del login por OTP, que también puede dar 401).
    if (
      res.status === 401 &&
      token &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/login')
    ) {
      try {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem('llave-inquilino:auth:sesion:v1');
      } catch {
        // ignore
      }
      window.location.assign('/login?expirada=1');
    }
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // sin body JSON
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

/**
 * Fetch autenticado con el token de "persona" (listar/elegir alquileres).
 * A diferencia de apiFetch, NO dispara el auto-logout global ante un 401: si el
 * persona-token venció, el switcher cae con un ApiError que el caller maneja
 * (la sesión del inquilino sigue viva). Así un persona-token vencido no expulsa
 * al usuario de toda la app — solo deshabilita el cambio de alquiler.
 */
export async function apiFetchPersona<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getPersonaToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // sin body JSON
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export interface ArchivoSubido {
  url: string;
  nombreArchivo: string;
  tipoMime: string;
  tamanioBytes: number;
}

/**
 * Sube un archivo REAL al backend (multipart → Railway Volume) y devuelve su URL
 * servida. No usa apiFetch porque ese fuerza Content-Type JSON; acá dejamos que el
 * browser ponga el boundary de multipart. Antes el archivo nunca salía del browser.
 */
export async function subirArchivo(file: File): Promise<ArchivoSubido> {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // sin body JSON
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as ArchivoSubido;
}
