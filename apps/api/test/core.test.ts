import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
});

afterAll(async () => {
  await app.close();
});

const auth = () => ({ authorization: `Bearer ${token}` });

// La DB de test es UNA sola para los 62 archivos (`fileParallelism: false`, mismo schema), y
// varias suites que corren antes que ésta dan de alta contratos/propiedades por endpoint sin
// limpiarlos. Contar filas del tenant acá era, entonces, contar el seed MÁS lo que dejó el
// vecino: el número dependía del orden alfabético de los archivos. Lo que este test tiene que
// garantizar del endpoint es que devuelve TODO el seed, con sus joins y sin duplicar filas por
// un join mal armado — eso se afirma por id y no depende de quién más escribió en la base.
function esperarSinDuplicados(ids: string[]) {
  expect(new Set(ids).size).toBe(ids.length);
}
function esperarQueContenga(ids: string[], esperados: string[]) {
  esperarSinDuplicados(ids);
  expect(esperados.filter((id) => !ids.includes(id))).toEqual([]);
}

const CONTRATOS_SEED = ['cnt_001', 'cnt_002', 'cnt_003', 'cnt_004', 'cnt_005', 'cnt_006', 'cnt_007', 'cnt_008'];
const PROPIEDADES_SEED = ['prp_001', 'prp_002', 'prp_003', 'prp_004', 'prp_005', 'prp_006'];
const PROPIETARIOS_SEED = ['own_001', 'own_002', 'own_003', 'own_004', 'own_005'];
// Los inquilinos del seed no tienen id literal (cuid), así que se los identifica por email.
const INQUILINOS_SEED = [
  'mariela.sosa@gmail.com',
  'juan.perez@inquilino.demo',
  'laura.gimenez@inquilino.demo',
  'carlos.romero@inquilino.demo',
  'ana.pereyra@inquilino.demo',
  'tomas.bravo@inquilino.demo',
  'lucia.fernandez@inquilino.demo',
];

describe('Core (Fase 2)', () => {
  it('GET /contratos sin token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/contratos' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /contratos devuelve los 8 del seed con joins', async () => {
    const res = await app.inject({ method: 'GET', url: '/contratos', headers: auth() });
    expect(res.statusCode).toBe(200);
    const lista = res.json();
    esperarQueContenga(lista.map((c: { id: string }) => c.id), CONTRATOS_SEED);
    const c1 = lista.find((c: { id: string }) => c.id === 'cnt_001');
    expect(c1.propiedad.direccion).toBe('Gorriti 4521, 3°B');
    expect(c1.inquilinoTitular.nombre).toBe('Mariela');
    expect(Number(c1.monto)).toBe(480000);
  });

  it('GET /contratos/cnt_001 detalle con propietarios de la propiedad', async () => {
    const res = await app.inject({ method: 'GET', url: '/contratos/cnt_001', headers: auth() });
    expect(res.statusCode).toBe(200);
    const c = res.json();
    const owners = c.propiedad.participaciones.map((p: { propietario: { apellido: string } }) => p.propietario.apellido).sort();
    expect(owners).toEqual(['Castro', 'Morales']);
  });

  it('GET /propiedades → 6, alquiladas con contratoActual', async () => {
    const res = await app.inject({ method: 'GET', url: '/propiedades', headers: auth() });
    const lista = res.json();
    esperarQueContenga(lista.map((p: { id: string }) => p.id), PROPIEDADES_SEED);
    const p1 = lista.find((p: { id: string }) => p.id === 'prp_001');
    expect(p1.contratoActual.id).toBe('cnt_001');
  });

  it('GET /propietarios → 5 con sus propiedades', async () => {
    const res = await app.inject({ method: 'GET', url: '/propietarios', headers: auth() });
    const lista = res.json();
    esperarQueContenga(lista.map((p: { id: string }) => p.id), PROPIETARIOS_SEED);
    // Por ID de propiedad y NO por `participaciones[0]`: own_001 tiene UNA participación
    // en el seed, pero las suites que corren antes le cuelgan las suyas por endpoint. El
    // índice 0 apostaba a la vez al orden físico de Postgres y a quién escribió último.
    const castro = lista.find((p: { id: string }) => p.id === 'own_001');
    const gorriti = castro.participaciones.find(
      (p: { propiedad: { id: string } }) => p.propiedad.id === 'prp_001',
    );
    expect(gorriti.propiedad.direccion).toBe('Gorriti 4521, 3°B');
  });

  it('las participaciones vienen ORDENADAS por dirección, no en el orden físico', async () => {
    const res = await app.inject({ method: 'GET', url: '/propietarios', headers: auth() });
    const morales = res.json().find((p: { id: string }) => p.id === 'own_002');
    // own_002 tiene TRES propiedades en el seed (prp_001, prp_002, prp_004) y sus
    // direcciones arrancan con letras distintas: A(v. Cabildo) < G(orriti) < H(onduras).
    // Sólo se afirma el orden RELATIVO de esas tres, así que lo que hayan agregado las
    // suites vecinas no puede volver rojo este aserto, y una vuelta al orden del heap sí.
    const posicion = (id: string) =>
      morales.participaciones.findIndex((p: { propiedad: { id: string } }) => p.propiedad.id === id);
    expect(posicion('prp_002')).toBeGreaterThanOrEqual(0); // Av. Cabildo 2890, 7°A
    expect(posicion('prp_001')).toBeGreaterThan(posicion('prp_002')); // Gorriti 4521, 3°B
    expect(posicion('prp_004')).toBeGreaterThan(posicion('prp_001')); // Honduras 4490, PB
  });

  it('GET /inquilinos → 7 vinculados a contrato', async () => {
    const res = await app.inject({ method: 'GET', url: '/inquilinos', headers: auth() });
    const lista = res.json();
    esperarSinDuplicados(lista.map((i: { id: string }) => i.id));
    const emails = lista.map((i: { email: string }) => i.email);
    expect(INQUILINOS_SEED.filter((e) => !emails.includes(e))).toEqual([]);
    const mariela = lista.find((i: { email: string }) => i.email === 'mariela.sosa@gmail.com');
    expect(mariela.contrato.id).toBe('cnt_001');
  });

  it('un inquilino NO puede listar contratos del panel (403)', async () => {
    const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
    const res = await app.inject({
      method: 'GET',
      url: '/contratos',
      headers: { authorization: `Bearer ${demo.json().token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
