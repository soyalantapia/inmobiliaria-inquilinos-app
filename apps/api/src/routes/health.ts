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
      // El SHA sólo llega cuando el deploy sale de un repo conectado a GitHub o de un clon
      // normal: `railway up` desde un WORKTREE de git no manda metadata (el .git es un
      // archivo, no un directorio, y el CLI no lo lee) y el campo quedaba en 'desconocido' —
      // justo lo que este endpoint venía a resolver. `RAILWAY_DEPLOYMENT_ID` está SIEMPRE, y
      // se cruza con `railway deployment list` para saber qué se subió y cuándo.
      // Desde el 29/08 produccion corre en RENDER, que expone `RENDER_GIT_COMMIT`. Mientras
      // esto leia solo las variables de Railway, /health contestaba 'desconocido' en
      // produccion — o sea que no habia forma de saber DESDE AFUERA que version esta
      // sirviendo, que es justo lo que hace falta para verificar un deploy o una vuelta atras.
      version:
        process.env.RENDER_GIT_COMMIT?.slice(0, 7) ??
        process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ??
        (process.env.RAILWAY_DEPLOYMENT_ID ? `deploy:${process.env.RAILWAY_DEPLOYMENT_ID.slice(0, 8)}` : 'desconocido'),
      ts: new Date().toISOString(),
    };
  });
}
