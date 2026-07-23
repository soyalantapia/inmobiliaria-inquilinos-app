import { randomUUID } from 'node:crypto';
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
import { propiedadGastosRoutes } from './routes/propiedad-gastos.js';
import { propiedadDocumentosRoutes } from './routes/propiedad-documentos.js';
import { soporteRoutes } from './routes/soporte.js';
import { metricasRoutes } from './routes/metricas.js';
import {
  reportarErrorAlSonar,
  setAvisadorDeVentanaSonar,
  setAvisadorDeRechazoSonar,
} from './lib/sonar-server-events.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
  }
  interface FastifyRequest {
    /** Id que une el error que ve el BROWSER con la excepción del BACKEND en un mismo
     *  ticket de Sonar. Se genera (o se respeta el entrante) en el hook `onRequest` y
     *  vuelve al cliente en el header `x-sonar-correlation`. */
    sonarCorrelationId: string;
  }
}

const CORRELATION_HEADER = 'x-sonar-correlation';
// El header entrante es input del cliente y termina en un header de RESPUESTA: si trae
// CR/LF o basura, Node tira ERR_INVALID_CHAR al escribirlo y nos comemos un 500 en TODAS
// las respuestas. Solo aceptamos un id inocuo; cualquier otra cosa se descarta en silencio
// y generamos uno nuevo. 200 = tope del campo en Sonar.
const CORRELATION_OK = /^[A-Za-z0-9._:-]{1,200}$/;

function correlationIdDe(headerCrudo: string | string[] | undefined): string {
  const v = (Array.isArray(headerCrudo) ? headerCrudo[0] : headerCrudo)?.trim();
  return v && CORRELATION_OK.test(v) ? v : randomUUID();
}

/**
 * buildApp() arma la instancia sin escuchar — la usan igual el server real
 * (index.ts) y los tests de integración (app.inject()).
 */
