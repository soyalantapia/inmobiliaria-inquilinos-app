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
 * riesgo #9 —eso lo cerró T-72, guardando de quién es cada archivo—, pero cierra el único
 * endpoint que quedó fuera del fix de revocación.
 *
 * ⚠️ Este test mide LA REVOCACIÓN, no el ámbito. Si un día vuelve a fallar con 403 donde
 * espera 404, mirá primero la sonda: probablemente el archivo dejó de estar en el ámbito del
 * titular.
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

/**
 * La sonda: un archivo que **no existe en disco** pero que **sí es del titular**.
 *
 * Antes alcanzaba con una URL inventada, porque `/uploads` autorizaba sólo por tenant y el 404
 * probaba que la autorización había pasado. **Desde T-72 eso dejó de ser cierto**: con
 * `UPLOADS_AMBITO=on` un archivo que no es de nadie da 403 — correctamente—, y este test pasaba
 * a medir la regla de ámbito en vez de la revocación, que es lo suyo. Se rompió así, en verde
 * del lado del producto y en rojo del lado de la sonda.
 *
 * Por eso ahora se registra el dueño (vía 1 de `puedeLeerArchivo`): la sonda queda DENTRO del
 * ámbito del titular, y entonces el único motivo posible de un no-404 vuelve a ser la
 * revocación. La URL es estable —no `Date.now()`— porque tiene que ser la misma que se
 * registró.
 */
let archivoUrl = '';
const pedir = () => app.inject({ method: 'GET', url: archivoUrl, headers: { authorization: `Bearer ${token}` } });

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
  const fila = await prisma.inquilino.findFirst({ where: { email: 'mariela.sosa@example.com' } });
  if (fila) {
    inquilinoId = fila.id;
    tenant = fila.inmobiliariaId;
    contratoOriginal = fila.contratoId;
  }
  archivoUrl = `/uploads/${tenant}/no-existe-t70.pdf`;
  await prisma.archivoSubido.upsert({
    where: { url: archivoUrl },
    update: { inmobiliariaId: tenant, subidoPorKind: 'INQUILINO', subidoPorId: inquilinoId },
    create: {
      inmobiliariaId: tenant,
      url: archivoUrl,
      subidoPorKind: 'INQUILINO',
      subidoPorId: inquilinoId,
      origen: 'test:T-70',
    },
  });
});

afterAll(async () => {
  // Restaurar SIEMPRE: la base es compartida entre los archivos de la suite.
  if (inquilinoId) {
    await prisma.inquilino.update({ where: { id: inquilinoId }, data: { contratoId: contratoOriginal } }).catch(() => {});
  }
  if (archivoUrl) {
    await prisma.archivoSubido.deleteMany({ where: { url: archivoUrl } }).catch(() => {});
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
