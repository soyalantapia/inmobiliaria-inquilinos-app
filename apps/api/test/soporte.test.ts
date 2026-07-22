import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

/**
 * Tests del proxy de Soporte (Sonar) y del contrato del error-handler. No tocan la
 * DB: el gate de auth falla antes de cualquier query, y las rutas de prueba del
 * error-handler lanzan directo.
 */

let app: FastifyInstance;

beforeAll(async () => {
  // `inmo_1` queda habilitada en el allowlist de Soporte para poder seguir probando las
  // CAPACIDADES (leer vs mutar). La frontera de tenant en sí se prueba aparte, con una
  // inmobiliaria que NO está en la lista.
  app = await buildApp({ NODE_ENV: 'test', SOPORTE_TENANT_IDS: 'inmo_1' });

  // Rutas sintéticas para ejercitar el setErrorHandler sin depender de que Sonar
  // esté caído. Se registran DESPUÉS de las reales, así que no pisan nada.
  app.get('/__test/err-5xx-expose', async () => {
    const err = new Error('El servicio de soporte no responde.') as Error & {
      statusCode: number;
      expose: boolean;
    };
    err.statusCode = 502;
    err.expose = true;
    throw err;
  });

  app.get('/__test/err-5xx-interno', async () => {
    // Sin `expose`: es un error nuestro, el mensaje NO debe llegar al cliente.
    const err = new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2') as Error & {
      statusCode: number;
    };
    err.statusCode = 500;
    throw err;
  });

  app.get('/__test/err-crudo', async () => {
    throw new Error('boom sin statusCode');
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('setErrorHandler: 5xx con expose', () => {
  it('un 5xx marcado expose:true conserva status y mensaje (servicio externo)', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/err-5xx-expose' });
    expect(res.statusCode).toBe(502);
    expect(res.json().message).toBe('El servicio de soporte no responde.');
  });

  it('un 5xx SIN expose sigue siendo "Error interno" (no filtra internals)', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/err-5xx-interno' });
    expect(res.statusCode).toBe(500);
    expect(res.json().message).toBe('Error interno');
    // Lo importante: nada del mensaje original se escapa.
    expect(res.body).not.toContain('ECONNREFUSED');
    expect(res.body).not.toContain('hunter2');
  });

  it('un error sin statusCode sigue cayendo al 500 genérico', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/err-crudo' });
    expect(res.statusCode).toBe(500);
    expect(res.json().message).toBe('Error interno');
    expect(res.body).not.toContain('boom sin statusCode');
  });
});

