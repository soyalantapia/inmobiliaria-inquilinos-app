'use client';

/**
 * Cliente del portal del propietario.
 *
 * SOBRE EL MODO DEMO, que antes acá no existía. La versión original de este archivo decía que
 * el portal NO podía tener modo demo: muestra plata rendida de personas reales, y una versión
 * "de mentira" sólo serviría para confundir. El argumento sigue siendo cierto y sigue vigente
 * —lo que cambió es que se lo acotó al caso donde de verdad aplica—.
 *
 * Falta el servidor en una app desplegada (`!apiEnabled`) ⇒ NO se inventa nada. Se dice "el
 * portal no está conectado", igual que antes. Ese es el caso peligroso: un propietario de
 * verdad mirando números que no son los suyos.
 *
 * Sitio estático de la demo (`NEXT_PUBLIC_DEMO=1`) ⇒ datos de `demo-data.ts`. Ahí no hay
 * propietario real ni base: es la misma demo donde el panel ya muestra caja falsa y la PWA
 * alquiler falso, y el portal quedaba afuera del sitio por no tenerla (T-46).
 *
 * La bandera es una SEGUNDA condición, no un reemplazo, y sólo la escribe
 * `scripts/build-static.sh`. Olvidarse `NEXT_PUBLIC_API_URL` en producción no prende la demo
 * por accidente: sin la bandera, el camino es el honesto de siempre.
 *
 * LO QUE SÍ PASA, y conviene saberlo: `demo-data.ts` se importa estático, así que sus ~7 kB
 * viajan en el bundle aunque la bandera esté apagada. Verificado buildeando las dos veces: sin
 * bandera el login vuelve a decir "no está conectado" y nada llama a `resolverDemo`, pero los
 * datos están ahí, muertos. Es peso al pedo, no una filtración —es una persona inventada—, y
 * sacarlo pide un `await import()` acá y en el login que no paga lo que cuesta hoy. Si alguna
 * vez el portal se despliega de verdad y el bundle importa, ese es el movimiento.
 */
import { resolverDemo } from './demo-data';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
export const apiEnabled = API_URL.length > 0;

/**
 * La demo pide las DOS cosas: bandera puesta y servidor ausente. El `!apiEnabled` no es
 * decorativo — si alguien buildea el sitio estático apuntando a un API real, gana el API real
 * y no los mocks.
 */
export const demoEnabled = process.env.NEXT_PUBLIC_DEMO === '1' && !apiEnabled;

const TOKEN_KEY = 'myalquiler-propietario:token';
const SESION_KEY = 'myalquiler-propietario:sesion';

export interface SesionPropietario {
  nombre: string;
  inmobiliaria: string;
  carteras: { propietarioId: string; nombre: string; inmobiliaria: string; actual: boolean }[];
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
  // La demo se resuelve ANTES de mirar el token: en el sitio estático no hay sesión que
  // revalidar contra nada. El orden importa — con la bandera puesta nunca se llega al fetch.
  if (demoEnabled) return resolverDemo(path) as T;
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
  /** En qué moneda se rindió. Sin esto el front mostraba los dólares con signo de pesos. */
  moneda: 'ARS' | 'USD';
  rendidoAt: string;
  metodo: string;
}

export interface RendicionDetalle extends RendicionPortal {
  detalleAlquileres: { periodo: string; direccion: string; participacionPct: number; monto: number }[];
  detalleGastos: { fecha: string; tipo: string; descripcion: string; proveedor: string | null; monto: number }[];
  detalleIngresos: { fecha: string; descripcion: string; participacionPct: number; monto: number }[];
}

/** Un aviso que la inmobiliaria le mandó a sus propietarios. */
export interface AnuncioPortal {
  id: string;
  titulo: string;
  cuerpo: string;
  prioridad: 'NORMAL' | 'IMPORTANTE' | 'URGENTE';
  enviadoAt: string;
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
