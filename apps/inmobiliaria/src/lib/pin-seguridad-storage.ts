'use client';

/**
 * PIN de seguridad para acciones sensibles — pedido del feedback:
 * "tiene que haber una clave extra para aprobar pagos, no alcanza con
 * estar logueado". Funciona como segundo factor operativo dentro de la
 * sesión: el usuario configura un PIN de 4-6 dígitos en su cuenta y se
 * lo pedimos antes de:
 *
 *   - conciliar / rechazar / revertir un pago,
 *   - rendir a propietario,
 *   - aprobar contrato cargado por un Carga,
 *   - devolver depósito,
 *   - eliminar gasto de caja.
 *
 * El PIN se guarda con un hash determinístico (no es bcrypt real, pero
 * tampoco lo guardamos en texto plano). En backend real esto sería un
 * argon2/bcrypt server-side y un challenge por endpoint.
 */

const STORAGE_KEY_PIN = 'llave-inmo:pin-seguridad:v1';
const STORAGE_KEY_UNLOCK = 'llave-inmo:pin-unlock:v1';

/** Ventana durante la cual el PIN sigue desbloqueado tras ingresarlo. */
const UNLOCK_TTL_MS = 5 * 60 * 1000; // 5 minutos

export interface PinConfig {
  /** Hash determinístico del PIN (no es seguro contra brute-force real). */
  hash: string;
  /** Usuario al que pertenece el PIN. */
  usuarioId: string;
  /** Cantidad de intentos fallidos consecutivos. */
  intentosFallidos: number;
  /** Si llega a 5, queda bloqueado hasta que un Admin lo resetee. */
  bloqueadoHasta: string | null;
  createdAt: string;
}

interface UnlockState {
  usuarioId: string;
  hasta: string; // ISO
}

/* ============================================================
 * Hashing — FNV-1a 32-bit + xor con seed, suficiente para no
 * guardar el PIN en plain text dentro de localStorage. NO es
 * seguridad real; en prod usar argon2 / bcrypt.
 * ============================================================ */
function hashPin(pin: string, salt = 'my-alquiler-pin-v1'): string {
  let h = 0x811c9dc5;
  const input = `${salt}::${pin}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // 32-bit hex unsigned
  return (h >>> 0).toString(16).padStart(8, '0');
}

function leerConfig(): PinConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PIN);
    return raw ? (JSON.parse(raw) as PinConfig) : null;
  } catch {
    return null;
  }
}

function guardarConfig(c: PinConfig | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (c) {
      window.localStorage.setItem(STORAGE_KEY_PIN, JSON.stringify(c));
    } else {
      window.localStorage.removeItem(STORAGE_KEY_PIN);
    }
  } catch {
    // ignore
  }
}

function leerUnlock(): UnlockState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_UNLOCK);
    if (!raw) return null;
    const u = JSON.parse(raw) as UnlockState;
    if (Date.parse(u.hasta) <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY_UNLOCK);
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

function guardarUnlock(u: UnlockState | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (u) {
      window.localStorage.setItem(STORAGE_KEY_UNLOCK, JSON.stringify(u));
    } else {
      window.localStorage.removeItem(STORAGE_KEY_UNLOCK);
    }
  } catch {
    // ignore
  }
}

export function tienePinConfigurado(): boolean {
  return !!leerConfig();
}

export function pinEstaBloqueado(): boolean {
  const c = leerConfig();
  if (!c?.bloqueadoHasta) return false;
  return Date.parse(c.bloqueadoHasta) > Date.now();
}

export function pinEstaDesbloqueado(usuarioId = 'admin'): boolean {
  const u = leerUnlock();
  return u?.usuarioId === usuarioId;
}

/**
 * Configura el PIN inicial. Falla si ya existe — para cambiar usar
 * `cambiarPin` desde una ventana ya autenticada.
 */
export function configurarPinInicial(input: {
  pin: string;
  usuarioId?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!/^\d{4,6}$/.test(input.pin)) {
    return { ok: false, error: 'El PIN debe tener entre 4 y 6 dígitos.' };
  }
  if (tienePinConfigurado()) {
    return { ok: false, error: 'Ya hay un PIN configurado — usá Cambiar PIN.' };
  }
  const cfg: PinConfig = {
    hash: hashPin(input.pin),
    usuarioId: input.usuarioId ?? 'admin',
    intentosFallidos: 0,
    bloqueadoHasta: null,
    createdAt: new Date().toISOString(),
  };
  guardarConfig(cfg);
  // Marcamos como desbloqueado al recién configurarlo.
  guardarUnlock({
    usuarioId: cfg.usuarioId,
    hasta: new Date(Date.now() + UNLOCK_TTL_MS).toISOString(),
  });
  return { ok: true };
}

export function cambiarPin(input: {
  pinAnterior: string;
  pinNuevo: string;
}): { ok: true } | { ok: false; error: string } {
  const cfg = leerConfig();
  if (!cfg) return { ok: false, error: 'No hay PIN configurado.' };
  if (hashPin(input.pinAnterior) !== cfg.hash) {
    return { ok: false, error: 'El PIN anterior no coincide.' };
  }
  if (!/^\d{4,6}$/.test(input.pinNuevo)) {
    return { ok: false, error: 'El PIN nuevo debe tener entre 4 y 6 dígitos.' };
  }
  guardarConfig({ ...cfg, hash: hashPin(input.pinNuevo), intentosFallidos: 0 });
  return { ok: true };
}

/**
 * Valida el PIN ingresado por el usuario. Si coincide, deja el sistema
 * "desbloqueado" durante UNLOCK_TTL_MS y devuelve { ok: true }. Si no,
 * incrementa el contador y eventualmente bloquea.
 */
export function validarPin(pin: string): { ok: true } | { ok: false; error: string } {
  const cfg = leerConfig();
  if (!cfg) {
    return { ok: false, error: 'No hay PIN configurado. Pedile al Admin que lo configure.' };
  }
  if (pinEstaBloqueado()) {
    return {
      ok: false,
      error: 'El PIN está bloqueado por demasiados intentos fallidos. Pedile al Admin que lo resetee.',
    };
  }
  if (hashPin(pin) === cfg.hash) {
    guardarConfig({ ...cfg, intentosFallidos: 0, bloqueadoHasta: null });
    guardarUnlock({
      usuarioId: cfg.usuarioId,
      hasta: new Date(Date.now() + UNLOCK_TTL_MS).toISOString(),
    });
    return { ok: true };
  }
  const intentos = cfg.intentosFallidos + 1;
  const next: PinConfig = { ...cfg, intentosFallidos: intentos };
  if (intentos >= 5) {
    next.bloqueadoHasta = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    guardarConfig(next);
    return {
      ok: false,
      error: 'Bloqueado por 30 min — el PIN se ingresó mal 5 veces. Pedí ayuda al Admin.',
    };
  }
  guardarConfig(next);
  return {
    ok: false,
    error: `PIN incorrecto. Te quedan ${5 - intentos} intentos.`,
  };
}

export function resetearPin(): void {
  guardarConfig(null);
  guardarUnlock(null);
}

export function bloquearPin(): void {
  guardarUnlock(null);
}
