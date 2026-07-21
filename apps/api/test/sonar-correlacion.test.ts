import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import {
  flushSonarServerEvents,
  _resetRateLimitSonarServerEvents,
} from '../src/lib/sonar-server-events.js';

/**
 * Correlación browser↔backend con Sonar.
 *
 * Dos cosas se verifican acá y ninguna toca la red ni la DB:
 *  1. El header `x-sonar-correlation` sale SIEMPRE (éxito y error) — sin él el loader del
 *     browser no tiene con qué correlacionar.
 *  2. QUÉ se reporta a /v1/server-events: solo los 500 reales. Los 4xx esperados y —sobre
 *     todo— los 5xx `expose:true` (que son "Sonar caído") NO, porque reportarlos crea un
 *     lazo de retroalimentación.
 */

const HEADER = 'x-sonar-correlation';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mock de fetch: responde 202 como el Sonar real, sin salir a la red. */
function mockFetch() {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 202,
    text: async () => '{"ok":true}',
  }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** Rutas sintéticas para ejercitar cada rama del setErrorHandler sin depender de la DB. */
function registrarRutasDePrueba(app: FastifyInstance) {
  app.get('/__test/ok', async () => ({ ok: true }));

  app.get('/__test/boom', async () => {
    throw new Error('explotó adentro del handler');
  });

  app.get('/__test/boom/:id', async () => {
    throw new Error('explotó con param');
  });

  // Zod: el error-handler lo mapea a 400.
  app.post('/__test/zod', async () => {
    const { z } = await import('zod');
    z.object({ n: z.number() }).parse({ n: 'no soy número' });
    return { ok: true };
  });

  // 5xx `expose:true`: la firma exacta de un fallo del PROPIO Sonar (lib/sonar.ts).
  app.get('/__test/sonar-caido', async () => {
    const err = new Error('No se pudo comunicar con el servicio de soporte.') as Error & {
      statusCode: number;
      expose: boolean;
    };
    err.statusCode = 502;
    err.expose = true;
    throw err;
  });
}

