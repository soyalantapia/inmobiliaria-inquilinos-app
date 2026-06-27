import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    let db = 'down';
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      // db down — lo reportamos sin tirar el endpoint
    }
    // 503 si la DB está caída → un load balancer / healthcheck saca el pod de
    // rotación en vez de seguir mandándole tráfico (antes devolvía 200 siempre).
    if (db !== 'up') reply.code(503);
    return { ok: db === 'up', db, ts: new Date().toISOString() };
  });
}
