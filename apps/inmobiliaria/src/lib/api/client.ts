'use client';

/**
 * Cliente HTTP del API de My Alquiler.
 * Si NEXT_PUBLIC_API_URL está vacío (demo GH Pages / dev sin back), `apiEnabled`
 * es false y los hooks de datos caen al modo localStorage actual.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const apiEnabled = API_URL.length > 0;

const TOKEN_KEY = 'llave:auth:token';

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

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Sesión vencida/invalidada: si mandamos un token y el server lo rechaza (401),
 * limpiamos la sesión y mandamos a re-loguear. Sin esto, un admin con el token
 * vencido (vive 15 días) quedaba mirando pantallas vacías sin entender por qué
 * (cada query daba 401 → []). Solo aplica a requests autenticados (token presente)
 * y fuera de /login (evita loops). Mismo patrón que la PWA del inquilino.
 */
function manejarSesionVencida(status: number, token: string | null): void {
  if (status === 401 && token && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    window.location.assign('/login?expirada=1');
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
    manejarSesionVencida(res.status, token);
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
 * URL absoluta y AUTENTICADA de un archivo servido por el backend
 * (`/uploads/<tenant>/<name>`), lista para un `<img src>` / `<a href>`.
 *
 * Un `<img>` no puede mandar el header Authorization, así que el endpoint
 * GET /uploads acepta el token por query (`?token=`). Antes se renderizaba la
 * `fotoUrl` cruda (`/uploads/...`), que es RELATIVA → el browser la pedía al
 * host del panel (admin.myalquiler.com), no al de la API, y encima sin token:
 * 404/401 → foto rota. Una URL ya absoluta (http/https/data/blob) se devuelve
 * tal cual. Devuelve undefined si no hay url.
 */
export function urlDeArchivo(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const token = getToken();
  const sep = url.includes('?') ? '&' : '?';
  return `${API_URL}${url}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`;
}

export interface ArchivoSubido {
  url: string;
  nombreArchivo: string;
  tipoMime: string;
  tamanioBytes: number;
}

/**
 * Sube un archivo REAL al Volume del backend (POST /uploads, multipart) y
 * devuelve su URL servida + metadatos. Usado por el expediente de documentos.
 * No mandamos Content-Type: el browser pone el boundary del multipart solo.
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
    manejarSesionVencida(res.status, token);
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
