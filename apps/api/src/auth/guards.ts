import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  JwtPayloadSchema,
  rolTienePermiso,
  type Capacidad,
  type JwtPayload,
  type JwtUsuario,
} from '@llave/shared';
import { prisma } from '../db.js';

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

/** Exige un inquilino TITULAR autenticado (no co-inquilino). */
export async function requireInquilino(request: FastifyRequest, reply: FastifyReply) {
  const payload = await requireAuth(request, reply);
  if (!payload) return null;
  if (payload.kind !== 'inquilino') {
    await reply.code(403).send({ message: 'Solo para inquilinos' });
    return null;
  }
  return payload;
}

type Permiso = 'VER' | 'PAGAR' | 'COMPLETO';
const RANGO_PERMISO: Record<Permiso, number> = { VER: 1, PAGAR: 2, COMPLETO: 3 };

/** Acceso resuelto a un contrato: sea el titular o un co-inquilino. */
export type ContratoAcceso = {
  inmobiliariaId: string;
  /** null solo para un titular sin contrato activo (el endpoint decide). */
  contratoId: string | null;
  permiso: Permiso;
  esCoInquilino: boolean;
  inquilinoId: string | null;
  coInquilinoId: string | null;
};

/**
 * Exige acceso al contrato: lo cumple el inquilino TITULAR (permiso COMPLETO) o
 * un CO-INQUILINO con permiso suficiente. `minPermiso` gatea las acciones de
 * escritura (p.ej. informar un pago exige PAGAR). El titular siempre pasa.
 */
export async function requireContratoAcceso(
  request: FastifyRequest,
  reply: FastifyReply,
  minPermiso: Permiso = 'VER',
): Promise<ContratoAcceso | null> {
  const payload = await requireAuth(request, reply);
  if (!payload) return null;
  if (payload.kind === 'inquilino') {
    return {
      inmobiliariaId: payload.inmobiliariaId,
      contratoId: payload.contratoId,
      permiso: 'COMPLETO',
      esCoInquilino: false,
      inquilinoId: payload.inquilinoId,
      coInquilinoId: null,
    };
  }
  if (payload.kind === 'co-inquilino') {
    // El token dura 15 días, así que NO confiamos en el permiso/estado del JWT:
    // los revalidamos contra la DB en cada request. Si el titular sacó el acceso
    // o bajó el permiso, surte efecto al instante (antes el co-inquilino seguía
    // entrando con su permiso viejo hasta que venciera el token = agujero real).
    const co = await prisma.coInquilino.findUnique({ where: { id: payload.coInquilinoId } });
    if (!co || co.estado !== 'ACEPTADO') {
      await reply.code(401).send({ message: 'Tu acceso fue revocado' });
      return null;
    }
    if (co.contratoId !== payload.contratoId || co.inmobiliariaId !== payload.inmobiliariaId) {
      await reply.code(401).send({ message: 'Tu acceso fue revocado' });
      return null;
    }
    if (RANGO_PERMISO[co.permiso] < RANGO_PERMISO[minPermiso]) {
      await reply.code(403).send({ message: `Tu acceso (${co.permiso}) no alcanza para esta acción` });
      return null;
    }
    return {
      inmobiliariaId: co.inmobiliariaId,
      contratoId: co.contratoId,
      permiso: co.permiso,
      esCoInquilino: true,
      inquilinoId: null,
      coInquilinoId: co.id,
    };
  }
  await reply.code(403).send({ message: 'Solo para inquilinos' });
  return null;
}
