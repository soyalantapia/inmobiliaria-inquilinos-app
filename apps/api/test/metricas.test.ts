import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { seedOperacion } from '../prisma/seeds/operacion.js';

let app: FastifyInstance;
let tokenAdmin: string;
let tokenCarga: string;
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

beforeAll(async () => {
  const prisma = new PrismaClient();
  const { inmobiliariaId } = await seedBase(prisma);
  await seedOperacion(prisma, inmobiliariaId);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const admin = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tokenAdmin = admin.json().token;
  const carga = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'camila@delsol.com', password: 'delsol123' } });
  tokenCarga = carga.json().token;
});
afterAll(async () => { await app.close(); });

describe('GET /metricas/resumen', () => {
  it('gateo: rol CARGA no tiene metricas.ver → 403', async () => {
    const res = await app.inject({ method: 'GET', url: '/metricas/resumen', headers: auth(tokenCarga) });
    expect(res.statusCode).toBe(403);
  });

  it('devuelve el resumen con números coherentes + serie de 6 meses', async () => {
    // Busco un mes de la serie que tenga devengado (el seed pone liquidaciones en 2025-26).
    const meses = ['2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2025-12'];
    for (const mes of meses) {
      const res = await app.inject({ method: 'GET', url: `/metricas/resumen?mes=${mes}`, headers: auth(tokenAdmin) });
      expect(res.statusCode).toBe(200);
      const b = res.json();
      const f = b.financiero;
      // Invariantes que SIEMPRE deben cumplirse:
      expect(f.cobrado).toBeLessThanOrEqual(f.devengado + 0.01); // no se cobra más de lo facturado
      expect(f.porCobrar).toBeGreaterThanOrEqual(0);
      expect(f.enMora).toBeGreaterThanOrEqual(0);
      expect(f.cobrabilidadPct).toBeGreaterThanOrEqual(0);
      expect(f.cobrabilidadPct).toBeLessThanOrEqual(100);
      expect(b.serie).toHaveLength(6);
      expect(b.serie[5].mes).toBe(mes); // el último de la serie es el mes pedido
    }
    expect(true).toBe(true);
  });

  it('mes inválido → 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/metricas/resumen?mes=2026-13', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(400);
  });
});
