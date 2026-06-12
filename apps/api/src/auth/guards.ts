import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  JwtPayloadSchema,
  rolTienePermiso,
  type Capacidad,
  type JwtPayload,
  type JwtUsuario,
} from '@llave/shared';

/** Verifica el Bearer token y devuelve el payload tipado. 401 si falta/inválido. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<JwtPayload | null> {
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ message: 'No autenticado' });
    return null;
  }
  const parsed = JwtPayloadSchema.safeParse(request.user);
  if (!parsed.success) {
    await reply.code(401).send({ message: 'Token inválido' });
    return null;
  }
  return parsed.data;
}

/** Exige un usuario de inmobiliaria (no inquilino), opcionalmente con una capacidad. */
export async function requireUsuario(
  request: FastifyRequest,
  reply: FastifyReply,
  capacidad?: Capacidad,
): Promise<JwtUsuario | null> {
  const payload = await requireAuth(request, reply);
  if (!payload) return null;
  if (payload.kind !== 'usuario') {
    await reply.code(403).send({ message: 'Solo para usuarios del panel' });
    return null;
  }
  if (capacidad && !rolTienePermiso(payload.rol, capacidad)) {
    await reply.code(403).send({ message: `Tu rol no permite: ${capacidad}` });
    return null;
  }
  return payload;
}

/** Exige un inquilino autenticado. */
export async function requireInquilino(request: FastifyRequest, reply: FastifyReply) {
  const payload = await requireAuth(request, reply);
  if (!payload) return null;
  if (payload.kind !== 'inquilino') {
    await reply.code(403).send({ message: 'Solo para inquilinos' });
    return null;
  }
  return payload;
}
