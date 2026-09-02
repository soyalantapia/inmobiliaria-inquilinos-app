/**
 * T-23-N2-N1 · El email del propietario es la llave del portal y nadie lo verificaba.
 *
 * EL RIESGO. `Propietario.email` lo tipea a mano el staff de la inmobiliaria, y desde que existe
 * el portal dejó de ser un dato de contacto: **es la credencial**. El OTP viaja ahí. Con un typo,
 * el código de acceso a una cartera ajena llega a la casilla equivocada — y hasta acá no había
 * forma de saber a cuántos les había pasado.
 *
 * LA PRUEBA NO NECESITA UN CIRCUITO NUEVO. Completar el OTP **ya demuestra** control de la
 * casilla: la persona leyó un código que sólo llegó ahí. Es exactamente lo que probaría un doble
 * opt-in, y se marca en el mismo update que ya registraba el acceso.
 *
 * 🔴 LO QUE ESTE ARCHIVO TAMBIÉN CUIDA, Y ES LO MÁS IMPORTANTE: que esto **no bloquee a nadie**.
 * Qué se hace con los propietarios que nunca entraron —dejarlos afuera es lo seguro y deja al día
 * 1 sin la cartera existente— es una decisión del dueño, no de este código. Primero se mide,
 * después se decide. El último caso es el que impide que alguien "complete" el arreglo
 * convirtiéndolo en una puerta cerrada sin que esa decisión se haya tomado.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let tokenPanel = '';
let propietarioId = '';
let inmobiliariaId = '';
let emailOriginal = '';

const CODIGO = '424242';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

/** Le arma una fila de OTP válida al propietario y la canjea, como haría el portal. */
async function entrarAlPortal(email: string) {
  await prisma.codigoOtpPropietario.deleteMany({ where: { propietarioId } });
  await prisma.codigoOtpPropietario.create({
    data: {
      propietarioId,
      codeHash: bcrypt.hashSync(CODIGO, 8),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return app.inject({ method: 'POST', url: '/auth/propietario/otp/verify', payload: { email, code: CODIGO } });
}

const leer = () => prisma.propietario.findUniqueOrThrow({ where: { id: propietarioId } });

/**
 * El PUT del panel exige `nombre` y `apellido` siempre: es un formulario completo, no un PATCH.
 * Se arman desde la fila para no inventar datos —y para que el test siga andando si el seed
 * cambia de propietario—.
 */
async function editar(campos: Record<string, unknown>) {
  const p = await leer();
  return app.inject({
    method: 'PUT',
    url: `/propietarios/${propietarioId}`,
    headers: auth(tokenPanel),
    payload: { nombre: p.nombre, apellido: p.apellido, ...campos },
  });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tokenPanel = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  inmobiliariaId = inmo.id;
  const p = await prisma.propietario.findFirstOrThrow({
    where: { inmobiliariaId, activo: true, email: { not: '' } },
    orderBy: { id: 'asc' },
  });
  propietarioId = p.id;
  emailOriginal = p.email;
  // Se arranca SIEMPRE del mismo estado: la base la comparten los archivos de la corrida.
  await prisma.propietario.update({ where: { id: propietarioId }, data: { emailVerificadoAt: null } });
});

afterAll(async () => {
  await prisma.codigoOtpPropietario.deleteMany({ where: { propietarioId } }).catch(() => {});
  await prisma.propietario
    .update({ where: { id: propietarioId }, data: { email: emailOriginal, emailVerificadoAt: null } })
    .catch(() => {});
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('T-23-N2-N1 — el email del propietario queda verificado al entrar', () => {
  it('arranca sin verificar, que es el estado de toda la cartera existente', async () => {
    expect((await leer()).emailVerificadoAt).toBeNull();
  });

  it('completar el OTP prueba que la casilla es suya, y queda marcado', async () => {
    const r = await entrarAlPortal(emailOriginal);
    expect(r.statusCode).toBe(200);
    const p = await leer();
    expect(p.emailVerificadoAt).not.toBeNull();
    // Y sigue registrando el acceso, que es lo que ya hacía: no se reemplazó un rastro por otro.
    expect(p.ultimoAccesoAt).not.toBeNull();
  });

  it('🔴 cambiar el email tira abajo la verificación', async () => {
    // Lo que se había probado es que la casilla VIEJA era suya. De la nueva no se sabe nada.
    // Dejar la marca puesta diría "verificado" sobre una dirección que nadie confirmó — que es
    // justo el estado que esta columna vino a hacer visible.
    expect((await leer()).emailVerificadoAt).not.toBeNull();
    const r = await editar({ email: 'otro.mail.del.duenio@example.invalid' });
    expect(r.statusCode).toBe(200);
    expect((await leer()).emailVerificadoAt).toBeNull();
  });

  it('editar OTRA cosa no la tira abajo', async () => {
    // El control del caso de arriba: si el reset se disparara con cualquier PUT, la marca no
    // valdría nada —se caería sola cada vez que alguien corrige un teléfono— y el dato quedaría
    // siempre en null sin que nadie lo note.
    await entrarAlPortal('otro.mail.del.duenio@example.invalid');
    expect((await leer()).emailVerificadoAt).not.toBeNull();

    const r = await editar({ telefono: '+54 9 11 5555 4444' });
    expect(r.statusCode).toBe(200);
    expect((await leer()).emailVerificadoAt).not.toBeNull();
  });

  it('mandar el MISMO email tampoco la tira abajo', async () => {
    const actual = (await leer()).email;
    const r = await editar({ email: actual.toUpperCase() });
    expect(r.statusCode).toBe(200);
    // Se compara contra el email NORMALIZADO: mandarlo en mayúsculas es el mismo email, y
    // tratarlo como un cambio invalidaría la verificación por un detalle de tipeo.
    expect((await leer()).emailVerificadoAt).not.toBeNull();
  });

  it('🔴 un propietario SIN verificar entra al portal igual — esto no bloquea a nadie', async () => {
    // EL CONTROL QUE IMPORTA. La decisión de bloquear a los no verificados es del dueño, y
    // todavía no está tomada. Si alguien "termina" esta tarea convirtiendo la marca en un
    // requisito, este test se pone rojo y obliga a que la decisión se tome explícitamente.
    await prisma.propietario.update({ where: { id: propietarioId }, data: { emailVerificadoAt: null } });
    const email = (await leer()).email;
    const r = await entrarAlPortal(email);
    expect(r.statusCode).toBe(200);
    expect(r.json().token).toBeTruthy();
  });
});
