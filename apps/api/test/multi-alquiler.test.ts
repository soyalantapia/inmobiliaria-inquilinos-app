import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let token: string;
let prismaTest: PrismaClient;
const auth = () => ({ authorization: `Bearer ${token}` });

const EMAIL = 'multi.inquilino@test.com';
const DNI = '30111222';

beforeAll(async () => {
  prismaTest = new PrismaClient();
  await seedBase(prismaTest);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const admin = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  token = admin.json().token;
});

// Este test CREA propiedades/contratos vía endpoint; la DB de test es compartida entre
// archivos (core.test.ts espera los counts del seed puro), así que limpiamos lo creado
// para no contaminar. Orden de borrado por FK: liq → inquilino → contrato → participación
// → propiedad → persona.
afterAll(async () => {
  const personas = await prismaTest.persona.findMany({
    where: { OR: [{ email: EMAIL }, { dni: { in: [DNI, '40999888'] } }] },
    select: { id: true },
  });
  const personaIds = personas.map((p) => p.id);
  const inquilinos = await prismaTest.inquilino.findMany({
    where: { personaId: { in: personaIds } },
    select: { contratoId: true },
  });
  const contratoIds = inquilinos.map((i) => i.contratoId).filter((c): c is string => !!c);
  const props = await prismaTest.propiedad.findMany({
    where: { direccion: { contains: 'Rivadavia' } },
    select: { id: true },
  });
  const propIds = props.map((p) => p.id);
  await prismaTest.liquidacion.deleteMany({ where: { contratoId: { in: contratoIds } } });
  await prismaTest.inquilino.deleteMany({ where: { personaId: { in: personaIds } } });
  await prismaTest.contrato.deleteMany({ where: { id: { in: contratoIds } } });
  await prismaTest.participacionPropietario.deleteMany({ where: { propiedadId: { in: propIds } } });
  await prismaTest.propiedad.deleteMany({ where: { id: { in: propIds } } });
  await prismaTest.persona.deleteMany({ where: { id: { in: personaIds } } });
  await prismaTest.$disconnect();
  await app.close();
});

async function crearPropiedad(direccion: string): Promise<string> {
  const res = await app.inject({
    method: 'POST', url: '/propiedades', headers: auth(),
    payload: { direccion, ciudad: 'La Rioja', provincia: 'La Rioja', tipo: 'LOCAL', propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }] },
  });
  expect([200, 201]).toContain(res.statusCode);
  return res.json().id;
}

function contratoPayload(propiedadId: string, inquilino: object) {
  return {
    propiedadId,
    inquilino,
    monto: 300000,
    moneda: 'ARS',
    fechaInicio: '2026-07-01',
    fechaFin: '2027-07-01',
    diaPago: 10,
    indiceAjuste: 'ICL',
    frecuenciaAjusteMeses: 6,
  };
}

describe('multi-alquiler: un mismo inquilino con varios contratos', () => {
  it('el MISMO inquilino (mismo DNI+email) puede tener 2 contratos — antes daba 409 "ya está en tu cartera"', async () => {
    const prA = await crearPropiedad('Local A · Rivadavia 100');
    const prB = await crearPropiedad('Local B · Rivadavia 200');

    const c1 = await app.inject({
      method: 'POST', url: '/contratos', headers: auth(),
      payload: contratoPayload(prA, { nombre: 'Juan', apellido: 'Pérez', email: EMAIL, dni: DNI }),
    });
    expect([200, 201]).toContain(c1.statusCode);

    // El 2º contrato del MISMO inquilino: esto es lo que Camila reprodujo y fallaba.
    const c2 = await app.inject({
      method: 'POST', url: '/contratos', headers: auth(),
      payload: contratoPayload(prB, { nombre: 'Juan', apellido: 'Pérez', email: EMAIL, dni: DNI }),
    });
    expect([200, 201]).toContain(c2.statusCode);

    // Ambos contratos quedan agrupados bajo UNA sola persona (por DNI), con su email.
    const personas = await app.inject({ method: 'GET', url: `/personas?q=${DNI}`, headers: auth() });
    const lista = personas.json() as Array<{ id: string; dni: string | null; totalContratos: number }>;
    const persona = lista.find((p) => p.dni === DNI);
    expect(persona).toBeTruthy();
    expect(persona!.totalContratos).toBe(2);
  });

  it('otra persona (DISTINTO DNI) con el MISMO email → 409 (el unique de login vive en Persona)', async () => {
    const prC = await crearPropiedad('Local C · Rivadavia 300');
    const res = await app.inject({
      method: 'POST', url: '/contratos', headers: auth(),
      payload: contratoPayload(prC, { nombre: 'Otra', apellido: 'Persona', email: EMAIL, dni: '40999888' }),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toContain('otra persona');
  });
});
