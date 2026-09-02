import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';

/**
 * PIN del CONMUTADOR DE USUARIOS (T-25) — nada más que eso.
 *
 * ⚠️ ARCHIVO SEPARADO A PROPÓSITO, y no importa nada de `auth/pin.ts`.
 *
 * `verificarPinUsuario` (`auth/pin.ts`) es un kill-switch que SIEMPRE aprueba, y lo llaman seis
 * endpoints de plata (`plata.ts` ×2, `operacion.ts` ×2, `core.ts` ×2). Es una decisión de
 * producto: **ninguna acción de plata pide PIN**. Si esa función volviera a verificar de verdad,
 * los seis endpoints empezarían a exigir un PIN que casi nadie tiene cargado, y el panel se
 * rompería entero.
 *
 * Por eso el conmutador trae su propia verificación en vez de "revivir" aquella. Son dos cosas
 * distintas que se llaman parecido:
 *
 *   · `verificarPinUsuario`   → gatea ACCIONES. Desactivado a propósito. NO TOCAR.
 *   · `verificarPinConmutador` → gatea CAMBIAR DE PERSONA. Es lo único que usa el PIN hoy.
 *
 * Qué protege esto de verdad, dicho sin maquillaje: un PIN de 5 dígitos que se tipea treinta
 * veces por día en un mostrador con público del otro lado del vidrio **no es un secreto fuerte**.
 * El lockout no protege contra el que te miró teclear. Lo que sí da es **trazabilidad con
 * fricción baja**: cada cambio y cada intento fallido quedan en auditoría, y el rol autoritativo
 * lo sigue resolviendo la DB en cada request (`guards.ts`), no el PIN.
 */

/** Fallos consecutivos antes de bloquear. */
const MAX_INTENTOS = 5;
/** Cuánto dura el bloqueo. */
const BLOQUEO_MS = 30 * 60 * 1000;

export type ResultadoPin =
  | { ok: true }
  | { ok: false; code: 403; message: string; intentosRestantes: number }
  | { ok: false; code: 423; message: string; bloqueadoHasta: Date }
  | { ok: false; code: 409; message: string };

/**
 * PINs que no se aceptan al SETEAR. Es la capa que más rinde de las tres: un atacante humano
 * prueba veinte PINs, no cien mil, y casi todos están acá.
 */
const TRIVIALES = new Set([
  '00000', '11111', '22222', '33333', '44444', '55555', '66666', '77777', '88888', '99999',
  '12345', '54321', '01234', '43210', '12321', '11223', '13579', '24680',
]);

export function pinEsTrivial(pin: string): boolean {
  return TRIVIALES.has(pin);
}

/**
 * Verifica el PIN de `usuarioId` para autorizar un cambio de usuario.
 *
 * EL ORDEN DE LOS PASOS IMPORTA:
 *  1. Se lee el estado y se corta si está bloqueado — ANTES de correr bcrypt. `bcryptjs` es JS
 *     puro y bloquea el event loop ~60-100 ms; no se gasta eso en un intento ya rechazado.
 *  2. El contador de fallos se incrementa de forma **atómica** (`{ increment: 1 }`) y la decisión
 *     de bloquear se toma con el valor DEVUELTO por el update, nunca con uno leído antes.
 *
 * Ese segundo punto no es un detalle de estilo. Con un read-then-write, N intentos concurrentes
 * leen todos el mismo contador, escriben todos `1`, y `pinBloqueadoHasta` **nunca se puebla**: el
 * techo real deja de ser el lockout y pasa a ser el rate limit por IP, y romper 5 dígitos baja de
 * ~208 días a ~9. El bloqueo existiría en el código y no en la realidad.
 */
export async function verificarPinConmutador(
  usuarioId: string,
  pin: string | undefined,
): Promise<ResultadoPin> {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { pinHash: true, pinBloqueadoHasta: true },
  });

  // Sin PIN no hay nada que verificar. 409 y no 403: no es "te equivocaste", es "todavía no lo
  // definió" — y el panel tiene que poder decirlo distinto.
  if (!u?.pinHash) {
    return { ok: false, code: 409, message: 'Esa persona todavía no definió su PIN.' };
  }

  const ahora = new Date();
  if (u.pinBloqueadoHasta && u.pinBloqueadoHasta > ahora) {
    return {
      ok: false,
      code: 423,
      message: 'Demasiados intentos fallidos. Probá de nuevo más tarde.',
      bloqueadoHasta: u.pinBloqueadoHasta,
    };
  }

  if (pin && bcrypt.compareSync(pin, u.pinHash)) {
    // Acierto: se limpia todo. Un bloqueo vencido tampoco tiene que quedar dando vueltas.
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { pinIntentosFallidos: 0, pinBloqueadoHasta: null },
    });
    return { ok: true };
  }

  const r = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { pinIntentosFallidos: { increment: 1 } },
    select: { pinIntentosFallidos: true },
  });

  if (r.pinIntentosFallidos >= MAX_INTENTOS) {
    const hasta = new Date(ahora.getTime() + BLOQUEO_MS);
    await prisma.usuario.update({
      where: { id: usuarioId },
      // El contador vuelve a 0 junto con el bloqueo: al vencer los 30 minutos arrancan 5
      // intentos nuevos, sin escalada progresiva.
      data: { pinIntentosFallidos: 0, pinBloqueadoHasta: hasta },
    });
    return {
      ok: false,
      code: 423,
      message: 'Demasiados intentos fallidos. Probá de nuevo más tarde.',
      bloqueadoHasta: hasta,
    };
  }

  return {
    ok: false,
    code: 403,
    message: 'PIN incorrecto.',
    intentosRestantes: MAX_INTENTOS - r.pinIntentosFallidos,
  };
}