export async function buildApp(envOverrides: Partial<Record<string, string>> = {}): Promise<FastifyInstance> {
  const env = loadEnv(envOverrides);
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    // Railway pone UN proxy adelante. `1` = confiar solo en ese hop, así `req.ip` es la
    // entrada que escribió Railway (el cliente real).
    //
    // NO volver a `true`: con `true` se confía en TODA la cadena, y entonces `req.ip` pasa
    // a ser el primer valor de `x-forwarded-for` — un header que escribe el cliente. Como
    // el rate-limit usa `req.ip` como key, rotando ese header el techo de 300/min
    // desaparecía y quedaba libre la fuerza bruta contra OTP y login (auditoría 21/07).
    trustProxy: 1,
  });

  app.decorate('env', env);

  await app.register(helmet);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    // CRÍTICO: los fronts corren en OTRO origen que la API. Sin `Access-Control-Expose-Headers`
    // el browser recibe el header pero le PROHÍBE leerlo al JS — el loader de Sonar nunca vería
    // el correlationId y toda la correlación browser↔backend quedaría muerta sin dar ningún error.
    exposedHeaders: [CORRELATION_HEADER],
  });
  await app.register(jwt, { secret: env.JWT_SECRET });
  // Uploads de archivos (comprobantes/boletas/fotos/documentos) → Railway Volume.
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

  // ── Correlación con Sonar ──────────────────────────────────────────────────────────
  // Un id por request que viaja de ida y de vuelta: el loader del browser lo lee de la
  // respuesta y lo adjunta cuando el usuario reporta un bug; el backend lo manda con su
  // excepción a /v1/server-events. Sonar une las dos puntas en un solo ticket.
  // Primitivo (string) a propósito: `decorateRequest` con objetos comparte la referencia
  // entre requests.
  app.decorateRequest('sonarCorrelationId', '');

  // El emisor es fire-and-forget y no puede tirar, así que sin esto sus dos modos de fallo
  // serían INVISIBLES: (a) que Sonar rechace todo —key rotada, proyecto pausado— y la
  // correlación quede muerta para siempre; (b) que el tope anti-tormenta descarte eventos
  // durante un incidente, que es justo cuando más se los necesita. Un hueco silencioso en
  // los datos es peor que el hueco: nadie sabe que hay que desconfiar de lo que ve.
  setAvisadorDeRechazoSonar(({ status, cuerpo }) =>
    app.log.warn({ status, cuerpo }, '[sonar] rechazó nuestros eventos — la correlación no está llegando'),
  );
  setAvisadorDeVentanaSonar(({ enviados, descartados }) =>
    app.log.warn({ enviados, descartados }, '[sonar] tope anti-tormenta: se descartaron eventos'),
  );

  app.addHook('onRequest', async (req, reply) => {
    req.sonarCorrelationId = correlationIdDe(req.headers[CORRELATION_HEADER]);
    reply.header(CORRELATION_HEADER, req.sonarCorrelationId);
  });

  // Red de seguridad: `onSend` corre en TODA respuesta que salga, incluidas las que arma el
  // setErrorHandler y las que cortan antes de que nuestro onRequest llegue a poner el header.
  // El caso concreto que cubre es el PREFLIGHT `OPTIONS`: @fastify/cors lo responde con un
  // 204 desde su propio hook, registrado antes que el nuestro, y sin esto el header no sale.
  // (El 429 del rate-limit NO es uno de esos casos: ahí nuestro onRequest sí corre. El
  // comentario anterior lo afirmaba y era falso — verificado gatillando un 429 real.)
  // Nunca puede tirar: si acá explota, se cae la respuesta entera.
  app.addHook('onSend', async (req, reply, payload) => {
    try {
      if (!reply.getHeader(CORRELATION_HEADER)) {
        if (!req.sonarCorrelationId) req.sonarCorrelationId = randomUUID();
        reply.header(CORRELATION_HEADER, req.sonarCorrelationId);
      }
    } catch {
      /* jamás romper la respuesta por el header de correlación */
    }
    return payload;
  });

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
    // 5xx que el código marcó como seguro de exponer (`expose: true`): errores de un
    // servicio EXTERNO (p.ej. Sonar caído / mal configurado), donde el mensaje describe
    // al tercero y no filtra internals nuestros. Sin esto el front recibe "Error interno"
    // y no puede distinguir "el servicio de soporte no responde" de un bug del API.
    if (typeof status === 'number' && status >= 500 && (err as { expose?: boolean }).expose === true) {
      req.log?.error(err);
      return reply.code(status).send({ message: (err as Error).message });
    }
    req.log?.error(err);
    // Que el usuario corte la conexión NO es un bug nuestro. Una subida cancelada a mitad
    // (cerrar la pestaña, perder señal) hace que `pipeline()` en uploads.ts rechace con
    // ERR_STREAM_PREMATURE_CLOSE y cae acá como si fuera un 500. Sin este filtro, cada
    // usuario con mala conexión genera tickets que nadie puede accionar.
    const codigo = (err as NodeJS.ErrnoException).code;
    const clienteCortó =
      codigo === 'ERR_STREAM_PREMATURE_CLOSE' ||
      codigo === 'ECONNRESET' ||
      codigo === 'ECONNABORTED' ||
      req.raw.aborted === true ||
      req.raw.socket?.destroyed === true;

    // Único punto donde reportamos a Sonar: los 500 REALES (bugs nuestros). Todo lo de
    // arriba ya salió por `return`, así que acá no llegan ni los 4xx esperados (Zod,
    // P2002/P2003/P2025/P2034, 401, 429) ni —clave— los 5xx `expose:true`, que son
    // justamente "Sonar no responde": reportarlos generaría un LAZO (cada fallo de Sonar
    // produciría otro reporte a Sonar). Fire-and-forget: no se awaitea, no puede tirar.
    if (!clienteCortó) reportarErrorAlSonar(env, {
      correlationId: req.sonarCorrelationId || undefined,
      serverError: {
        errorType: (err as Error).name || (err as { constructor?: { name?: string } }).constructor?.name || 'Error',
        message: (err as Error).message,
        stack: (err as Error).stack,
        // La URL del ROUTE (con placeholders, p.ej. /api/contratos/:id), no la url cruda:
        // los ids reales agrupan mal y pueden ser PII.
        route: req.routeOptions?.url ?? req.url,
        statusCode: 500,
      },
      // Metadata acotada. Nada del body ni de los objetos de dominio (DNI, montos, emails).
      context: { method: req.method },
    });
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
  await app.register(propiedadGastosRoutes);
  await app.register(propiedadDocumentosRoutes);
  await app.register(soporteRoutes);
  await app.register(metricasRoutes);

  return app;
}
