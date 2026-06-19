'use client';

/**
 * Sistema de auth con OTP por email para la app del inquilino.
 *
 * NO requiere backend: todo vive en localStorage. El flujo:
 *
 *   1. Usuario ingresa su email → `solicitarCodigo(email)`
 *      Generamos un código de 6 dígitos, lo guardamos con expiración 5 min,
 *      y lo "enviamos" (mostramos en el banner DEMO).
 *
 *   2. Usuario tipea el código → `verificarCodigo(email, codigo)`
 *      Si coincide y no expiró, creamos sesión activa y devolvemos los
 *      datos del inquilino (real o invitado).
 *
 *   3. Sesión activa → `leerSesion()` la levanta en cada page load.
 *
 *   4. Logout → `cerrarSesion()` borra todo.
 *
 * Inquilinos válidos:
 *   - Los del seed REGISTRABLES (Mariela y otros)
 *   - Los invitados cargados desde la app inmobiliaria (mismo localStorage
 *     en tests locales; en producción son apps separadas pero aceptamos
 *     cualquier email para que la demo siga funcionando)
 */

const CODIGO_KEY = 'llave-inquilino:auth:codigo:v1';
const SESION_KEY = 'llave-inquilino:auth:sesion:v1';
const INVITADOS_KEY = 'llave-inquilino:auth:invitados:v1';

const TTL_CODIGO_MS = 5 * 60 * 1000; // 5 minutos
const COOLDOWN_REENVIO_S = 45;

export interface InquilinoSesion {
  email: string;
  nombre: string;
  apellido: string;
  direccion: string;
  contratoId: string;
  esInvitado: boolean; // creado desde la inmo vs mock seed
  loggeadoAt: string;
  /** true si la sesión es de un CO-INQUILINO (no el titular). */
  esCoInquilino?: boolean;
  /** Permiso del co-inquilino sobre el contrato (solo si esCoInquilino). */
  permiso?: 'VER' | 'PAGAR' | 'COMPLETO';
}

interface CodigoVigente {
  email: string;
  codigo: string;
  emitidoAt: number; // timestamp ms
  intentos: number;
}

interface InvitadoRegistrado {
  email: string;
  nombre: string;
  apellido: string;
  direccion: string;
  contratoId: string;
  invitadoAt: string;
}

/* ============================================================
 * Seed de inquilinos "registrables" (no inventados)
 * ============================================================ */

const SEED_INQUILINOS: Array<Omit<InquilinoSesion, 'esInvitado' | 'loggeadoAt'>> = [
  {
    email: 'mariela.sosa@gmail.com',
    nombre: 'Mariela',
    apellido: 'Sosa',
    direccion: 'Gorriti 4521, 3°B',
    contratoId: 'cnt_001',
  },
];

/* ============================================================
 * Helpers de localStorage
 * ============================================================ */

function leerCodigo(): CodigoVigente | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CODIGO_KEY);
    return raw ? (JSON.parse(raw) as CodigoVigente) : null;
  } catch {
    return null;
  }
}

function guardarCodigo(c: CodigoVigente): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CODIGO_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

function borrarCodigo(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CODIGO_KEY);
  } catch {
    // ignore
  }
}

function leerInvitados(): InvitadoRegistrado[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INVITADOS_KEY);
    return raw ? (JSON.parse(raw) as InvitadoRegistrado[]) : [];
  } catch {
    return [];
  }
}

/* ============================================================
 * API pública
 * ============================================================ */

export interface SolicitarCodigoResultado {
  ok: boolean;
  codigo?: string; // para mostrar en el banner DEMO
  email?: string;
  cooldownHasta?: number; // ms timestamp si está en cooldown
  motivo?: string;
}

/**
 * Genera un código nuevo o reusa uno vigente si todavía está dentro del
 * cooldown de reenvío.
 */
export function solicitarCodigo(email: string): SolicitarCodigoResultado {
  const emailNormalizado = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
    return { ok: false, motivo: 'Email inválido' };
  }

  // Si hay un código vigente para este email todavía dentro del cooldown,
  // devolvemos el mismo (no enviamos uno nuevo)
  const actual = leerCodigo();
  if (actual && actual.email === emailNormalizado) {
    const desde = Date.now() - actual.emitidoAt;
    if (desde < COOLDOWN_REENVIO_S * 1000) {
      return {
        ok: true,
        codigo: actual.codigo,
        email: emailNormalizado,
        cooldownHasta: actual.emitidoAt + COOLDOWN_REENVIO_S * 1000,
      };
    }
  }

  // Generamos un código nuevo
  const codigo = generarCodigo6();
  const c: CodigoVigente = {
    email: emailNormalizado,
    codigo,
    emitidoAt: Date.now(),
    intentos: 0,
  };
  guardarCodigo(c);

  return {
    ok: true,
    codigo,
    email: emailNormalizado,
    cooldownHasta: c.emitidoAt + COOLDOWN_REENVIO_S * 1000,
  };
}

export interface VerificarCodigoResultado {
  ok: boolean;
  sesion?: InquilinoSesion;
  motivo?: string;
}

