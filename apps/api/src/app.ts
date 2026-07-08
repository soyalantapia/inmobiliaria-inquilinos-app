import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { loadEnv, type Env } from './env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { coreRoutes } from './routes/core.js';
import { plataRoutes } from './routes/plata.js';
import { operacionRoutes } from './routes/operacion.js';
import { anunciosRoutes } from './routes/anuncios.js';
import { inquilinoMundoRoutes } from './routes/inquilino-mundo.js';
import { uploadsRoutes } from './routes/uploads.js';
import { documentosRoutes } from './routes/documentos.js';
import { serviciosPublicosRoutes } from './routes/servicios-publicos.js';
import { miPerfilRoutes } from './routes/mi-perfil.js';
import { visitasPublicasRoutes } from './routes/visitas-publicas.js';
import { resumenesBancariosRoutes } from './routes/resumenes-bancarios.js';
import { importacionesCarteraRoutes } from './routes/importaciones-cartera.js';
import { propiedadReclamosRoutes } from './routes/propiedad-reclamos.js';
import { contratoGananciaRoutes } from './routes/contrato-ganancia.js';
import { propiedadGananciasRoutes } from './routes/propiedad-ganancias.js';
import { propiedadSaludPagoRoutes } from './routes/propiedad-salud-pago.js';
import { propiedadSegurosRoutes } from './routes/propiedad-seguros.js';
import { propiedadTimelineRoutes } from './routes/propiedad-timeline.js';

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
  // Uploads de archivos (comprobantes/boletas/fotos/documentos) → Railway Volume.
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

  // Error-handler global: sin esto cualquier z.parse() o error de Prisma no
  // atrapado cae al 500 genérico de Fastify (entrada malformada o conflicto se
  // ven como "error del servidor", y en mutaciones = falso-error tras commit).
  // Acá los mapeamos a 4xx claros. Es la red de seguridad; cada endpoint igual
  // valida con zod y maneja sus conflictos donde puede dar un mensaje mejor.
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ message: 'Datos inválidos', issues: err.issues });
    }
    const code = (err as { code?: string }).code;
    if (code === 'P2002') return reply.code(409).send({ message: 'Ya existe un registro con esos datos' });
    if (code === 'P2003') return reply.code(409).send({ message: 'No se puede completar: hay datos relacionados' });
    if (code === 'P2025') return reply.code(404).send({ message: 'Registro inexistente' });
    // P2034: write-conflict/deadlock de una tx Serializable (p.ej. baja de
    // sociedad, cambio de rol). Sin esto caía al 500 genérico. 409 = reintentable.
    if (code === 'P2034') return reply.code(409).send({ message: 'Conflicto de escritura concurrente, reintentá' });
    // Errores que ya traen un statusCode de cliente (rate-limit 429, JWT 401,
    // validación nativa de Fastify 400…): respetarlos en vez de pisarlos con 500.
    const status = (err as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.code(status).send({ message: (err as Error).message });
    }
    req.log?.error(err);
    return reply.code(500).send({ message: 'Error interno' });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(coreRoutes);
  await app.register(plataRoutes);
  await app.register(operacionRoutes);
  await app.register(anunciosRoutes);
  await app.register(inquilinoMundoRoutes);
  await app.register(uploadsRoutes);
  await app.register(documentosRoutes);
  await app.register(serviciosPublicosRoutes);
  await app.register(miPerfilRoutes);
  await app.register(visitasPublicasRoutes);
  await app.register(resumenesBancariosRoutes);
  await app.register(importacionesCarteraRoutes);
  await app.register(propiedadReclamosRoutes);
  await app.register(contratoGananciaRoutes);
  await app.register(propiedadGananciasRoutes);
  await app.register(propiedadSaludPagoRoutes);
  await app.register(propiedadSegurosRoutes);
  await app.register(propiedadTimelineRoutes);

  return app;
}
