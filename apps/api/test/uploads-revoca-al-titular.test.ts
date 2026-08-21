/**
 * T-70 · La tercera puerta del titular quedó abierta.
 *
 * `/uploads` tiene su propio guard —`requireAuthOProfesional`— porque además del JWT normal
 * acepta el token del profesional por link mágico. Cuando se agregó ahí la revalidación contra
 * la base, se cubrió al **co-inquilino** y al **profesional**, y se salteó al **titular**.
 *
 * El propio docblock de `inquilinoRevocado` (auth/guards.ts) decía que son "las DOS puertas del
 * titular: cuando la revalidación vivía en una sola, la otra quedaba abierta". Eran tres.
 *
 * Consecuencia: un inquilino al que le dieron de baja el alquiler —o cuyo token apunta a un
 * contrato que ya no es el suyo— conservaba el token hasta **15 días** y seguía leyendo y
 * escribiendo el Volume del tenant por este endpoint. No arregla el IDOR intra-tenant del
 * riesgo #9 (para eso hace falta saber de quién es cada archivo, que hoy no se guarda), pero
 * cierra el único endpoint que quedó fuera del fix de revocación.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
let inquilinoId = '';
let tenant = '';
let contratoOriginal: string | null = null;

/** Un archivo que no existe: alcanza para distinguir "pasó la autorización" (404) de "no pasó" (401). */
const url = () => `/uploads/${tenant}/no-existe-${Date.now()}.pdf`;
const pedir = () => app.inject({ method: 'GET', url: url(), headers: { authorization: `Bearer ${token}` } });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  // El atajo de la demo emite una sesión de inquilino titular (sigue disponible fuera de
  // producción — ver T-68).
  const r = await app.inject({ method: 'POST', url: '/auth/demo' });
  token = r.json().token;
  const yo = await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${token}` } });
  inquilinoId = yo.json().id ?? '';
  const fila = await prisma.inquilino.findFirst({ where: { email: 'mariela.sosa@gmail.com' } });
  if (fila) {
    inquilinoId = fila.id;
    tenant = fila.inmobiliariaId;
    contratoOriginal = fila.contratoId;
  }
});

afterAll(async () => {
  // Restaurar SIEMPRE: la base es compartida entre los archivos de la suite.
  if (inquilinoId) {
    await prisma.inquilino.update({ where: { id: inquilinoId }, data: { contratoId: contratoOriginal } }).catch(() => {});
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('T-70 — /uploads revoca al titular igual que a los otros dos kinds', () => {
  it('el escenario se armó', () => {
    expect(token).not.toBe('');
    expect(inquilinoId).not.toBe('');
  });

  it('con el alquiler vigente, pasa la autorización (404 por archivo inexistente, no 401)', async () => {
    const r = await pedir();
    expect(r.statusCode).toBe(404);
  });

  it('si el token queda apuntando a un contrato que ya no es suyo → 401', async () => {
    await prisma.inquilino.update({ where: { id: inquilinoId }, data: { contratoId: null } });
    const r = await pedir();
    // Con el bug: 404 — o sea, seguía entrando al Volume del tenant con el token viejo.
    expect(r.statusCode).toBe(401);
    expect(r.json().message).toContain('cambió');
  });

  it('restaurado el alquiler, vuelve a pasar', async () => {
    await prisma.inquilino.update({ where: { id: inquilinoId }, data: { contratoId: contratoOriginal } });
    expect((await pedir()).statusCode).toBe(404);
  });
});
