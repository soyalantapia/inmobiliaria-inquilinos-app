import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  JwtPayloadSchema,
  JwtPersonaSchema,
  JwtProfesionalSchema,
  JwtPropietarioSchema,
  rolTienePermiso,
  type Capacidad,
  type JwtPayload,
  type JwtPersona,
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

/**
 * Exige un usuario de inmobiliaria (no inquilino), opcionalmente con una capacidad.
 *
 * REVALIDA CONTRA LA DB en cada request, igual que los guards del co-inquilino y
 * del profesional. No es paranoia: el token dura 15 días (TOKEN_TTL), y hasta
 * ahora el rol salía del JWT y `activo` se miraba SÓLO en el login. O sea que
 * dar de baja a un empleado no le sacaba el acceso —seguía conciliando pagos y
 * rindiendo a propietarios desde su sesión abierta hasta que venciera el token—
 * y bajarle el rol de ADMIN a LECTURA tampoco tenía efecto.
 *
 * El rol AUTORITATIVO es el de la tabla, no el del token: se devuelve ese, así
 * que todo lo que lee `u.rol` aguas abajo ve el vigente. El costo es un lookup
 * por PK por request, dentro del datacenter; el agujero que cierra no admite
 * una ventana de 15 días.
 */
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
  const vigente = await prisma.usuario.findUnique({
    where: { id: payload.userId },
    select: { activo: true, rol: true, inmobiliariaId: true },
  });
  // Borrado o dado de baja → 401 (no 403): la sesión ya no existe, el panel
  // tiene que mandarlo al login en vez de mostrarle un shell roto.
  if (!vigente || !vigente.activo) {
    await reply.code(401).send({ message: 'Tu acceso fue dado de baja' });
    return null;
  }
  // El tenant también sale de la DB: un token no puede seguir apuntando a la
  // inmobiliaria vieja si el usuario se movió (la regla de oro es el aislamiento
  // por inmobiliariaId, y este es el único lugar donde entra al request).
  const actual: JwtUsuario = {
    ...payload,
    rol: vigente.rol,
    inmobiliariaId: vigente.inmobiliariaId,
  };
  if (capacidad && !rolTienePermiso(actual.rol, capacidad)) {
    await reply.code(403).send({ message: `Tu rol no permite: ${capacidad}` });
    return null;
  }
  return actual;
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

/** Datos ya re-validados contra DB del profesional con visita asignada. */
export interface ProfesionalVisitaAcceso {
  visitaId: string;
  inmobiliariaId: string;
  profesionalId: string;
}

/**
 * Exige un profesional con una visita asignada (JWT `kind: 'profesional'`,
 * emitido por GET /visitas-publicas/:token). Re-validamos SIEMPRE contra la DB
 * (no solo el JWT): si la visita se reasignó a otro profesional después de
 * emitido este token, `profesionalId` ya no matchea → 401 (mismo patrón que
 * requireContratoAcceso con co-inquilino: revocación real, no solo confiar en
 * un JWT de larga vida).
 */
export async function requireProfesionalVisita(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ProfesionalVisitaAcceso | null> {
  // Validamos contra JwtProfesionalSchema directo (NO contra JwtPayloadSchema,
  // que lo excluye a propósito — ver comentario en auth.ts del package shared).
  // Mismo patrón que requirePersona: separación estricta entre tipos de token.
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ message: 'No autenticado' });
    return null;
  }
  const parsed = JwtProfesionalSchema.safeParse(request.user);
  if (!parsed.success) {
    await reply.code(403).send({ message: 'Solo para profesionales con visita asignada' });
    return null;
  }
  const payload = parsed.data;
  const visita = await prisma.visitaProfesional.findUnique({
    where: { id: payload.visitaId },
    select: { inmobiliariaId: true, profesionalId: true },
  });
  if (
    !visita ||
    visita.profesionalId !== payload.profesionalId ||
    visita.inmobiliariaId !== payload.inmobiliariaId
  ) {
    await reply.code(401).send({ message: 'Tu acceso a esta visita fue revocado' });
    return null;
  }
  return { visitaId: payload.visitaId, inmobiliariaId: visita.inmobiliariaId, profesionalId: visita.profesionalId };
}

