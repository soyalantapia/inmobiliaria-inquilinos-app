/**
 * T-01-N1-N7 · La baja de un propietario estaba construida y no la cubría un solo caso.
 *
 * `PATCH /propietarios/:id/activo` existe desde hace semanas: autenticado, con corte a CARGA, con
 * un 409 para la cobranza directa y con `requirePropietario` revalidando `activo` en cada
 * request. **No lo llamaba ninguna pantalla del panel y no lo medía ningún test.** Las dos cosas
 * son la misma: una capacidad que nadie ejerce tampoco se rompe con ruido.
 *
 * Ahora el panel lo llama (ver `lib/acciones-de-propietario.ts`), así que lo que hace de verdad
 * pasa a importar. Los tres casos 🔴 de abajo son las tres promesas que la ficha le hace al
 * operador cuando aprieta «Dar de baja»:
 *
 *   1. el acceso al portal se corta EN EL MOMENTO, no cuando venza el token de 7 días;
 *   2. no se puede dar de baja al que cobra DIRECTO del inquilino en un contrato activo —eso
 *      dejaría al inquilino transfiriendo a la cuenta de alguien que ya no administra;
 *   3. el historial contable queda intacto.
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
const prisma = new PrismaClient();

const P = 'ZZ-baja-prop-';
const EMAIL = 'zz.baja.propietario@example.invalid';
const CODIGO = '123456';
let tAdmin = '';
let inmobiliariaId = '';
let propietarioId = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  inmobiliariaId = (
    await prisma.usuario.findFirstOrThrow({ where: { email: 'roberto@delsol.com' }, select: { inmobiliariaId: true } })
  ).inmobiliariaId;
  await limpiar();
  propietarioId = (
    await prisma.propietario.create({
      data: {
        id: `${P}duenio`,
        inmobiliariaId,
        nombre: 'Dueño',
        apellido: 'De Prueba',
        cuit: '20-40000001-3',
        telefono: '11 0000-0002',
        email: EMAIL,
        activo: true,
      },
    })
  ).id;
}, 420_000);

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

async function limpiar(): Promise<void> {
  await prisma.codigoOtpPropietario.deleteMany({ where: { propietarioId: { startsWith: P } } });
  await prisma.participacionPropietario.deleteMany({ where: { propietarioId: { startsWith: P } } });
  await prisma.propietario.deleteMany({ where: { id: { startsWith: P } } });
}

/** Le arma una fila de OTP válida al propietario y la canjea por un token de portal. */
async function entrarAlPortal(): Promise<string> {
  await prisma.codigoOtpPropietario.deleteMany({ where: { propietarioId } });
  await prisma.codigoOtpPropietario.create({
    data: { propietarioId, codeHash: bcrypt.hashSync(CODIGO, 8), expiresAt: new Date(Date.now() + 600_000) },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/auth/propietario/otp/verify',
    payload: { email: EMAIL, code: CODIGO },
  });
  expect(res.statusCode, `verify → ${res.body.slice(0, 150)}`).toBe(200);
  return res.json().token as string;
}

const cambiarActivo = (activo: boolean, token = tAdmin) =>
  app.inject({
    method: 'PATCH',
    url: `/propietarios/${propietarioId}/activo`,
    headers: auth(token),
    payload: { activo },
  });

const verCartera = (token: string) =>
  app.inject({ method: 'GET', url: '/portal/mi-cartera', headers: auth(token) });

describe('la baja de un propietario le corta el portal', () => {
  it('🔴 el token que ya tenía abierto deja de servir EN EL MOMENTO', async () => {
    const token = await entrarAlPortal();
    // Control positivo primero: sin esto, un 401 después de la baja no probaría nada — podría
    // ser que el token nunca hubiera servido.
    expect((await verCartera(token)).statusCode, 'el token tiene que servir ANTES de la baja').toBe(200);

    expect((await cambiarActivo(false)).statusCode).toBe(200);

    // La sesión del portal dura 7 días. Si `requirePropietario` no revalidara `activo`, un
    // ex-dueño seguiría viendo la cartera —direcciones, inquilinos, rendiciones— una semana
    // después de que la inmobiliaria lo diera de baja.
    expect((await verCartera(token)).statusCode).toBe(401);

    expect((await cambiarActivo(true)).statusCode).toBe(200);
  });

  it('🔴 y tampoco puede volver a entrar: el OTP no le emite token nuevo', async () => {
    expect((await cambiarActivo(false)).statusCode).toBe(200);
    await prisma.codigoOtpPropietario.deleteMany({ where: { propietarioId } });
    await prisma.codigoOtpPropietario.create({
      data: { propietarioId, codeHash: bcrypt.hashSync(CODIGO, 8), expiresAt: new Date(Date.now() + 600_000) },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/propietario/otp/verify',
      payload: { email: EMAIL, code: CODIGO },
    });
    // Cortar la sesión abierta y no la puerta de entrada sería medio arreglo: vuelve a pedir un
    // código y entra igual.
    expect(res.statusCode).not.toBe(200);
    expect((await cambiarActivo(true)).statusCode).toBe(200);
  });

  it('CONTROL POSITIVO — reactivarlo le devuelve el acceso', async () => {
    expect((await cambiarActivo(false)).statusCode).toBe(200);
    expect((await cambiarActivo(true)).statusCode).toBe(200);
    expect((await verCartera(await entrarAlPortal())).statusCode).toBe(200);
  });

  it('🔴 no se puede dar de baja a quien cobra DIRECTO del inquilino en un contrato activo', async () => {
    // Es el único caso donde la baja no es sólo administrativa: el inquilino le transfiere a la
    // cuenta de este señor. Darlo de baja sin cambiar antes el modo de cobranza deja la plata
    // yendo a alguien que ya no administra la propiedad.
    const contrato = await prisma.contrato.findFirstOrThrow({
      where: { inmobiliariaId, estado: 'ACTIVO' },
      select: { id: true, modoCobranza: true, cobraDirectoPropietarioId: true },
    });
    await prisma.contrato.update({
      where: { id: contrato.id },
      data: { modoCobranza: 'PROPIETARIO_DIRECTO', cobraDirectoPropietarioId: propietarioId },
    });
    const res = await cambiarActivo(false);
    expect(res.statusCode, res.body.slice(0, 200)).toBe(409);
    // Y sigue activo: un 409 que igual lo dio de baja sería peor que no tener el guard.
    expect((await prisma.propietario.findUniqueOrThrow({ where: { id: propietarioId } })).activo).toBe(true);

    await prisma.contrato.update({
      where: { id: contrato.id },
      data: {
        modoCobranza: contrato.modoCobranza,
        cobraDirectoPropietarioId: contrato.cobraDirectoPropietarioId,
      },
    });
  });

  it('un CARGA no puede dar de baja a nadie', async () => {
    // El seed trae a Camila Acosta con rol CARGA (`prisma/seed.ts:71`). Se AFIRMA que está en vez
    // de saltear el caso si falta: un `if (!carga) return` deja el test en verde el día que
    // alguien le cambie el rol, y este caso pasa a no medir nada sin que se note.
    const carga = await prisma.usuario.findFirstOrThrow({
      where: { inmobiliariaId, rol: 'CARGA', activo: true },
    });
    const token = app.jwt.sign({ kind: 'usuario', userId: carga.id, inmobiliariaId, rol: 'CARGA' });
    expect((await cambiarActivo(false, token)).statusCode).toBe(403);
  });
});
