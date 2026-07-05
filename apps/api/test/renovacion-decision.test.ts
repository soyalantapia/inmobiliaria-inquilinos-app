import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// Registrar la decisión de renovación desde el panel, con PREAVISO DE EGRESO:
// cuando el inquilino avisa que NO renueva, se puede anotar cuándo se va.

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
const CID = 'cnt_002'; // contrato ACTIVO del seed
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const post = (url: string, t: string, payload: unknown) =>
  app.inject({ method: 'POST', url, headers: auth(t), payload: payload as object });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  await prisma.intencionRenovacion.deleteMany({ where: { contratoId: CID } });
  await prisma.contrato.updateMany({ where: { id: CID }, data: { estado: 'ACTIVO' } });
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tADMIN = login.json().token;
});

afterAll(async () => {
  await prisma.intencionRenovacion.deleteMany({ where: { contratoId: CID } });
  await app.close();
  await prisma.$disconnect();
});

describe('Renovaciones — registrar aviso + preaviso de egreso', () => {
  it('NO_RENOVAR con fechaEgreso guarda el preaviso', async () => {
    const r = await post(`/renovaciones/${CID}/decision`, tADMIN, {
      decision: 'NO_RENOVAR',
      notas: 'Avisó por WhatsApp',
      fechaEgreso: '2026-12-31',
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().decision).toBe('NO_RENOVAR');
    expect(r.json().fechaEgreso).not.toBeNull();
    const inten = await prisma.intencionRenovacion.findUniqueOrThrow({ where: { contratoId: CID } });
    expect(inten.fechaEgreso?.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('GET /renovaciones expone la intención con la fecha de egreso', async () => {
    const r = await app.inject({ method: 'GET', url: '/renovaciones', headers: auth(tADMIN) });
    expect(r.statusCode).toBe(200);
    const fila = (r.json() as { id: string; intencionRenovacion: { decision: string; fechaEgreso: string | null } | null }[]).find((f) => f.id === CID);
    expect(fila?.intencionRenovacion?.decision).toBe('NO_RENOVAR');
    expect(fila?.intencionRenovacion?.fechaEgreso).not.toBeNull();
  });

  it('cambiar a RENOVAR limpia la fecha de egreso (no queda huérfana)', async () => {
    const r = await post(`/renovaciones/${CID}/decision`, tADMIN, { decision: 'RENOVAR' });
    expect(r.statusCode).toBe(200);
    expect(r.json().fechaEgreso).toBeNull();
    const inten = await prisma.intencionRenovacion.findUniqueOrThrow({ where: { contratoId: CID } });
    expect(inten.fechaEgreso).toBeNull();
  });

  it('rechaza fecha inválida (coerce.date) → 400', async () => {
    const r = await post(`/renovaciones/${CID}/decision`, tADMIN, { decision: 'NO_RENOVAR', fechaEgreso: 'no-es-fecha' });
    expect(r.statusCode).toBe(400);
  });
});
