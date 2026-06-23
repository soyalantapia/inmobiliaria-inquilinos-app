import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import {
  LoginRequestSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  type JwtCoInquilino,
  type JwtInquilino,
  type JwtUsuario,
} from '@llave/shared';
import { prisma } from '../db.js';
import { requireAuth, requireUsuario } from '../auth/guards.js';
import { verificarPinUsuario } from '../auth/pin.js';
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

    const hasta = new Date(app.env.FECHA_LANZAMIENTO ?? FECHA_LANZAMIENTO_DEFAULT);
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

    // El email de inquilino es único POR inmobiliaria (@@unique([inmobiliariaId,
    // email])), no global: el mismo email puede existir en dos inmobiliarias.
    // Generamos un OTP para CADA cuenta con ese email (mismo código, un solo
    // mail) y al verificar la identidad sale del OTP que matchea — nunca de un
    // findFirst arbitrario (que podía loguear contra el tenant equivocado).
    const emailLc = body.data.email.toLowerCase();
    const inquilinos = await prisma.inquilino.findMany({ where: { email: emailLc }, select: { id: true } });
    // Respuesta idéntica exista o no (no enumerar emails)
    if (inquilinos.length === 0) return { ok: true };

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = bcrypt.hashSync(code, 8);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await prisma.codigoOtp.createMany({
      data: inquilinos.map((i) => ({ inquilinoId: i.id, codeHash, expiresAt })),
    });
    // Envío por SMTP si está configurado (SMTP_HOST/USER/PASS); si no, fallback
    // a loguear el código (dev/prueba). No filtramos el resultado al cliente.
    const destino = emailLc;
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

    // Resolvemos la identidad por el OTP que matchea, no por findFirst-por-email:
    // así un email compartido entre inmobiliarias no puede loguear contra la
    // cuenta equivocada (la identidad sale de la fila OTP validada).
    const emailLc = body.data.email.toLowerCase();
    const inquilinos = await prisma.inquilino.findMany({ where: { email: emailLc } });
    if (inquilinos.length === 0) return reply.code(401).send({ message: 'Código inválido' });

    let inquilino: (typeof inquilinos)[number] | null = null;
    if (app.env.DEMO_MODE && body.data.code === '000000' && process.env.NODE_ENV !== 'production') {
      inquilino = inquilinos[0] ?? null; // backdoor SOLO de demo/dev (M-1: excluir prod)
    } else {
      const ids = inquilinos.map((i) => i.id);
      const otps = await prisma.codigoOtp.findMany({
        where: { inquilinoId: { in: ids }, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      for (const otp of otps) {
        if (bcrypt.compareSync(body.data.code, otp.codeHash)) {
          await prisma.codigoOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
          inquilino = inquilinos.find((i) => i.id === otp.inquilinoId) ?? null;
          break;
        }
      }
    }
    if (!inquilino) return reply.code(401).send({ message: 'Código inválido o vencido' });

    const payload: JwtInquilino = {
      kind: 'inquilino',
      inquilinoId: inquilino.id,
      inmobiliariaId: inquilino.inmobiliariaId,
      contratoId: inquilino.contratoId,
    };
    const token = app.jwt.sign(payload, { expiresIn: TOKEN_TTL });
    return { token, nombre: `${inquilino.nombre} ${inquilino.apellido ?? ''}`.trim() };
  });

  // --- Co-inquilino: invitación por link (la comparte el titular) ---
  // El token lo firma POST /co-inquilinos (kind 'co-invitacion', 7d). Estas
  // rutas son PÚBLICAS: las abre quien recibió el link. La identidad y el
  // permiso se leen de la DB (el token solo identifica la invitación), así un
  // token viejo o manipulado no puede elevar permisos.
  function leerInvitacion(token: string): { coInquilinoId: string } | null {
    try {
      const d = app.jwt.verify<{ kind?: string; coInquilinoId?: string }>(token);
      if (d?.kind !== 'co-invitacion' || !d.coInquilinoId) return null;
      return { coInquilinoId: d.coInquilinoId };
    } catch {
      return null;
    }
  }

  // Detalle de la invitación para la pantalla del link (sin sesión).
  app.get('/co-invitacion/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const inv = leerInvitacion(token);
    if (!inv) return reply.code(400).send({ message: 'Invitación inválida o vencida' });
    const co = await prisma.coInquilino.findUnique({
      where: { id: inv.coInquilinoId },
      include: {
        contrato: { select: { propiedad: { select: { direccion: true, ciudad: true } } } },
        inmobiliaria: { select: { nombre: true } },
      },
    });
    if (!co) return reply.code(404).send({ message: 'Invitación inexistente' });
    return {
      nombre: co.nombre,
      relacion: co.relacion,
      permiso: co.permiso,
      estado: co.estado,
      direccion: co.contrato?.propiedad?.direccion ?? '',
      ciudad: co.contrato?.propiedad?.ciudad ?? '',
      inmobiliaria: co.inmobiliaria?.nombre ?? '',
    };
  });

  // Aceptar la invitación → marca ACEPTADO y emite la sesión del co-inquilino.
  app.post('/co-invitacion/:token/aceptar', async (request, reply) => {
    const { token } = request.params as { token: string };
    const inv = leerInvitacion(token);
    if (!inv) return reply.code(400).send({ message: 'Invitación inválida o vencida' });
    const co = await prisma.coInquilino.findUnique({
      where: { id: inv.coInquilinoId },
      include: { contrato: { select: { propiedad: { select: { direccion: true, ciudad: true } } } } },
    });
    if (!co) return reply.code(404).send({ message: 'Invitación inexistente' });
    // El link de invitación es de UN SOLO USO. updateMany condicionado por
    // estado != 'ACEPTADO' = lock atómico: sólo la primera aceptación gana y pasa
    // a ACEPTADO; cualquier re-uso del link (o una carrera de dos aceptaciones)
    // da count 0 → 409. Antes el link servía infinitas veces dentro de su TTL de
    // 7 días: cualquiera que lo tuviera podía generar sesiones de co-inquilino.
    // Para re-habilitar el acceso, el titular regenera el link
    // (POST /co-inquilinos/:id/link), que vuelve a dejar la invitación en PENDIENTE.
    const aceptada = await prisma.coInquilino.updateMany({
      where: { id: co.id, estado: { not: 'ACEPTADO' } },
      data: { estado: 'ACEPTADO', aceptadoAt: new Date() },
    });
    if (aceptada.count === 0) {
      return reply
        .code(409)
        .send({ message: 'Esta invitación ya fue aceptada. Pedile al titular que te reenvíe el link.' });
    }
    const payload: JwtCoInquilino = {
      kind: 'co-inquilino',
      coInquilinoId: co.id,
      inmobiliariaId: co.inmobiliariaId,
      contratoId: co.contratoId,
      permiso: co.permiso,
    };
    const tokenSesion = app.jwt.sign(payload, { expiresIn: TOKEN_TTL });
    return {
      token: tokenSesion,
      nombre: co.nombre,
      email: co.email,
      permiso: co.permiso,
      contratoId: co.contratoId,
      direccion: co.contrato?.propiedad?.direccion ?? '',
      ciudad: co.contrato?.propiedad?.ciudad ?? '',
    };
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
        // ¿Ya tiene PIN de seguridad en la DB? El panel lo usa para mostrar
        // "Configurar" vs "Cambiar" (antes el PIN era solo localStorage y nunca
        // llegaba al backend → las acciones sensibles daban 403 para siempre).
        tienePin: !!u.pinHash,
        // Perfil fiscal incompleto si el auto-onboarding dejó cuit/dirección vacíos.
        perfilFiscalCompleto: !!(u.inmobiliaria.cuit && u.inmobiliaria.direccionCalle),
        trial: trial
          ? { tipo: trial.tipo, hasta: trial.hasta, diasRestantes, vigente: trial.hasta.getTime() >= Date.now() }
          : null,
      };
    }
    if (payload.kind === 'co-inquilino') {
      const co = await prisma.coInquilino.findUnique({ where: { id: payload.coInquilinoId } });
      if (!co) return reply.code(401).send({ message: 'Co-inquilino inexistente' });
      return {
        kind: 'co-inquilino',
        nombre: co.nombre,
        email: co.email,
        telefono: co.telefono,
        dni: co.dni,
        contratoId: co.contratoId,
        permiso: co.permiso,
        esCoInquilino: true,
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
    // verificarPinUsuario aplica el bloqueo anti-fuerza-bruta (lockout por
    // intentos), igual que las acciones de plata/operación.
    const r = await verificarPinUsuario(usuario.userId, body.data.pin);
    if (!r.ok) return reply.code(r.code).send({ message: r.message, valid: false });
    return { valid: true };
  });

  // Configurar / cambiar el PIN de seguridad → lo PERSISTE en la DB
  // (usuario.pinHash). Antes el panel solo lo guardaba en localStorage y el
  // backend nunca lo recibía, así que una cuenta nueva (registro self-service)
  // no podía validar pagos, rendir ni aprobar (verificarPin → 403). Cada
  // usuario configura su propio PIN; si ya tiene uno, exige el PIN actual.
  app.post('/auth/pin', async (request, reply) => {
    const usuario = await requireUsuario(request, reply);
    if (!usuario) return;
    const body = z
      .object({
        pinNuevo: z.string().regex(/^\d{4,6}$/, 'El PIN debe tener 4 a 6 dígitos'),
        pinActual: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: body.error.issues[0]?.message ?? 'PIN inválido' });
    }
    const u = await prisma.usuario.findUnique({ where: { id: usuario.userId } });
    if (!u) return reply.code(401).send({ message: 'Usuario inexistente' });
    // Si ya hay PIN, hay que probar que sos vos (PIN actual correcto) antes de
    // cambiarlo. Vía verificarPinUsuario para heredar el lockout anti-fuerza-bruta:
    // antes era un bcrypt.compareSync pelado → cambiar de PIN era un oráculo sin
    // límite de intentos para adivinar el PIN actual con una sesión abierta.
    if (u.pinHash) {
      const r = await verificarPinUsuario(u.id, body.data.pinActual);
      if (!r.ok) return reply.code(r.code).send({ message: r.message });
    }
    await prisma.usuario.update({
      where: { id: u.id },
      data: { pinHash: bcrypt.hashSync(body.data.pinNuevo, 10) },
    });
    return { ok: true, tienePin: true };
  });
}
