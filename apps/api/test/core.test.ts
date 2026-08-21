import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

let app: FastifyInstance;
let token: string;
let prisma: PrismaClient;
let tid: string;

/**
 * Lo que estos tests miden de verdad al contar filas.
 *
 * Antes decían `expect(lista.length).toBe(8)`, con el 8 del seed hardcodeado. Eso sólo es
 * cierto en una base VIRGEN, y la que se usa acá es COMPARTIDA y `seedBase` únicamente hace
 * upsert: nunca borra lo que sobra. Cualquier fixture que otro test haya dejado —o el devengo
 * automático, que corre solo cada 6h— se suma para siempre. El 20/08 daba 29 donde esperaba 8,
 * y el rojo se leía como "se rompió GET /contratos".
 *
 * La propiedad que ese número protegía NO era "el seed tiene 8": era **que el endpoint no
 * devuelva filas de OTRA inmobiliaria**. Contra la base, eso se afirma más fuerte que con un
 * literal: `length` tiene que ser EXACTAMENTE lo que hay para este tenant. Si mañana alguien
 * saca el `where: { inmobiliariaId }`, el test se pone rojo igual que antes — y ahora también
 * se pondría rojo si devolviera de menos, que el 8 fijo no distinguía de un seed cambiado.
 */
const cuantasHayDelTenant = {
  contratos: () => prisma.contrato.count({ where: { inmobiliariaId: tid } }),
  propiedades: () => prisma.propiedad.count({ where: { inmobiliariaId: tid } }),
  propietarios: () => prisma.propietario.count({ where: { inmobiliariaId: tid } }),
  inquilinos: () => prisma.inquilino.count({ where: { inmobiliariaId: tid } }),
};

beforeAll(async () => {
  prisma = new PrismaClient();
  ({ inmobiliariaId: tid } = await seedBase(prisma));
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${token}` });

describe('Core (Fase 2)', () => {
  it('GET /contratos sin token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/contratos' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /contratos devuelve los del tenant —y sólo esos— con joins', async () => {
    const res = await app.inject({ method: 'GET', url: '/contratos', headers: auth() });
    expect(res.statusCode).toBe(200);
    const lista = res.json();
    expect(lista.length).toBe(await cuantasHayDelTenant.contratos());
    expect(lista.length).toBeGreaterThanOrEqual(8); // los 8 del seed, como piso
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

  it('GET /propiedades → las del tenant, alquiladas con contratoActual', async () => {
    const res = await app.inject({ method: 'GET', url: '/propiedades', headers: auth() });
    const lista = res.json();
    expect(lista.length).toBe(await cuantasHayDelTenant.propiedades());
    expect(lista.length).toBeGreaterThanOrEqual(6);
    const p1 = lista.find((p: { id: string }) => p.id === 'prp_001');
    expect(p1.contratoActual.id).toBe('cnt_001');
  });

  it('GET /propietarios → los del tenant, con sus propiedades', async () => {
    const res = await app.inject({ method: 'GET', url: '/propietarios', headers: auth() });
    const lista = res.json();
    expect(lista.length).toBe(await cuantasHayDelTenant.propietarios());
    expect(lista.length).toBeGreaterThanOrEqual(5);
    const castro = lista.find((p: { id: string }) => p.id === 'own_001');
    expect(castro.participaciones[0].propiedad.direccion).toBe('Gorriti 4521, 3°B');
  });

  it('GET /inquilinos → los del tenant, vinculados a contrato', async () => {
    const res = await app.inject({ method: 'GET', url: '/inquilinos', headers: auth() });
    const lista = res.json();
    expect(lista.length).toBe(await cuantasHayDelTenant.inquilinos());
    expect(lista.length).toBeGreaterThanOrEqual(7);
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
