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
import { enviarOtp } from '../mailer.js';

const TOKEN_TTL = '15d';
const OTP_TTL_MS = 10 * 60 * 1000;
/** Email del inquilino demo (Mariela). El front entra con ?demo=1. */
const DEMO_INQUILINO_EMAIL = 'mariela.sosa@gmail.com';

/**
 * Fin del acceso gratis pre-lanzamiento. Todas las cuentas auto-registradas
 * quedan gratis hasta esta fecha (Trial tipo LANZAMIENTO). Cambiá esta fecha
 * (o seteá FECHA_LANZAMIENTO en el entorno) cuando definas el lanzamiento real.
 */
const FECHA_LANZAMIENTO_DEFAULT = '2026-12-31T23:59:59-03:00';

/** Genera un código de referido único tipo "GOMEZ-4821" a partir del nombre. */
function generarCodigoReferido(nombre: string): string {
  const slug =
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'INMO';
  return `${slug}-${String(randomInt(0, 10000)).padStart(4, '0')}`;
}

const RegistroSchema = z.object({
  inmobiliaria: z.object({
    nombre: z.string().trim().min(2),
    email: z.string().trim().email(),
    telefono: z.string().trim().min(5),
    ciudad: z.string().trim().min(2),
    provincia: z.string().trim().min(2),
  }),
  admin: z.object({
    nombre: z.string().trim().min(2),
    apellido: z.string().trim().min(2),
    password: z.string().min(8),
  }),
});

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

  // --- Auto-onboarding: una inmobiliaria crea su cuenta sola ---
  // Crea Inmobiliaria (piloto pre-lanzamiento) + Usuario ADMIN + Trial gratis,
  // todo en una transacción, y devuelve el token igual que /auth/login.
  app.post('/auth/registro', async (request, reply) => {
    const body = RegistroSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ message: 'Datos de registro incompletos o inválidos' });
    const { inmobiliaria, admin } = body.data;
    const email = inmobiliaria.email.toLowerCase();

    // El email es el login del admin → debe ser único entre usuarios.
    const yaExiste = await prisma.usuario.findFirst({ where: { email } });
    if (yaExiste) return reply.code(409).send({ message: 'Ya existe una cuenta con ese email' });

    const hasta = new Date(process.env.FECHA_LANZAMIENTO ?? FECHA_LANZAMIENTO_DEFAULT);
    const passwordHash = bcrypt.hashSync(admin.password, 10);

    // Reintentamos por si el código de referido colisiona (unique).
    let usuario;
    for (let intento = 0; intento < 5; intento++) {
      try {
        const creado = await prisma.$transaction(async (tx) => {
          const inmo = await tx.inmobiliaria.create({
            data: {
              nombre: inmobiliaria.nombre,
              email,
              telefono: inmobiliaria.telefono,
              // Fiscales/dirección completa: se completan después desde el panel.
              cuit: '',
              matricula: '',
              direccionCalle: '',
              direccionAltura: '',
              direccionPiso: '',
              direccionCiudad: inmobiliaria.ciudad,
              direccionProvincia: inmobiliaria.provincia,
              direccionCp: '',
              esPiloto: true, // cuenta pre-lanzamiento
              codigoReferido: generarCodigoReferido(inmobiliaria.nombre),
            },
          });
          const u = await tx.usuario.create({
            data: {
              inmobiliariaId: inmo.id,
              nombre: admin.nombre,
              apellido: admin.apellido,
              email,
              rol: 'ADMIN',
              passwordHash,
              activo: true,
            },
          });
          await tx.trial.create({
            data: {
              inmobiliariaId: inmo.id,
              tipo: 'LANZAMIENTO',
              motivo: 'Auto-onboarding pre-lanzamiento',
              desde: new Date(),
              hasta,
              activadoPor: 'self-service',
            },
          });
          return u;
        });
        usuario = creado;
        break;
      } catch (err) {
        const msg = (err as Error).message;
        if (intento < 4 && /codigoReferido|Unique constraint/i.test(msg)) continue; // colisión de código → reintentar
        request.log.error({ err: msg }, 'Fallo el registro auto-servicio');
        return reply.code(500).send({ message: 'No se pudo crear la cuenta. Intentá de nuevo.' });
      }
    }
    if (!usuario) return reply.code(500).send({ message: 'No se pudo crear la cuenta. Intentá de nuevo.' });

    const payload: JwtUsuario = {
      kind: 'usuario',
      userId: usuario.id,
      inmobiliariaId: usuario.inmobiliariaId,
      rol: usuario.rol,
    };
    const token = app.jwt.sign(payload, { expiresIn: TOKEN_TTL });
    return reply.code(201).send({ token, nombre: `${usuario.nombre} ${usuario.apellido}`.trim(), rol: usuario.rol });
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
    // Envío por SMTP si está configurado (SMTP_HOST/USER/PASS); si no, fallback
    // a loguear el código (dev/prueba). No filtramos el resultado al cliente.
    // Lo encontramos por email, así que usamos el que matcheó (tipado nullable).
    const destino = inquilino.email ?? body.data.email.toLowerCase();
    try {
      const enviado = await enviarOtp(destino, code);
      if (!enviado) app.log.info({ email: destino, code }, 'OTP generado (SMTP no configurado — código por log)');
      else app.log.info({ email: destino }, 'OTP enviado por email');
    } catch (err) {
      // No romper el login si el SMTP falla: logueamos el código como respaldo.
      app.log.error({ email: destino, code, err: (err as Error).message }, 'OTP: fallo el envío SMTP — código por log');
    }
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
      const u = await prisma.usuario.findUnique({
        where: { id: payload.userId },
        include: { inmobiliaria: { include: { trial: true } } },
      });
      if (!u) return reply.code(401).send({ message: 'Usuario inexistente' });
      const trial = u.inmobiliaria.trial;
      const diasRestantes = trial
        ? Math.max(0, Math.ceil((trial.hasta.getTime() - Date.now()) / 86_400_000))
        : null;
      return {
        kind: 'usuario',
        nombre: `${u.nombre} ${u.apellido}`.trim(),
        email: u.email,
        rol: u.rol,
        inmobiliaria: u.inmobiliaria.nombre,
        esPiloto: u.inmobiliaria.esPiloto,
        // Perfil fiscal incompleto si el auto-onboarding dejó cuit/dirección vacíos.
        perfilFiscalCompleto: !!(u.inmobiliaria.cuit && u.inmobiliaria.direccionCalle),
        trial: trial
          ? { tipo: trial.tipo, hasta: trial.hasta, diasRestantes, vigente: trial.hasta.getTime() >= Date.now() }
          : null,
      };
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
