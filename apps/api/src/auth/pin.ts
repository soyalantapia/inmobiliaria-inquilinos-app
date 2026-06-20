import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';

const PIN_MAX_INTENTOS = 5;
const PIN_BLOQUEO_MIN = 15;

export type PinResultado = { ok: true } | { ok: false; code: 400 | 403 | 429; message: string };

/**
 * Verifica el PIN de un usuario con BLOQUEO por intentos fallidos (anti-fuerza-
 * bruta). Antes solo se comparaba el hash sin límite → un PIN de 4 dígitos era
 * forzable por quien tuviera la sesión. Usa los campos ya existentes
 * pinIntentosFallidos + pinBloqueadoHasta (sin migración).
 */
export async function verificarPinUsuario(userId: string, pin: string | undefined): Promise<PinResultado> {
  if (!pin) return { ok: false, code: 400, message: 'Esta acción requiere tu PIN de seguridad' };
  const u = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!u?.pinHash) return { ok: false, code: 403, message: 'No tenés un PIN de seguridad configurado' };

  // ¿Bloqueado por demasiados intentos?
  if (u.pinBloqueadoHasta && u.pinBloqueadoHasta.getTime() > Date.now()) {
    const mins = Math.max(1, Math.ceil((u.pinBloqueadoHasta.getTime() - Date.now()) / 60_000));
    return { ok: false, code: 429, message: `Demasiados intentos con el PIN. Probá de nuevo en ${mins} min.` };
  }

  if (bcrypt.compareSync(pin, u.pinHash)) {
    // Éxito: reseteamos el contador si venía sumando.
    if (u.pinIntentosFallidos > 0 || u.pinBloqueadoHasta) {
      await prisma.usuario.update({
        where: { id: userId },
        data: { pinIntentosFallidos: 0, pinBloqueadoHasta: null },
      });
    }
    return { ok: true };
  }

  // Falló: sumamos intento y bloqueamos al llegar al límite.
  const intentos = u.pinIntentosFallidos + 1;
  const bloquear = intentos >= PIN_MAX_INTENTOS;
  await prisma.usuario.update({
    where: { id: userId },
    data: bloquear
      ? { pinIntentosFallidos: 0, pinBloqueadoHasta: new Date(Date.now() + PIN_BLOQUEO_MIN * 60_000) }
      : { pinIntentosFallidos: intentos },
  });
  return bloquear
    ? { ok: false, code: 429, message: `Demasiados intentos con el PIN. Bloqueado ${PIN_BLOQUEO_MIN} minutos.` }
    : { ok: false, code: 403, message: `PIN incorrecto. Te quedan ${PIN_MAX_INTENTOS - intentos} intento${PIN_MAX_INTENTOS - intentos === 1 ? '' : 's'}.` };
}