describe('/api/soporte/* exige sesión del panel', () => {
  const rutas: [string, string][] = [
    ['GET', '/api/soporte/config'],
    ['GET', '/api/soporte/issues'],
    ['GET', '/api/soporte/issues/abc123'],
    ['PATCH', '/api/soporte/issues/abc123'],
  ];

  for (const [method, url] of rutas) {
    it(`${method} ${url} sin token → 401`, async () => {
      const res = await app.inject({
        method: method as 'GET' | 'PATCH',
        url,
        ...(method === 'PATCH' ? { payload: { status: 'resolved' } } : {}),
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe('No autenticado');
    });

    it(`${method} ${url} con token basura → 401`, async () => {
      const res = await app.inject({
        method: method as 'GET' | 'PATCH',
        url,
        headers: { authorization: 'Bearer no-es-un-jwt' },
        ...(method === 'PATCH' ? { payload: { status: 'resolved' } } : {}),
      });
      expect(res.statusCode).toBe(401);
    });
  }

  it('un token de INQUILINO no entra al panel de soporte → 403', async () => {
    // Los inquilinos tienen kind:'inquilino'; requireUsuario solo deja pasar 'usuario'.
    const token = app.jwt.sign({
      kind: 'inquilino',
      inquilinoId: 'inq_1',
      contratoId: 'cnt_1',
      inmobiliariaId: 'inmo_1',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/soporte/config',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('capacidades: leer vs mutar tickets', () => {
  const tokenDe = (rol: 'ADMIN' | 'OPERADOR' | 'CARGA' | 'LECTURA') =>
    app.jwt.sign({ kind: 'usuario', userId: `u_${rol}`, inmobiliariaId: 'inmo_1', rol });

  // Leer usa 'auditoria.ver' → ADMIN y LECTURA. Mutar usa 'equipo.gestionar' → solo ADMIN.
  // Un 403 lo decide el guard sin tocar Sonar; los roles habilitados pasan el guard y
  // recién ahí fallan contra Sonar (no configurado en test) — por eso NO esperamos 200.
  it.each([
    ['OPERADOR', 403],
    ['CARGA', 403],
  ] as const)('GET /issues con rol %s → %i', async (rol, esperado) => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/soporte/issues',
      headers: { authorization: `Bearer ${tokenDe(rol)}` },
    });
    expect(res.statusCode).toBe(esperado);
  });

  it.each([
    ['LECTURA', 403],
    ['OPERADOR', 403],
    ['CARGA', 403],
  ] as const)('PATCH /issues/:id con rol %s → %i (no puede cerrar tickets)', async (rol, esperado) => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/soporte/issues/abc123',
      headers: { authorization: `Bearer ${tokenDe(rol)}` },
      payload: { status: 'resolved' },
    });
    expect(res.statusCode).toBe(esperado);
  });

  it('LECTURA SÍ pasa el guard de lectura (no da 403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/soporte/issues',
      headers: { authorization: `Bearer ${tokenDe('LECTURA')}` },
    });
    expect(res.statusCode).not.toBe(403);
    expect(res.statusCode).not.toBe(401);
  });

  it('ADMIN pasa ambos guards (no da 401/403)', async () => {
    for (const [method, url] of [
      ['GET', '/api/soporte/issues'],
      ['PATCH', '/api/soporte/issues/abc123'],
    ] as const) {
      const res = await app.inject({
        method,
        url,
        headers: { authorization: `Bearer ${tokenDe('ADMIN')}` },
        ...(method === 'PATCH' ? { payload: { status: 'resolved' } } : {}),
      });
      expect([401, 403]).not.toContain(res.statusCode);
    }
  });
});

/**
 * REGRESIÓN del P0 de la auditoría 21/07: Sonar es UN proyecto global para todo
 * MyAlquiler, así que la capacidad NO alcanza como frontera. Como `/auth/registro` es
 * alta pública, cualquiera se registraba (quedando ADMIN de su propia inmobiliaria) y
 * leía los tickets —con la PII de los inquilinos— de TODOS los tenants.
 */
describe('frontera de tenant: solo el allowlist entra a Soporte', () => {
  // ADMIN legítimo de SU inmobiliaria, pero fuera del allowlist. Es exactamente el
  // atacante del hallazgo: no necesita robar nada, le alcanza con registrarse.
  const tokenAjeno = () =>
    app.jwt.sign({ kind: 'usuario', userId: 'u_intruso', inmobiliariaId: 'inmo_ajena', rol: 'ADMIN' });

  it.each([
    ['GET', '/api/soporte/issues'],
    ['GET', '/api/soporte/issues/abc123'],
    ['PATCH', '/api/soporte/issues/abc123'],
  ] as const)('%s %s desde un tenant no habilitado → 403', async (method, url) => {
    const res = await app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${tokenAjeno()}` },
      ...(method === 'PATCH' ? { payload: { status: 'resolved' } } : {}),
    });
    expect(res.statusCode).toBe(403);
  });

  it('/config no rompe ni filtra: degrada a { configured: false }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/soporte/config',
      headers: { authorization: `Bearer ${tokenAjeno()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ configured: false });
  });

  it('FAIL-CLOSED: sin SOPORTE_TENANT_IDS no entra nadie, ni el ADMIN del allowlist previo', async () => {
    const cerrada = await buildApp({ NODE_ENV: 'test' }); // sin la var
    try {
      const res = await cerrada.inject({
        method: 'GET',
        url: '/api/soporte/issues',
        headers: {
          authorization: `Bearer ${cerrada.jwt.sign({
            kind: 'usuario',
            userId: 'u_admin',
            inmobiliariaId: 'inmo_1',
            rol: 'ADMIN',
          })}`,
        },
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await cerrada.close();
    }
  });
});
