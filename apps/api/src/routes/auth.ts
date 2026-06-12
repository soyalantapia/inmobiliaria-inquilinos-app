import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import {
  LoginRequestSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  type JwtInquilino,
  type JwtUsuario,
} from '@llave/shared';
import { prisma } from '../db.js';
import { requireAuth, requireUsuario } from '../auth/guards.js';

const TOKEN_TTL = '15d';
const OTP_TTL_MS = 10 * 60 * 1000;
/** Email del inquilino demo (Mariela). El front entra con ?demo=1. */
const DEMO_INQUILINO_EMAIL = 'mariela.sosa@gmail.com';

export async function authRoutes(app: FastifyInstance) {
  // --- Panel inmobiliaria: email + password ---
  app.post('/auth/login', async (request, reply) => {
    const body = LoginRequestSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ message: 'Email y contraseña requeridos' });

    const usuario = await prisma.usuario.findFirst({ where: { email: body.data.email.toLowerCase(), activo: true } });
    if (!usuario?.passwordHash || !bcrypt.compareSync(body.data.password, usuario.passwordHash)) {
      return reply.code(401).send({ message: 'Email o contraseña incorrectos' });
    }
    const payload: JwtUsuario = {
      kind: 'usuario',
      userId: usuario.id,
      inmobiliariaId: usuario.inmobiliariaId,
      rol: usuario.rol,
    };
    const token = app.jwt.sign(payload, { expiresIn: TOKEN_TTL });
    return { token, nombre: `${usuario.nombre} ${usuario.apellido}`.trim(), rol: usuario.rol };
  });

  // --- Inquilino: OTP por email ---
  app.post('/auth/otp/request', async (request, reply) => {
    const body = OtpRequestSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ message: 'Email requerido' });

    const inquilino = await prisma.inquilino.findFirst({ where: { email: body.data.email.toLowerCase() } });
    // Respuesta idéntica exista o no (no enumerar emails)
    if (!inquilino) return { ok: true };

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await prisma.codigoOtp.create({
      data: {
        inquilinoId: inquilino.id,
        codeHash: bcrypt.hashSync(code, 8),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    // Sin proveedor de email todavía: el código sale por el log del server.
    app.log.info({ email: inquilino.email, code }, 'OTP generado');
    return { ok: true };
  });

  app.post('/auth/otp/verify', async (request, reply) => {
    const body = OtpVerifySchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ message: 'Email y código de 6 dígitos requeridos' });

    const inquilino = await prisma.inquilino.findFirst({ where: { email: body.data.email.toLowerCase() } });
    if (!inquilino) return reply.code(401).send({ message: 'Código inválido' });

    let valido = false;
    if (app.env.DEMO_MODE && body.data.code === '000000') {
      valido = true; // backdoor SOLO de demo/dev
    } else {
      const otp = await prisma.codigoOtp.findFirst({
        where: { inquilinoId: inquilino.id, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      if (otp && bcrypt.compareSync(body.data.code, otp.codeHash)) {
        await prisma.codigoOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
        valido = true;
      }
    }
    if (!valido) return reply.code(401).send({ message: 'Código inválido o vencido' });

    const payload: JwtInquilino = {
      kind: 'inquilino',
      inquilinoId: inquilino.id,
      inmobiliariaId: inquilino.inmobiliariaId,
      contratoId: inquilino.contratoId,
    };
    const token = app.jwt.sign(payload, { expiresIn: TOKEN_TTL });
    return { token, nombre: `${inquilino.nombre} ${inquilino.apellido ?? ''}`.trim() };
  });

  // --- Demo: sesión de Mariela con un click (?demo=1) ---
  app.post('/auth/demo', async (_request, reply) => {
    if (!app.env.DEMO_MODE) return reply.code(404).send({ message: 'No disponible' });
    const inquilino = await prisma.inquilino.findFirst({ where: { email: DEMO_INQUILINO_EMAIL } });
    if (!inquilino) return reply.code(500).send({ message: 'Seed demo faltante' });
    const payload: JwtInquilino = {
      kind: 'inquilino',
      inquilinoId: inquilino.id,
      inmobiliariaId: inquilino.inmobiliariaId,
      contratoId: inquilino.contratoId,
    };
    const token = app.jwt.sign(payload, { expiresIn: TOKEN_TTL });
    return { token, nombre: `${inquilino.nombre} ${inquilino.apellido ?? ''}`.trim() };
  });

  // --- Sesión actual ---
  app.get('/auth/me', async (request, reply) => {
    const payload = await requireAuth(request, reply);
    if (!payload) return;
    if (payload.kind === 'usuario') {
      const u = await prisma.usuario.findUnique({ where: { id: payload.userId } });
      if (!u) return reply.code(401).send({ message: 'Usuario inexistente' });
      return { kind: 'usuario', nombre: `${u.nombre} ${u.apellido}`.trim(), email: u.email, rol: u.rol };
    }
    const i = await prisma.inquilino.findUnique({ where: { id: payload.inquilinoId } });
    if (!i) return reply.code(401).send({ message: 'Inquilino inexistente' });
    return { kind: 'inquilino', nombre: `${i.nombre} ${i.apellido ?? ''}`.trim(), email: i.email, telefono: i.telefono, dni: i.dni, contratoId: i.contratoId };
  });

  // --- PIN de seguridad (acciones sensibles) ---
  app.post('/auth/pin/verify', async (request, reply) => {
    const usuario = await requireUsuario(request, reply);
    if (!usuario) return;
    const body = z.object({ pin: z.string().min(4) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ message: 'PIN requerido' });
    const u = await prisma.usuario.findUnique({ where: { id: usuario.userId } });
    const valid = !!u?.pinHash && bcrypt.compareSync(body.data.pin, u.pinHash);
    if (!valid) return reply.code(403).send({ message: 'PIN incorrecto', valid: false });
    return { valid: true };
  });
}