// ── App CON Sonar configurado ────────────────────────────────────────────────────────
describe('con SONAR_SERVER_KEY configurada', () => {
  let app: FastifyInstance;
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeAll(async () => {
    app = await buildApp({
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      SONAR_API_URL: 'https://sonar.test',
      SONAR_SERVER_KEY: 'clave-de-test',
      SONAR_SERVICE_NAME: 'myalquiler-api-test',
    });
    registrarRutasDePrueba(app);
    await app.ready();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  beforeEach(() => {
    _resetRateLimitSonarServerEvents();
    fetchMock = mockFetch();
  });

  describe('header de correlación', () => {
    it('sale en una respuesta exitosa', async () => {
      const res = await app.inject({ method: 'GET', url: '/__test/ok' });
      expect(res.statusCode).toBe(200);
      expect(res.headers[HEADER]).toMatch(UUID_RE);
    });

    it('sale TAMBIÉN en una respuesta de error 500 (el caso que importa)', async () => {
      const res = await app.inject({ method: 'GET', url: '/__test/boom' });
      expect(res.statusCode).toBe(500);
      expect(res.json().message).toBe('Error interno');
      expect(res.headers[HEADER]).toMatch(UUID_RE);
    });

    it('sale en un 400 de Zod y en un 404 de ruta inexistente', async () => {
      const zod = await app.inject({ method: 'POST', url: '/__test/zod', payload: {} });
      expect(zod.statusCode).toBe(400);
      expect(zod.headers[HEADER]).toMatch(UUID_RE);

      const noExiste = await app.inject({ method: 'GET', url: '/__test/no-existe-nada' });
      expect(noExiste.statusCode).toBe(404);
      expect(noExiste.headers[HEADER]).toMatch(UUID_RE);
    });

    it('respeta el id ENTRANTE en vez de generar uno nuevo', async () => {
      const entrante = 'cid-del-browser-123';
      const res = await app.inject({
        method: 'GET',
        url: '/__test/ok',
        headers: { [HEADER]: entrante },
      });
      expect(res.headers[HEADER]).toBe(entrante);
    });

    it('respeta el id entrante también cuando la respuesta la arma el errorHandler', async () => {
      const entrante = 'cid-de-un-fallo-999';
      const res = await app.inject({
        method: 'GET',
        url: '/__test/boom',
        headers: { [HEADER]: entrante },
      });
      expect(res.statusCode).toBe(500);
      expect(res.headers[HEADER]).toBe(entrante);
    });

    it('cada request sin id entrante recibe uno distinto', async () => {
      const a = await app.inject({ method: 'GET', url: '/__test/ok' });
      const b = await app.inject({ method: 'GET', url: '/__test/ok' });
      expect(a.headers[HEADER]).not.toBe(b.headers[HEADER]);
    });

    it('un id entrante con basura (CRLF) se descarta y NO rompe la respuesta', async () => {
      // Si lo copiáramos crudo al header de salida, Node tira ERR_INVALID_CHAR y se cae
      // TODA la respuesta.
      const res = await app.inject({
        method: 'GET',
        url: '/__test/ok',
        headers: { [HEADER]: 'malo\r\nX-Inyectado: si' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers[HEADER]).toMatch(UUID_RE);
      expect(res.headers['x-inyectado']).toBeUndefined();
    });

    it('expone el header vía CORS (si no, el browser no lo puede leer)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/__test/ok',
        headers: { origin: 'http://localhost:3000' },
      });
      expect(String(res.headers['access-control-expose-headers'])).toContain(HEADER);
    });
  });

  describe('qué se reporta a /v1/server-events', () => {
    it('un 500 real dispara el POST con el mismo correlationId de la respuesta', async () => {
      const res = await app.inject({ method: 'GET', url: '/__test/boom/abc-123' });
      await flushSonarServerEvents();

      expect(res.statusCode).toBe(500);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('https://sonar.test/v1/server-events');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['x-sonar-server-key']).toBe('clave-de-test');

      const body = JSON.parse(init.body as string);
      expect(body.correlationId).toBe(res.headers[HEADER]);
      expect(body.service).toBe('myalquiler-api-test');
      expect(body.serverError.statusCode).toBe(500);
      expect(body.serverError.errorType).toBe('Error');
      expect(body.serverError.message).toBe('explotó con param');
      expect(body.serverError.stack).toContain('Error: explotó con param');
      // Ruta TEMPLATEADA: el id real no viaja.
      expect(body.serverError.route).toBe('/__test/boom/:id');
      expect(body.serverError.route).not.toContain('abc-123');
      expect(body.context).toEqual({ method: 'GET' });
      // No mandamos el body del request ni objetos de dominio.
      expect(Object.keys(body)).toEqual(
        expect.arrayContaining(['service', 'correlationId', 'serverError', 'context']),
      );
    });

    it('un 400 de Zod NO dispara ningún POST', async () => {
      const res = await app.inject({ method: 'POST', url: '/__test/zod', payload: {} });
      await flushSonarServerEvents();
      expect(res.statusCode).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('un 5xx con expose:true NO dispara ningún POST (lazo de retroalimentación)', async () => {
      // Este es el test de la trampa: ese error ES "Sonar no responde". Si lo reportáramos,
      // cada fallo de Sonar generaría otro reporte a Sonar.
      const res = await app.inject({ method: 'GET', url: '/__test/sonar-caido' });
      await flushSonarServerEvents();
      expect(res.statusCode).toBe(502);
      expect(res.json().message).toBe('No se pudo comunicar con el servicio de soporte.');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('un 401 (sin token) NO dispara ningún POST', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/soporte/config' });
      await flushSonarServerEvents();
      expect(res.statusCode).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('una respuesta exitosa NO dispara ningún POST', async () => {
      await app.inject({ method: 'GET', url: '/__test/ok' });
      await flushSonarServerEvents();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('si Sonar rechaza el evento, el 500 al cliente sale igual y nada explota', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('ECONNREFUSED sonar.test');
        }),
      );
      const res = await app.inject({ method: 'GET', url: '/__test/boom' });
      await flushSonarServerEvents();
      expect(res.statusCode).toBe(500);
      expect(res.json().message).toBe('Error interno');
      expect(res.headers[HEADER]).toMatch(UUID_RE);
    });
  });
});

// ── App SIN Sonar configurado (local y CI) ───────────────────────────────────────────
describe('sin SONAR_SERVER_KEY (mecanismo inerte)', () => {
  let app: FastifyInstance;
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeAll(async () => {
    app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true', SONAR_SERVER_KEY: '' });
    registrarRutasDePrueba(app);
    await app.ready();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  beforeEach(() => {
    _resetRateLimitSonarServerEvents();
    fetchMock = mockFetch();
  });

  it('un 500 real NO hace ningún POST y responde igual', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/boom' });
    await flushSonarServerEvents();
    expect(res.statusCode).toBe(500);
    expect(res.json().message).toBe('Error interno');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('el header de correlación sale igual (no depende de la key)', async () => {
    const ok = await app.inject({ method: 'GET', url: '/__test/ok' });
    const err = await app.inject({ method: 'GET', url: '/__test/boom' });
    expect(ok.headers[HEADER]).toMatch(UUID_RE);
    expect(err.headers[HEADER]).toMatch(UUID_RE);
  });
});
