import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { loadEnv, type Env } from './env.js';
import { healthRoutes } from './routes/health.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
  }
}

/**
 * buildApp() arma la instancia sin escuchar — la usan igual el server real
 * (index.ts) y los tests de integración (app.inject()).
 */
export async function buildApp(envOverrides: Partial<Record<string, string>> = {}): Promise<FastifyInstance> {
  const env = loadEnv(envOverrides);
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    trustProxy: true, // Railway: x-forwarded-for trae la IP real del cliente
  });

  app.decorate('env', env);

  await app.register(helmet);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(jwt, { secret: env.JWT_SECRET });

  await app.register(healthRoutes);

  return app;
}
