import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import {
  flushSonarServerEvents,
  _resetRateLimitSonarServerEvents,
  reportarErrorAlSonar,
  sanitizarMensajePrisma,
  setAvisadorDeVentanaSonar,
  setAvisadorDeRechazoSonar,
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
    // SONAR_API_URL SÍ configurada a propósito: si no, el mecanismo quedaría inerte por
    // falta de URL y este bloque pasaría sin probar el gate de la key, que es lo que dice
    // verificar. La única pieza ausente tiene que ser la key.
    app = await buildApp({
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      SONAR_API_URL: 'https://sonar.test',
      SONAR_SERVER_KEY: '',
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

/**
 * Lo que sigue nació de una auditoría adversarial: cada bloque cubre un agujero que se
 * encontró REPRODUCIENDO el problema, no leyendo el código.
 */
describe('lo que NO puede escaparse a Sonar', () => {
  beforeEach(() => {
    _resetRateLimitSonarServerEvents();
  });

  // El hallazgo más caro: Prisma mete el `data`/`where` COMPLETO —con los valores— adentro
  // del message. En esta app eso es el nombre del inquilino y el DNI en el path del archivo.
  it('saca los argumentos de un error de Prisma y deja la causa', () => {
    const real = [
      'Invalid `prisma.documento.create()` invocation:',
      '',
      '{',
      '  data: {',
      '    nombre: "DNI frente - Marta Gonzalez.pdf",',
      '    archivoUrl: "/uploads/inmob_77/dni-marta-gonzalez-27345678.pdf",',
      '    inquilinoId: "clx9inq0001",',
      '  }',
      '}',
      '',
      'Argument `vencimiento`: Invalid value provided. Expected DateTime or Null, provided String.',
    ].join('\n');

    const limpio = sanitizarMensajePrisma(real)!;

    // lo que identifica a la persona NO puede sobrevivir
    expect(limpio).not.toContain('Marta Gonzalez');
    expect(limpio).not.toContain('27345678');
    expect(limpio).not.toContain('clx9inq0001');
    // lo que sirve para depurar SÍ tiene que sobrevivir
    expect(limpio).toContain('prisma.documento.create()');
    expect(limpio).toContain('Expected DateTime or Null');
  });

  it('deja intacto un mensaje que no es de Prisma', () => {
    const msg = 'El pago de 5000 excede el saldo abierto de 4200';
    expect(sanitizarMensajePrisma(msg)).toBe(msg);
  });

  it('no rompe con undefined ni con un Prisma sin bloque de argumentos', () => {
    expect(sanitizarMensajePrisma(undefined)).toBeUndefined();
    const sinArgs = 'Invalid `prisma.documento.create()` invocation: algo salió mal';
    expect(sanitizarMensajePrisma(sinArgs)).toBe(sinArgs);
  });

  it('el saneado se aplica al emitir, no solo en la función suelta', async () => {
    const fetchMock = mockFetch();
    const app = await buildApp({
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      SONAR_API_URL: 'https://sonar.test',
      SONAR_SERVER_KEY: 'k',
    });
    app.get('/__test/prisma-boom', async () => {
      throw new Error(
        'Invalid `prisma.documento.create()` invocation:\n{\n  data: { nombre: "Marta Gonzalez" }\n}\nArgument `vencimiento`: Invalid value.',
      );
    });
    await app.ready();

    await app.inject({ method: 'GET', url: '/__test/prisma-boom' });
    await flushSonarServerEvents();

    const enviado = JSON.stringify(fetchMock.mock.calls[0]?.[1]?.body ?? '');
    expect(enviado).not.toContain('Marta Gonzalez');
    expect(enviado).toContain('prisma.documento.create()');
    await app.close();
    vi.unstubAllGlobals();
  });
});

describe('lo que NO merece un ticket', () => {
  beforeEach(() => {
    _resetRateLimitSonarServerEvents();
  });

  // Que el usuario cierre la pestaña a mitad de una subida no es un bug: sin este filtro,
  // cada usuario con mala conexión genera tickets que nadie puede accionar.
  it('una desconexión del cliente no dispara ningún POST', async () => {
    const fetchMock = mockFetch();
    const app = await buildApp({
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      SONAR_API_URL: 'https://sonar.test',
      SONAR_SERVER_KEY: 'k',
    });
    app.get('/__test/corte', async () => {
      const e = new Error('Premature close') as NodeJS.ErrnoException;
      e.code = 'ERR_STREAM_PREMATURE_CLOSE';
      throw e;
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/__test/corte' });
    await flushSonarServerEvents();

    expect(res.statusCode).toBe(500); // al cliente se le sigue respondiendo igual
    expect(fetchMock).not.toHaveBeenCalled();
    await app.close();
    vi.unstubAllGlobals();
  });
});

describe('tope anti-tormenta', () => {
  beforeEach(() => {
    _resetRateLimitSonarServerEvents();
  });

  it('corta a los 6 envíos por identidad de error', async () => {
    const fetchMock = mockFetch();
    const env = {
      SONAR_API_URL: 'https://sonar.test',
      SONAR_SERVER_KEY: 'k',
      SONAR_SERVICE_NAME: 'test',
    };
    // Mismo errorType y misma route = misma identidad, aunque el mensaje varíe.
    for (let i = 0; i < 35; i++) {
      reportarErrorAlSonar(env as never, {
        serverError: { errorType: 'Error', route: '/api/x', message: `boom ${i}` },
      });
    }
    await flushSonarServerEvents();

    expect(fetchMock).toHaveBeenCalledTimes(6);
    vi.unstubAllGlobals();
  });

  it('el nombre del servicio se recorta para que Sonar no lo rechace', async () => {
    const fetchMock = mockFetch();
    reportarErrorAlSonar(
      {
        SONAR_API_URL: 'https://sonar.test',
        SONAR_SERVER_KEY: 'k',
        SONAR_SERVICE_NAME: 'x'.repeat(500),
      } as never,
      { serverError: { message: 'boom' } },
    );
    await flushSonarServerEvents();

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.service.length).toBeLessThanOrEqual(120);
    vi.unstubAllGlobals();
  });
});

describe('el onSend cubre el preflight (el único caso donde es load-bearing)', () => {
  it('el header sale en el 204 de un OPTIONS de CORS', async () => {
    const app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
    await app.ready();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/__test/lo-que-sea',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'GET' },
    });
    // @fastify/cors responde el preflight desde su propio hook, registrado ANTES que el
    // nuestro: acá el onRequest no llega a poner el header y el onSend es el que lo salva.
    expect(res.headers[HEADER]).toBeDefined();
    await app.close();
  });
});

describe('el tope no deja que un error ruidoso tape a los demás', () => {
  beforeEach(() => _resetRateLimitSonarServerEvents());

  it('un error repetido consume su cupo pero otro distinto sigue pasando', async () => {
    const fetchMock = mockFetch();
    const env = { SONAR_API_URL: 'https://sonar.test', SONAR_SERVER_KEY: 'k' } as never;

    // El escenario real: se cae el pool de Postgres y todas las requests fallan igual.
    for (let i = 0; i < 40; i++) {
      reportarErrorAlSonar(env, { serverError: { errorType: 'PrismaError', route: '/api/pagos', message: 'pool' } });
    }
    // Y entonces aparece un bug DISTINTO, que es el que nadie querría perderse.
    reportarErrorAlSonar(env, { serverError: { errorType: 'TypeError', route: '/api/recibos', message: 'otro bug' } });
    await flushSonarServerEvents();

    const cuerpos = fetchMock.mock.calls.map((c) => String((c[1] as RequestInit).body));
    const delRuidoso = cuerpos.filter((b) => b.includes('/api/pagos')).length;
    const delOtro = cuerpos.filter((b) => b.includes('/api/recibos')).length;

    expect(delRuidoso).toBeLessThanOrEqual(6); // el ruidoso quedó acotado
    expect(delOtro).toBe(1); // y el otro NO se perdió
    vi.unstubAllGlobals();
  });

  it('avisa cuántos eventos descartó al cerrar la ventana', async () => {
    mockFetch();
    const avisos: { enviados: number; descartados: number }[] = [];
    setAvisadorDeVentanaSonar((i) => avisos.push(i));
    const env = { SONAR_API_URL: 'https://sonar.test', SONAR_SERVER_KEY: 'k' } as never;

    vi.useFakeTimers();
    for (let i = 0; i < 20; i++) {
      reportarErrorAlSonar(env, { serverError: { errorType: 'X', route: '/r', message: 'a' } });
    }
    vi.advanceTimersByTime(61_000);
    reportarErrorAlSonar(env, { serverError: { errorType: 'X', route: '/r', message: 'a' } });
    vi.useRealTimers();
    await flushSonarServerEvents();

    expect(avisos).toHaveLength(1);
    expect(avisos[0].descartados).toBe(14); // 20 intentos - 6 de cupo
    setAvisadorDeVentanaSonar(null);
    vi.unstubAllGlobals();
  });
});

describe('si Sonar rechaza, no puede pasar en silencio', () => {
  beforeEach(() => _resetRateLimitSonarServerEvents());

  it('avisa cuando Sonar responde 401 (key rotada o mal pegada)', async () => {
    const rechazos: { status: number; cuerpo: string }[] = [];
    setAvisadorDeRechazoSonar((i) => rechazos.push(i));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, text: async () => '{"error":"invalid_server_key"}' })),
    );

    reportarErrorAlSonar({ SONAR_API_URL: 'https://sonar.test', SONAR_SERVER_KEY: 'mala' } as never, {
      serverError: { message: 'boom' },
    });
    await flushSonarServerEvents();

    expect(rechazos).toHaveLength(1);
    expect(rechazos[0].status).toBe(401);
    setAvisadorDeRechazoSonar(null);
    vi.unstubAllGlobals();
  });

  it('avisa cuando Sonar acepta pero DESCARTA (proyecto pausado)', async () => {
    const rechazos: { status: number; cuerpo: string }[] = [];
    setAvisadorDeRechazoSonar((i) => rechazos.push(i));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 202, text: async () => '{"dropped":"ingest_paused"}' })),
    );

    reportarErrorAlSonar({ SONAR_API_URL: 'https://sonar.test', SONAR_SERVER_KEY: 'k' } as never, {
      serverError: { message: 'boom' },
    });
    await flushSonarServerEvents();

    expect(rechazos).toHaveLength(1); // un 202 NO garantiza que el evento se haya guardado
    setAvisadorDeRechazoSonar(null);
    vi.unstubAllGlobals();
  });
});