/**
 * Valida que el código coincida y no haya expirado. Si todo OK,
 * crea la sesión y la persiste.
 */
export function verificarCodigo(email: string, codigo: string): VerificarCodigoResultado {
  const emailNormalizado = email.trim().toLowerCase();
  const codigoNormalizado = codigo.replace(/\s/g, '');

  const actual = leerCodigo();
  if (!actual || actual.email !== emailNormalizado) {
    return { ok: false, motivo: 'No hay código vigente para este email. Pedí uno nuevo.' };
  }

  // Expiración
  if (Date.now() - actual.emitidoAt > TTL_CODIGO_MS) {
    borrarCodigo();
    return { ok: false, motivo: 'El código expiró. Pedí uno nuevo.' };
  }

  // Máximo 5 intentos por código
  if (actual.intentos >= 5) {
    borrarCodigo();
    return { ok: false, motivo: 'Demasiados intentos. Pedí un código nuevo.' };
  }

  if (actual.codigo !== codigoNormalizado) {
    guardarCodigo({ ...actual, intentos: actual.intentos + 1 });
    return { ok: false, motivo: `Código incorrecto. Te quedan ${5 - actual.intentos - 1} intentos.` };
  }

  // Código correcto → buscamos el inquilino
  const inquilino = resolverInquilino(emailNormalizado);

  const sesion: InquilinoSesion = {
    ...inquilino,
    loggeadoAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
    } catch {
      // ignore
    }
  }
  borrarCodigo();
  return { ok: true, sesion };
}

/**
 * Buscamos el inquilino:
 *   1. En el seed de mocks (Mariela, etc.)
 *   2. En los invitados creados desde la inmo
 *   3. Si no aparece → creamos un perfil "demo" genérico para que la app
 *      siga funcionando (no rompemos el flujo de demo).
 */
function resolverInquilino(email: string): Omit<InquilinoSesion, 'loggeadoAt'> {
  const enSeed = SEED_INQUILINOS.find((s) => s.email === email);
  if (enSeed) {
    return { ...enSeed, esInvitado: false };
  }
  const enInvitados = leerInvitados().find((i) => i.email === email);
  if (enInvitados) {
    return {
      email: enInvitados.email,
      nombre: enInvitados.nombre,
      apellido: enInvitados.apellido,
      direccion: enInvitados.direccion,
      contratoId: enInvitados.contratoId,
      esInvitado: true,
    };
  }
  // Email nuevo en demo: lo aceptamos pero usamos datos genéricos
  const nombreDeEmail = email.split('@')[0]?.replace(/[._-]/g, ' ') ?? 'Inquilino';
  const partes = nombreDeEmail.split(' ');
  return {
    email,
    nombre: capitalizar(partes[0] ?? 'Inquilino'),
    apellido: capitalizar(partes[1] ?? ''),
    direccion: '—',
    contratoId: '—',
    esInvitado: true,
  };
}

/**
 * Bypass de login para el demo: crea la sesión de Mariela directo, sin pasar
 * por el OTP. La usa `/login?demo=1`. Pensado para (a) testing automatizado
 * con navegadores headless que no pueden completar el flujo OTP de 6 inputs,
 * y (b) compartir la demo sin fricción. NO es un agujero de seguridad: toda
 * la app corre sobre datos mock en localStorage, no hay backend ni datos
 * reales detrás. En producción con backend real esta función no existiría.
 */
export function iniciarSesionDemo(): InquilinoSesion {
  const mariela = SEED_INQUILINOS[0]!;
  const sesion: InquilinoSesion = {
    ...mariela,
    esInvitado: false,
    loggeadoAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
    } catch {
      // ignore
    }
  }
  return sesion;
}

/**
 * Lee la sesión activa, si la hay.
 */
export function leerSesion(): InquilinoSesion | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESION_KEY);
    return raw ? (JSON.parse(raw) as InquilinoSesion) : null;
  } catch {
    return null;
  }
}

/**
 * Cierra la sesión (local + token del API si lo hay).
 */
export function cerrarSesion(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESION_KEY);
    window.localStorage.removeItem('llave:auth:token');
  } catch {
    // ignore
  }
}

/** Persiste una sesión construida fuera (ej. login contra el API). */
export function guardarSesion(sesion: InquilinoSesion): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
  } catch {
    // ignore
  }
}

/** Construye los datos locales del inquilino para un email (seed/invitado/genérico). */
export function resolverInquilinoLocal(email: string): Omit<InquilinoSesion, 'loggeadoAt'> {
  return resolverInquilino(email.trim().toLowerCase());
}

/* ============================================================
 * Helpers internos
 * ============================================================ */

function generarCodigo6(): string {
  // 6 dígitos, sin importar leading zeros (no usamos Math.random.toString)
  const n = Math.floor(100000 + Math.random() * 900000);
  return n.toString();
}

function capitalizar(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export const SEGUNDOS_COOLDOWN = COOLDOWN_REENVIO_S;
export const MINUTOS_TTL = TTL_CODIGO_MS / 60_000;
