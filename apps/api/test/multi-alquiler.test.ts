import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { borrarContratosDeTest } from '../prisma/borrar-contratos-de-test.js';
import { loginTest } from './_login.js';

let app: FastifyInstance;
let token: string;
let prismaTest: PrismaClient;
const auth = () => ({ authorization: `Bearer ${token}` });

const EMAIL = 'multi.inquilino@test.com';
const DNI = '30111222';

// Las propiedades que crea ESTE archivo, por id. La limpieza de abajo las buscaba por
// `direccion contains 'Rivadavia'`, y ese selector se salía del territorio propio:
// `importacion-morosos.test.ts` también usa direcciones con "Rivadavia", así que en una corrida
// completa este afterAll intentaba borrar propiedades AJENAS —con contratos, pagos y cargos que
// no limpia— y moría con una violación de FK. El archivo entero quedaba en rojo por su limpieza,
// no por sus tests: corriéndolo solo pasaba, y en la suite completa era el único que fallaba.
const propiedadesCreadas: string[] = [];

beforeAll(async () => {
  prismaTest = new PrismaClient();
  await seedBase(prismaTest);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
});

// Este test CREA propiedades/contratos vía endpoint y la base es compartida entre archivos, así
// que limpia lo suyo. El árbol del contrato lo borra `borrarContratosDeTest`; acá sólo queda lo
// que NO cuelga de un contrato: la propiedad, su participación y la persona.
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
  // Sólo las propiedades que creó ESTE archivo (ver el comentario de `propiedadesCreadas`).
  const propIds = propiedadesCreadas;
  // Los contratos salen de DOS lados y se unen. Antes salían sólo de los inquilinos, y eso
  // deja afuera cualquier contrato de estas propiedades cuyo inquilino no matchee —incluido
  // el residuo de una corrida anterior que murió a mitad del borrado—. El síntoma era un
  // `contratos_propiedadId_fkey` recién al llegar a `propiedad.deleteMany`, o sea a seis
  // líneas de distancia de la causa.
  const porPropiedad = await prismaTest.contrato.findMany({
    where: { propiedadId: { in: propIds } },
    select: { id: true },
  });
  const contratoIds = [
    ...new Set([
      ...inquilinos.map((i) => i.contratoId).filter((c): c is string => !!c),
      ...porPropiedad.map((c) => c.id),
    ]),
  ];
  // Y el árbol entero del contrato —22 hijos y 10 nietos, ninguno cascadea— lo borra el helper.
  // Antes esto era una lista a mano acá adentro y se rompía sola cada vez que el alta empezaba
  // a escribir un hijo más, que es literalmente lo que pasó con `EventoContrato`. El helper
  // tiene un test que lo ata al schema. Ver `prisma/borrar-contratos-de-test.ts` y T-28-N3.
  await borrarContratosDeTest(prismaTest, contratoIds);
  await prismaTest.inquilino.deleteMany({ where: { personaId: { in: personaIds } } });
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
  const id = res.json().id as string;
  propiedadesCreadas.push(id);
  return id;
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