/**
 * Exige un token de "persona" (el que emite /auth/otp/verify tras el OTP). Solo
 * habilita listar y elegir alquileres de ese email — NO da acceso a datos de
 * contrato (eso lo gatea requireInquilino con el JwtInquilino de /elegir).
 */
export async function requirePersona(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<JwtPersona | null> {
  // Validamos contra JwtPersonaSchema (NO contra JwtPayloadSchema, que excluye
  // 'persona'). Así un token normal acá da 403 y un token de persona en los
  // endpoints normales da 401 en requireAuth — separación estricta.
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ message: 'No autenticado' });
    return null;
  }
  const parsed = JwtPersonaSchema.safeParse(request.user);
  if (!parsed.success) {
    await reply.code(403).send({ message: 'Sesión inválida para esta acción' });
    return null;
  }
  return parsed.data;
}

/**
 * Exige un token de PROPIETARIO (portal del propietario, T-23) y revalida contra la DB que
 * la fila siga existiendo.
 *
 * La revalidación no es paranoia: el JWT dura lo que dura, y si al propietario lo borran de
 * la cartera su token seguiría abriendo la puerta hasta que expire. Devolvemos el registro
 * para que el endpoint no lo vuelva a buscar.
 *
 * Valida contra `JwtPropietarioSchema` y NO contra `JwtPayloadSchema` —que excluye este
 * kind— así un token de panel o de inquilino acá da 403, y este token en los endpoints
 * normales da 401 en `requireAuth`. Separación estricta, igual que `persona`.
 */
export async function requirePropietario(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ propietarioId: string; inmobiliariaId: string; email: string } | null> {
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ message: 'No autenticado' });
    return null;
  }
  const parsed = JwtPropietarioSchema.safeParse(request.user);
  if (!parsed.success) {
    await reply.code(403).send({ message: 'Sesión inválida para esta acción' });
    return null;
  }
  // El par (id, inmobiliariaId) se verifica JUNTO: un token con un propietarioId válido
  // pero el inmobiliariaId de otro tenant no matchea y se cae acá.
  const fila = await prisma.propietario.findFirst({
    where: { id: parsed.data.propietarioId, inmobiliariaId: parsed.data.inmobiliariaId },
    select: { id: true, inmobiliariaId: true },
  });
  if (!fila) {
    await reply.code(401).send({ message: 'Sesión vencida' });
    return null;
  }
  // El email va del TOKEN, no de la fila: es el que probó el OTP y no lo puede mover nadie
  // editando el registro. Ver la nota de JwtPropietarioSchema.
  return { propietarioId: fila.id, inmobiliariaId: fila.inmobiliariaId, email: parsed.data.email };
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

/**
 * Exige que el contrato del inquilino esté ACTIVO. Para acciones de ESCRITURA
 * que crean/mutan la relación viva (informar pago, subir boleta, abrir reclamo,
 * gestionar co-inquilinos): un contrato BORRADOR/FINALIZADO/RESCINDIDO no debe
 * aceptar mutaciones aunque el JWT (15 días) siga vivo después de finalizarlo.
 *
 * La LECTURA NO usa este guard a propósito: un ex-inquilino sigue pudiendo ver su
 * contrato pasado, liquidaciones y comprobantes. Por eso va por-endpoint y NO
 * dentro de requireContratoAcceso. Devuelve false (y ya respondió) si no procede.
 */
export async function exigirContratoActivo(
  contratoId: string,
  inmobiliariaId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const contrato = await prisma.contrato.findFirst({
    where: { id: contratoId, inmobiliariaId },
    select: { estado: true },
  });
  if (!contrato || contrato.estado !== 'ACTIVO') {
    await reply.code(409).send({ message: 'El contrato ya no está activo' });
    return false;
  }
  return true;
}
