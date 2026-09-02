/**
 * El nombre de una persona del equipo, para mostrar. Nunca su id.
 *
 * POR QUÉ ES UN MÓDULO Y NO UNA FUNCIÓN SUELTA EN UN ROUTER. Porque vivía privada en
 * `operacion.ts`, y el otro archivo que la necesitaba —`core.ts`— no la tenía a mano. Resultado:
 * `GET /contratos/:id` devolvía `cargadoPor` con el **cuid crudo**, y el panel lo imprimía tal
 * cual adentro de frases:
 *
 * > «Cargado por cmtj10jgm002bugz0o6y2kp8m · rechazado por el admin»
 * > «Contrato rechazado. cmtj10jgm002bugz0o6y2kp8m ya recibió la notificación.»
 *
 * El front ya esperaba un nombre —tiene el fallback `?? 'Usuario desconocido'`—; lo que faltaba
 * era resolverlo de este lado.
 *
 * EL FALLBACK ES 'Panel', y no el id. Un usuario borrado no puede degradar la frase a un
 * identificador ilegible: si no se sabe quién fue, se dice que fue el panel.
 */
import { prisma } from '../db.js';

export async function nombreUsuario(userId: string): Promise<string> {
  const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
  return usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : 'Panel';
}

/**
 * Varios nombres de una, para no hacer N+1 cuando se resuelve una lista.
 * Devuelve un mapa id → nombre; los que no existan quedan afuera (el llamador decide el
 * fallback, que casi siempre es `nombreUsuario`'s 'Panel').
 */
export async function nombresDeUsuarios(userIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, apellido: true },
  });
  return new Map(usuarios.map((u) => [u.id, `${u.nombre} ${u.apellido}`.trim()]));
}
