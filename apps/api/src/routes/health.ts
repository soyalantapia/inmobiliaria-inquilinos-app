import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    let db = 'down';
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      // db down — lo reportamos sin tirar el endpoint
    }
    return { ok: true, db, ts: new Date().toISOString() };
  });
}
