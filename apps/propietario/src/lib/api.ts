'use client';

/**
 * Cliente del portal del propietario.
 *
 * A diferencia del panel y de la PWA, acá NO hay modo demo con localStorage: el portal muestra
 * plata rendida de personas reales y una versión "de mentira" sólo serviría para confundir. Sin
 * `NEXT_PUBLIC_API_URL` la app lo dice y no finge nada.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
export const apiEnabled = API_URL.length > 0;

const TOKEN_KEY = 'myalquiler-propietario:token';
const SESION_KEY = 'myalquiler-propietario:sesion';

export interface SesionPropietario {
  nombre: string;
  inmobiliaria: string;
  carteras: { propietarioId: string; inmobiliaria: string; actual: boolean }[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function leerToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function guardarSesion(token: string, sesion: SesionPropietario): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
  } catch {
    // Modo privado o storage lleno: la sesión no persiste, pero la navegación actual sigue.
  }
}

export function leerSesion(): SesionPropietario | null {
  try {
    const raw = window.localStorage.getItem(SESION_KEY);
    return raw ? (JSON.parse(raw) as SesionPropietario) : null;
  } catch {
    return null;
  }
}

export function cerrarSesion(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(SESION_KEY);
  } catch {
    // ignore
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiEnabled) throw new ApiError('El portal no está conectado al servidor.', 0);
  const token = leerToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    // 401 = la sesión caducó o la revocaron (el guard revalida contra la DB en cada request).
    // Limpiamos acá para que el próximo render mande al login en vez de reintentar en loop.
    if (res.status === 401) cerrarSesion();
    let message = 'No pudimos conectar con el servidor.';
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // respuesta sin JSON: nos quedamos con el mensaje genérico
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

// ---- Tipos de lo que devuelve el portal (espejo de apps/api/src/routes/portal-propietario.ts) ----

export interface MiCartera {
  nombre: string;
  email: string;
  telefono: string;
  cuit: string;
  comisionPct: number;
  inmobiliaria: { nombre: string; telefono: string | null; email: string | null };
}

export interface PeriodoInquilino {
  periodo: string;
  estado: 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';
  monto: number;
  vence: string;
  /** Fecha REAL en que entró la plata. null = todavía no se cobró. */
  pagoAt: string | null;
}

export interface PropiedadPortal {
  id: string;
  direccion: string;
  ciudad: string;
  complejo: string | null;
  participacionPct: number;
  contrato: {
    estado: string;
    tipoContrato: string;
    monto: number;
    moneda: 'ARS' | 'USD';
    desde: string;
    hasta: string;
    inquilino: string | null;
    periodos: PeriodoInquilino[];
  } | null;
}

export interface RendicionPortal {
  id: string;
  periodo: string;
  cobrado: number;
  comisionPct: number;
  comision: number;
  gastos: number;
  otrosIngresos: number;
  teDepositamos: number;
  rendidoAt: string;
  metodo: string;
}

export interface RendicionDetalle extends RendicionPortal {
  detalleAlquileres: { periodo: string; direccion: string; participacionPct: number; monto: number }[];
  detalleGastos: { fecha: string; tipo: string; descripcion: string; proveedor: string | null; monto: number }[];
  detalleIngresos: { fecha: string; descripcion: string; participacionPct: number; monto: number }[];
}

export interface ReclamoPortal {
  id: string;
  descripcion: string;
  categoria: string;
  urgencia: string;
  estado: string;
  creadoAt: string;
  resueltoAt: string | null;
  costo: number | null;
  pagador: string | null;
  direccion: string | null;
  complejo: string | null;
}
