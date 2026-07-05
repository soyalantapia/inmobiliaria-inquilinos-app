import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// Baja de contrato: distinguir FINALIZACIÓN (fin del plazo) de RESCISIÓN anticipada.
// Antes toda baja colapsaba en FINALIZADO; ahora `finalizar` acepta `tipo` y el
// estado RESCINDIDO —que la app ya renderiza— por fin es alcanzable.

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const CID_RESC = 'cnt_002'; // para rescindir
const CID_FIN = 'cnt_004'; // para finalizar (default)

// Deja el contrato ACTIVO (updateMany = no-op si no existe). seedBase upserta el
// contrato SIN resetear estado, así que reactivamos para que el test sea determinista.
async function reactivar(cid: string) {
  await prisma.contrato.updateMany({ where: { id: cid }, data: { estado: 'ACTIVO' } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  await reactivar(CID_RESC);
  await reactivar(CID_FIN);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  tADMIN = login.json().token;
});

afterAll(async () => {
  // Restaurar para no dejar contratos del seed dados de baja para otros archivos.
  await reactivar(CID_RESC);
  await reactivar(CID_FIN);
  await app.close();
  await prisma.$disconnect();
});

describe('Baja de contrato — finalización vs rescisión', () => {
  it('finalizar con tipo RESCINDIDO → estado RESCINDIDO', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${CID_RESC}/finalizar`,
      headers: auth(tADMIN),
      payload: { tipo: 'RESCINDIDO' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().estado).toBe('RESCINDIDO');
    const c = await prisma.contrato.findUnique({ where: { id: CID_RESC }, select: { estado: true } });
    expect(c?.estado).toBe('RESCINDIDO');
  });

  it('finalizar SIN tipo → estado FINALIZADO (compat con callers viejos)', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${CID_FIN}/finalizar`,
      headers: auth(tADMIN),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().estado).toBe('FINALIZADO');
    const c = await prisma.contrato.findUnique({ where: { id: CID_FIN }, select: { estado: true } });
    expect(c?.estado).toBe('FINALIZADO');
  });

  it('un contrato ya rescindido no se re-da de baja → 409', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${CID_RESC}/finalizar`,
      headers: auth(tADMIN),
      payload: { tipo: 'FINALIZADO' },
    });
    expect(r.statusCode).toBe(409);
  });

  it('tipo inválido → cae a FINALIZADO (no rompe)', async () => {
    // El schema es opcional + safeParse: un tipo basura no explota, usa el default.
    await reactivar(CID_FIN);
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${CID_FIN}/finalizar`,
      headers: auth(tADMIN),
      payload: { tipo: 'CUALQUIERA' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().estado).toBe('FINALIZADO');
  });
});
