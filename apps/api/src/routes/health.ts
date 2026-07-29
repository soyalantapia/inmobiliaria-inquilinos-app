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
    // `version` = el commit que REALMENTE está corriendo. Sin esto no había forma de saber
    // qué hay deployado (no hay tags ni releases), así que después de un `railway up` no se
    // podía verificar que el deploy entró, ni medir la distancia entre prod y main.
    // Railway inyecta RAILWAY_GIT_COMMIT_SHA solo; el fallback deja el endpoint honesto
    // ('desconocido') en vez de mentir con un valor fijo.
    return {
      ok: db === 'up',
      db,
      version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'desconocido',
      ts: new Date().toISOString(),
    };
  });
}
