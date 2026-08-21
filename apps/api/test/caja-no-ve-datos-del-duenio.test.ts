/**
 * La pantalla de contratos le entregaba a CAJA lo que la matriz de permisos le niega.
 *
 * `GET /contratos/:id` pide la capacidad `contratos.ver`, que incluye a **CAJA**. Y adentro
 * traía la fila entera del propietario con un `include` a secas: CBU/alias, CUIT, email,
 * teléfono, comisión y las notas internas del dueño, más su cuenta de cobranza con el CBU
 * completo de 22 dígitos.
 *
 * A CAJA se le negó `propietarios.ver` A PROPÓSITO —es el rol del mostrador, cobra y concilia,
 * no administra dueños—. O sea que la restricción existía, estaba pensada, y se filtraba entera
 * por la puerta de al lado. No hacía falta ningún ataque: alcanzaba con abrir un contrato.
 *
 * El fix es un `select` en vez del `include`, con los campos sensibles condicionados a la
 * capacidad. De paso `comisionPct` y `notas` dejaron de viajar para todos: el front los descarta
 * y los reemplaza por 0/null, así que nunca los necesitó nadie.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let tCAJA = '';
let tADMIN = '';
let inmobiliariaId = '';
const CID = 'cnt_001';
const EMAIL_CAJA = 'cajero.test@delsol.com';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function login(email: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'delsol123' } });
  return r.json().token as string;
}

/** El propietario del contrato, tal como viene en la respuesta. */
function duenioDe(body: {
  propiedad?: { participaciones?: { propietario?: Record<string, unknown> }[] };
}): Record<string, unknown> {
  const p = body.propiedad?.participaciones?.[0]?.propietario;
  expect(p, 'la respuesta tiene que traer al menos un propietario').toBeTruthy();
  return p as Record<string, unknown>;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  // El seed no tiene ningún CAJA: el rol existe en la matriz y no había con qué probarlo.
  await prisma.usuario.upsert({
    where: { inmobiliariaId_email: { inmobiliariaId, email: EMAIL_CAJA } },
    update: { rol: 'CAJA', activo: true },
    create: {
      inmobiliariaId,
      email: EMAIL_CAJA,
      nombre: 'Cajero',
      apellido: 'DePrueba',
      rol: 'CAJA',
      passwordHash: bcrypt.hashSync('delsol123', 10),
    },
  });
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tCAJA = await login(EMAIL_CAJA);
  tADMIN = await login('roberto@delsol.com');
});

afterAll(async () => {
  await prisma.usuario.deleteMany({ where: { inmobiliariaId, email: EMAIL_CAJA } });
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CAJA no recibe los datos del propietario por la puerta de los contratos', () => {
  it('la matriz ya se lo negaba: GET /propietarios con CAJA → 403', async () => {
    // Sin esto, el resto del archivo estaría midiendo aire.
    const r = await app.inject({ method: 'GET', url: '/propietarios', headers: auth(tCAJA) });
    expect(r.statusCode).toBe(403);
  });

  it('EL BUG: en GET /contratos/:id no le llega el CBU, ni el CUIT, ni el mail del dueño', async () => {
    const r = await app.inject({ method: 'GET', url: `/contratos/${CID}`, headers: auth(tCAJA) });
    expect(r.statusCode).toBe(200);
    const d = duenioDe(r.json());
    // Lo que sí necesita para operar: saber de quién es la propiedad.
    expect(d.nombre).toBeTruthy();
    expect(d.apellido).toBeTruthy();
    // Lo que no.
    expect(d).not.toHaveProperty('cbuAlias');
    expect(d).not.toHaveProperty('cuit');
    expect(d).not.toHaveProperty('email');
    expect(d).not.toHaveProperty('telefono');
    expect(d).not.toHaveProperty('cuentaCobranza');
  });

  it('las notas internas del dueño no viajan para NADIE, ni siquiera para el Admin', async () => {
    // El front las descarta y las reemplaza por null: nunca las necesitó. Son texto libre que
    // la inmobiliaria escribe sobre su cliente ("cobra en negro", "pelea con el hermano"), y
    // el lugar para leerlas es la ficha del propietario, no el detalle del contrato.
    const r = await app.inject({ method: 'GET', url: `/contratos/${CID}`, headers: auth(tADMIN) });
    expect(r.statusCode).toBe(200);
    const d = duenioDe(r.json());
    expect(d).not.toHaveProperty('notas');
    expect(d).not.toHaveProperty('comisionPct');
  });

  it('el ADMIN sigue viendo lo que necesita para la cobranza directa', async () => {
    // No-regresión: el detalle del contrato muestra el CBU del dueño cuando el contrato es
    // PROPIETARIO_DIRECTO. Romper eso habría cambiado un agujero por una pantalla rota.
    const r = await app.inject({ method: 'GET', url: `/contratos/${CID}`, headers: auth(tADMIN) });
    const d = duenioDe(r.json());
    expect(d).toHaveProperty('cbuAlias');
    expect(d).toHaveProperty('cuit');
    expect(d).toHaveProperty('email');
    expect(d).toHaveProperty('cuentaCobranza');
  });
});
