/**
 * Qué credenciales recibe un usuario cuando lo crea el alta de una inmobiliaria.
 *
 * Vive en su propio archivo, separado del script de onboarding, por dos razones:
 *
 *  1. **Se puede testear.** `onboarding-real.mjs` lee un JSON de disco y abre una
 *     conexión a la base en el nivel superior: importarlo desde un test lo
 *     ejecutaría contra una DB real. Acá no hay efectos, así que un test puro
 *     puede fijar la regla.
 *
 *  2. **La regla se sostiene por la FORMA, no por la disciplina.**
 *     `passwordDeUsuarioExtra` no recibe al admin. No puede heredarle la
 *     contraseña aunque alguien lo intente: no la tiene a mano. Ése es todo el
 *     punto — antes la línea era
 *
 *         passwordHash: bcrypt.hashSync(u.password ?? A.password, 10)
 *
 *     y ese `?? A.password` alcanzaba para que la cajera terminara con la
 *     contraseña de la administradora. Como `POST /auth/login` compara contra
 *     `passwordHash`, eso no era latente: era un escalamiento a ADMIN, hoy, con
 *     una credencial que la persona ya conoce porque es la suya, y sin dejar
 *     rastro (para el sistema es el admin logueándose).
 */

/** Mínimo de la contraseña de un usuario del panel, cuando se define en el alta. */
export const MIN_PASSWORD = 8;

/**
 * La contraseña de un usuario extra del alta. **Nunca hereda de nadie.**
 *
 * - Sin contraseña propia → `null`. La cuenta entra por OTP
 *   (`POST /auth/usuario/otp/request`), que es el camino que el producto ya
 *   eligió: `POST /auth/registro` también crea al admin con `passwordHash: null`
 *   cuando el alta no trae contraseña.
 * - Con contraseña propia → se exige un mínimo, porque una contraseña de alta la
 *   tipea un tercero en un JSON y suele quedar puesta para siempre.
 *
 * Devuelve `{ password }` o `{ error }`. No lanza: el caller decide si aborta el
 * alta entera o saltea la fila.
 */
export function passwordDeUsuarioExtra(usuario) {
  const p = usuario?.password;
  if (p === undefined || p === null || p === '') return { password: null };
  if (typeof p !== 'string') {
    return { error: `usuariosExtra[${usuario?.email ?? '?'}].password: tiene que ser texto` };
  }
  if (p.length < MIN_PASSWORD) {
    return {
      error: `usuariosExtra[${usuario?.email ?? '?'}].password: mínimo ${MIN_PASSWORD} caracteres (o dejala vacía y que entre por OTP)`,
    };
  }
  return { password: p };
}

/**
 * El PIN NO se escribe nunca desde el alta. Para nadie, ni para el admin.
 *
 * El PIN identifica a una persona frente a las demás que comparten la máquina
 * (es la credencial del cambio rápido de usuario). Una credencial que otro tipeó
 * en un archivo de configuración no cumple esa función: la conoce quien armó el
 * alta. Cada uno crea el suyo desde su propia sesión, con `POST /auth/pin`.
 *
 * Se exporta como constante y no como comentario para que el que venga a agregar
 * `pinHash` al alta se choque con algo que explica por qué no.
 */
export const PIN_SE_CREA_EN_LA_SESION = null;
