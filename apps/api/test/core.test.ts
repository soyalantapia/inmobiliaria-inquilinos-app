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

describe('Core (Fase 2)', () => {
  it('GET /contratos sin token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/contratos' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /contratos devuelve los 8 del seed con joins', async () => {
    const res = await app.inject({ method: 'GET', url: '/contratos', headers: auth() });
    expect(res.statusCode).toBe(200);
    const lista = res.json();
    expect(lista.length).toBe(8);
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
    expect(lista.length).toBe(6);
    const p1 = lista.find((p: { id: string }) => p.id === 'prp_001');
    expect(p1.contratoActual.id).toBe('cnt_001');
  });

  it('GET /propietarios → 5 con sus propiedades', async () => {
    const res = await app.inject({ method: 'GET', url: '/propietarios', headers: auth() });
    const lista = res.json();
    expect(lista.length).toBe(5);
    const castro = lista.find((p: { id: string }) => p.id === 'own_001');
    expect(castro.participaciones[0].propiedad.direccion).toBe('Gorriti 4521, 3°B');
  });

  it('GET /inquilinos → 7 vinculados a contrato', async () => {
    const res = await app.inject({ method: 'GET', url: '/inquilinos', headers: auth() });
    const lista = res.json();
    expect(lista.length).toBe(7);
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
