import type { FastifyInstance } from 'fastify';
import { reportarErrorAlSonar } from '../lib/sonar-server-events.js';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import {
  LoginRequestSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  type JwtCoInquilino,
  type JwtInquilino,
  type JwtPersona,
  type JwtUsuario,
} from '@llave/shared';
import { prisma } from '../db.js';
import { requireAuth, requirePersona, requireUsuario } from '../auth/guards.js';
import { verificarPinUsuario } from '../auth/pin.js';
import { enviarOtp, enviarBienvenidaInmobiliaria } from '../mailer.js';

const TOKEN_TTL = '15d';
const OTP_TTL_MS = 10 * 60 * 1000;

/**
 * El código OTP NUNCA va al log en producción. Loguearlo era un fallback de desarrollo
 * (cuando no hay SMTP configurado) que quedó activo en prod: ante cualquier excepción del
 * SMTP se escribía el código junto al email, y los logs de Railway los ve cualquiera con
 * acceso al proyecto — o sea, un canal de login a cualquier cuenta. Fuera de producción
 * sigue apareciendo, que es donde hace falta para probar sin mail.
 */
const codeEnLog = (code: string): { code?: string } =>
  process.env.NODE_ENV === 'production' ? {} : { code };
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
    // Teléfono opcional en el alta: bajamos la fricción del registro. Si lo
    // mandan vacío, se completa después desde el panel (igual que cuit/dirección).
    // Validamos min(5) sólo cuando viene un valor no vacío.
    telefono: z
      .string()
      .trim()
      .refine((v) => v === '' || v.length >= 5, { message: 'Teléfono inválido' })
      .optional(),
    // Ciudad/provincia salieron del alta (se completan después desde el panel).
    // Opcionales por compatibilidad con clientes que aún las manden.
    ciudad: z.string().trim().optional(),
    provincia: z.string().trim().optional(),
  }),
  admin: z.object({
    nombre: z.string().trim().min(2),
    apellido: z.string().trim().min(2),
    // El alta ya no pide contraseña: el panel entra por OTP. `password` es
    // opcional sólo como backstop (si algún cliente la manda, la guardamos).
    password: z.string().min(8).optional(),
  }),
});

/**
 * Lista los alquileres (contratos) registrados con un email, de TODAS las
 * inmobiliarias. Cada fila Inquilino es un contrato (1:1 con Contrato). Es la
 * base del selector "Mis alquileres": una persona = un email = N alquileres.
 */
async function alquileresDeEmail(email: string) {
  const inquilinos = await prisma.inquilino.findMany({
    where: { email, contratoId: { not: null } },
    include: {
      inmobiliaria: { select: { nombre: true } },
      contrato: { select: { estado: true, propiedad: { select: { direccion: true, ciudad: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return inquilinos.map((i) => ({
    inquilinoId: i.id,
    nombre: `${i.nombre} ${i.apellido ?? ''}`.trim(),
    inmobiliaria: i.inmobiliaria.nombre,
    direccion: i.contrato?.propiedad?.direccion ?? '',
    ciudad: i.contrato?.propiedad?.ciudad ?? '',
    // Estado del contrato para que la pantalla de selección distinga un alquiler
    // vigente de uno finalizado (el ex-inquilino conserva acceso de solo lectura).
    estado: i.contrato?.estado ?? null,
  }));
}

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
    // Sin contraseña en el alta → passwordHash null. La cuenta entra por OTP;
    // el /auth/login con password sólo aplica si alguna vez se setea una.
    const passwordHash = admin.password ? bcrypt.hashSync(admin.password, 10) : null;

    // Reintentamos por si el código de referido colisiona (unique).
    let usuario;
    for (let intento = 0; intento < 5; intento++) {
      try {
        const creado = await prisma.$transaction(async (tx) => {
          const inmo = await tx.inmobiliaria.create({
            data: {
              nombre: inmobiliaria.nombre,
              email,
              telefono: inmobiliaria.telefono ?? '',
              // Fiscales/dirección completa: se completan después desde el panel.
              cuit: '',
              matricula: '',
              direccionCalle: '',
              direccionAltura: '',
              direccionPiso: '',
              direccionCiudad: inmobiliaria.ciudad ?? '',
              direccionProvincia: inmobiliaria.provincia ?? '',
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
        // Este 500 lo armamos a mano, así que NUNCA pasa por el setErrorHandler y sin esta
        // línea no llegaría a Sonar. Es el peor lugar para tener un punto ciego: si una
        // migración rompe el create(), todas las altas nuevas fallan, el prospecto reporta
        // el bug desde el browser y el ticket llega sin contexto del backend — exactamente
        // el problema que la correlación viene a resolver. No re-lanzamos porque el mensaje
        // amable de acá es mejor que el "Error interno" genérico del handler global.
        reportarErrorAlSonar(app.env, {
          correlationId: request.sonarCorrelationId || undefined,
          serverError: {
            errorType: (err as Error).name || 'Error',
            message: msg,
            stack: (err as Error).stack,
            route: request.routeOptions?.url ?? request.url,
            statusCode: 500,
          },
          context: { method: request.method, flujo: 'registro-auto-servicio' },
        });
        return reply.code(500).send({ message: 'No se pudo crear la cuenta. Intentá de nuevo.' });
      }
    }
    if (!usuario) {
      // Mismo punto ciego que el catch de arriba: 500 armado a mano, no pasa por el handler.
      reportarErrorAlSonar(app.env, {
        correlationId: request.sonarCorrelationId || undefined,
        serverError: {
          errorType: 'RegistroSinUsuario',
          message: 'El registro auto-servicio agotó los 5 reintentos sin crear el usuario',
          route: request.routeOptions?.url ?? request.url,
          statusCode: 500,
        },
        context: { method: request.method, flujo: 'registro-auto-servicio' },
      });
      return reply.code(500).send({ message: 'No se pudo crear la cuenta. Intentá de nuevo.' });
    }

    // Email de bienvenida — best-effort, FUERA de la transacción: confirma el
    // alta, da los primeros pasos y deja a mano el link del panel. Si el SMTP
    // falla NO rompemos el registro (el token ya está emitido y la cuenta creada).
    try {
      const enviado = await enviarBienvenidaInmobiliaria(email, usuario.nombre, inmobiliaria.nombre);
      if (!enviado) request.log.info({ email }, 'Bienvenida inmo: SMTP no configurado — se omite el mail');
      else request.log.info({ email }, 'Bienvenida inmo enviada por email');
    } catch (err) {
      request.log.error({ email, err: (err as Error).message }, 'Bienvenida inmo: fallo el envío SMTP (no bloquea el alta)');
    }

    const payload: JwtUsuario = {
      kind: 'usuario',
      userId: usuario.id,
      inmobiliariaId: usuario.inmobiliariaId,
      rol: usuario.rol,
    };
    const token = app.jwt.sign(payload, { expiresIn: TOKEN_TTL });
    return reply.code(201).send({ token, nombre: `${usuario.nombre} ${usuario.apellido}`.trim(), rol: usuario.rol });
  });

  // --- Panel inmobiliaria: login por OTP (sin contraseña) ---
  // Mismo motor que el OTP del inquilino, pero contra el modelo Usuario. El
  // /auth/login con contraseña sigue existiendo como backstop de emergencia,
  // pero el panel ya entra por código.
  app.post('/auth/usuario/otp/request', async (request, reply) => {
    const body = OtpRequestSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ message: 'Email requerido' });

    const emailLc = body.data.email.toLowerCase();
    // Un OTP por cada usuario ACTIVO con ese email (en la práctica el email es
    // único: el registro lo enforça global).
    const usuarios = await prisma.usuario.findMany({
      where: { email: emailLc, activo: true },
      select: { id: true },
    });
    // UX self-service: devolvemos `existe` para que el panel mande a /registro
    // a quien todavía no tiene cuenta, en vez de hacerlo esperar un código que
    // nunca llega. Trade-off consciente: permite saber si un email es cliente,
    // aceptable en un alta B2B donde registrarse es público de todos modos.
    if (usuarios.length === 0) return { ok: true, existe: false };

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = bcrypt.hashSync(code, 8);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    // Invalidamos los códigos anteriores sin usar ANTES de emitir el nuevo: pedir un
    // código nuevo deja sin efecto al viejo (que es lo que el usuario espera).
    //
    // Es también defensa contra fuerza bruta: sin esto, cada request dejaba OTRO código
    // vivo durante 10 minutos, así que pidiendo N veces se multiplicaba por N la chance de
    // acertar 6 dígitos al azar. Además acota el loop de bcrypt del verify a 1 comparación,
    // que era el otro problema (bcryptjs es JS puro y bloquea el event loop del proceso).
    await prisma.codigoOtpUsuario.updateMany({
      where: { usuarioId: { in: usuarios.map((u) => u.id) }, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.codigoOtpUsuario.createMany({
      data: usuarios.map((u) => ({ usuarioId: u.id, codeHash, expiresAt })),
    });
    // Envío por SMTP si está configurado; si no, fallback a loguear el código
    // (dev). No filtramos el resultado al cliente.
    try {
      const enviado = await enviarOtp(emailLc, code);
      if (!enviado) app.log.info({ email: emailLc, ...codeEnLog(code) }, 'OTP admin generado (SMTP no configurado)');
      else app.log.info({ email: emailLc }, 'OTP admin enviado por email');
    } catch (err) {
      app.log.error({ email: emailLc, ...codeEnLog(code), err: (err as Error).message }, 'OTP admin: fallo el envío SMTP');
    }
    return { ok: true, existe: true };
  });

  app.post('/auth/usuario/otp/verify', async (request, reply) => {
    const body = OtpVerifySchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ message: 'Email y código de 6 dígitos requeridos' });

    const emailLc = body.data.email.toLowerCase();
    const usuarios = await prisma.usuario.findMany({ where: { email: emailLc, activo: true } });
    if (usuarios.length === 0) return reply.code(401).send({ message: 'Código inválido' });

    // La identidad sale de la fila OTP que matchea, no de un findFirst-por-email.
    let usuario: (typeof usuarios)[number] | null = null;
    if (app.env.DEMO_MODE && body.data.code === '000000' && process.env.NODE_ENV !== 'production') {
      usuario = usuarios[0] ?? null; // backdoor SOLO de demo/dev (excluye prod)
    } else {
      const ids = usuarios.map((u) => u.id);
      const otps = await prisma.codigoOtpUsuario.findMany({
        where: { usuarioId: { in: ids }, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      for (const otp of otps) {
        if (bcrypt.compareSync(body.data.code, otp.codeHash)) {
          await prisma.codigoOtpUsuario.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
          usuario = usuarios.find((u) => u.id === otp.usuarioId) ?? null;
          break;
        }
      }
    }
    if (!usuario) return reply.code(401).send({ message: 'Código inválido o vencido' });

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
    // Igual que en el OTP del panel: pedir un código nuevo invalida el anterior. Sin esto
    // se acumulaban códigos válidos y cada pedido aumentaba la chance de acertar por
    // fuerza bruta (además de alargar el loop de bcrypt del verify).
    await prisma.codigoOtp.updateMany({
      where: { inquilinoId: { in: inquilinos.map((i) => i.id) }, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.codigoOtp.createMany({
      data: inquilinos.map((i) => ({ inquilinoId: i.id, codeHash, expiresAt })),
    });
    // Envío por SMTP si está configurado (SMTP_HOST/USER/PASS); si no, fallback
    // a loguear el código (dev/prueba). No filtramos el resultado al cliente.
    const destino = emailLc;
    try {
      const enviado = await enviarOtp(destino, code);
      if (!enviado) app.log.info({ email: destino, ...codeEnLog(code) }, 'OTP generado (SMTP no configurado)');
      else app.log.info({ email: destino }, 'OTP enviado por email');
    } catch (err) {
      // No romper el login si el SMTP falla.
      app.log.error({ email: destino, ...codeEnLog(code), err: (err as Error).message }, 'OTP: fallo el envío SMTP');
    }
    return { ok: true };
  });

  app.post('/auth/otp/verify', async (request, reply) => {
    const body = OtpVerifySchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ message: 'Email y código de 6 dígitos requeridos' });

    // El OTP prueba que quien entra controla el email. La identidad concreta (a
    // qué alquiler entra) se elige DESPUÉS: una persona puede tener varios
    // contratos, incluso en inmobiliarias distintas. Acá emitimos un token de
    // "persona" (por email) + la lista de sus alquileres; /auth/inquilino/elegir
    // emite el token del contrato elegido. Así "una persona, un login, varios
    // alquileres" sin atar la sesión a una sola inmobiliaria.
    const emailLc = body.data.email.toLowerCase();
    const inquilinos = await prisma.inquilino.findMany({ where: { email: emailLc }, select: { id: true } });
    if (inquilinos.length === 0) return reply.code(401).send({ message: 'Código inválido' });

    let verificado = false;
    if (app.env.DEMO_MODE && body.data.code === '000000' && process.env.NODE_ENV !== 'production') {
      verificado = true; // backdoor SOLO de demo/dev (excluye prod)
    } else {
      const ids = inquilinos.map((i) => i.id);
      const otps = await prisma.codigoOtp.findMany({
        where: { inquilinoId: { in: ids }, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      verificado = otps.some((otp) => bcrypt.compareSync(body.data.code, otp.codeHash));
      // Un mismo código se generó para TODAS las filas del email (una por
      // contrato). Al validar, invalidamos el lote entero para que no se reuse.
      if (verificado) {
        await prisma.codigoOtp.updateMany({
          where: { inquilinoId: { in: ids }, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
    }
    if (!verificado) return reply.code(401).send({ message: 'Código inválido o vencido' });

    const personaToken = app.jwt.sign(
      { kind: 'persona', email: emailLc } satisfies JwtPersona,
      { expiresIn: TOKEN_TTL },
    );
    return { personaToken, alquileres: await alquileresDeEmail(emailLc) };
  });

  // Elegir a qué alquiler entrar (auth con el token de "persona" del OTP).
  // Emite el JwtInquilino del contrato elegido — el token que usa el resto de
  // la app. Solo permite elegir alquileres registrados con el email del token.
  app.post('/auth/inquilino/elegir', async (request, reply) => {
    const persona = await requirePersona(request, reply);
    if (!persona) return;
    const sel = z.object({ inquilinoId: z.string().min(1) }).safeParse(request.body);
    if (!sel.success) return reply.code(400).send({ message: 'inquilinoId requerido' });
    const inq = await prisma.inquilino.findFirst({
      where: { id: sel.data.inquilinoId, email: persona.email },
      include: {
        inmobiliaria: { select: { nombre: true } },
        contrato: { select: { propiedad: { select: { direccion: true, ciudad: true } } } },
      },
    });
    if (!inq) return reply.code(404).send({ message: 'Alquiler inexistente' });
    const payload: JwtInquilino = {
      kind: 'inquilino',
      inquilinoId: inq.id,
      inmobiliariaId: inq.inmobiliariaId,
      contratoId: inq.contratoId,
    };
    const token = app.jwt.sign(payload, { expiresIn: TOKEN_TTL });
    return {
      token,
      inquilinoId: inq.id,
      email: persona.email,
      nombre: inq.nombre,
      apellido: inq.apellido ?? '',
      direccion: inq.contrato?.propiedad?.direccion ?? '',
      ciudad: inq.contrato?.propiedad?.ciudad ?? '',
      contratoId: inq.contratoId ?? '',
      inmobiliaria: inq.inmobiliaria.nombre,
    };
  });

  // Lista los alquileres de la persona (para el selector "Mis alquileres" y el
  // switcher). Siempre refleja el estado actual (deriva del email del token).
  app.get('/auth/inquilino/alquileres', async (request, reply) => {
    const persona = await requirePersona(request, reply);
    if (!persona) return;
    return { alquileres: await alquileresDeEmail(persona.email) };
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
      include: { contrato: { select: { estado: true, propiedad: { select: { direccion: true, ciudad: true } } } } },
    });
    if (!co) return reply.code(404).send({ message: 'Invitación inexistente' });
    // No se emiten sesiones NUEVAS sobre un contrato que ya no está ACTIVO: un link
    // de co-invitación pendiente NO debe seguir canjeable después de la baja del
    // contrato (antes daba acceso pleno de 15 días a un contrato finalizado).
    if (co.contrato?.estado !== 'ACTIVO') {
      return reply.code(409).send({ message: 'El contrato ya no está activo: la invitación no puede aceptarse.' });
    }
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
        // Avatar (foto en /uploads del tenant) — editable con PUT /me/avatar.
        imageUrl: u.imageUrl ?? null,
        inmobiliaria: u.inmobiliaria.nombre,
        esPiloto: u.inmobiliaria.esPiloto,
        // PIN ELIMINADO de la plataforma: ninguna acción lo requiere. Devolvemos false
        // fijo para que el panel no muestre estado ni prompts de PIN en ningún lado.
        tienePin: false,
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
