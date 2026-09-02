/**
 * T-68 · `POST /auth/demo` emitía una sesión de un inquilino REAL con un solo candado.
 *
 * El endpoint existe para entrar a la demo con un click. Su único gate era `DEMO_MODE`, que es
 * una env var: si alguna vez se filtra a la env de producción, cualquiera que le pegue a
 * `/auth/demo` se lleva un JWT de un inquilino de verdad **sin OTP, sin contraseña, sin ninguna
 * prueba de identidad**. Y la ruta es pública: `authRoutes` se registra sin prefijo y los únicos
 * hooks globales son helmet, rate-limit, cors, jwt, multipart y los dos de correlación — ninguno
 * autentica.
 *
 * NO ES UN HALLAZGO NUEVO: ES UN OLVIDO CON FECHA. El commit `e06956e2` (20/06, "cierre completo
 * de la auditoría pre-lanzamiento") dice textual en su mensaje **«M-1: demo backdoor excluye
 * NODE_ENV=production (auth.ts)»**. Aplicó el guard a los dos `/otp/verify` (auth.ts:337 y :446)
 * y se salteó éste, 250 líneas más abajo en el MISMO archivo. Esa auditoría pasó dos veces por
 * encima de este endpoint: el otro salteo es el `findFirst` sin scope de tenant de la línea
 * siguiente, que el mismo commit reemplazó por `findMany` en el OTP.
 *
 * POR QUÉ NO SE HABÍA NOTADO: `auth.test.ts:199` sólo ejercita el camino feliz (200), y **ningún
 * test del repo pasaba `NODE_ENV: 'production'`** — el estado apagado no lo miraba nadie.
 *
 * Test PURO: los dos casos devuelven 404 ANTES del `findFirst`, así que no toca la base.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

/**
 * El entorno mínimo para que `buildApp` levante, declarado acá y no heredado del runner: el
 * test tiene que valer igual corrido a mano que en CI. La URL apunta a un host que no escucha
 * a propósito — los cuatro casos devuelven 404 antes del `findFirst`, así que si alguno
 * intentara hablar con la base, fallaría acá en vez de pasar en silencio.
 */
const ENV_BASE = {
  DATABASE_URL: 'postgresql://nadie:nadie@127.0.0.1:1/nada',
  JWT_SECRET: 'esto-no-firma-nada-real-en-los-tests-de-t68',
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) await app.close();
  app = undefined;
});

const pegar = () => app!.inject({ method: 'POST', url: '/auth/demo' });

describe('T-68 — el atajo de la demo no existe en producción', () => {
  it('con DEMO_MODE prendido en producción, igual devuelve 404', async () => {
    app = await buildApp({ ...ENV_BASE, NODE_ENV: 'production', DEMO_MODE: 'true' });
    const r = await pegar();
    // Con el bug: 200 y un JWT de un inquilino REAL, sin ninguna prueba de identidad.
    expect(r.statusCode).toBe(404);
    // Y sobre todo: no volvió ningún token.
    expect(r.json().token).toBeUndefined();
  });

  it('con DEMO_MODE apagado sigue devolviendo 404 (el candado que ya estaba)', async () => {
    app = await buildApp({ ...ENV_BASE, NODE_ENV: 'production', DEMO_MODE: 'false' });
    expect((await pegar()).statusCode).toBe(404);
  });

  it('el candado de DEMO_MODE tampoco depende del entorno', async () => {
    app = await buildApp({ ...ENV_BASE, NODE_ENV: 'test', DEMO_MODE: 'false' });
    expect((await pegar()).statusCode).toBe(404);
  });

  it('los DOS candados son independientes: hace falta que fallen los dos para abrir', async () => {
    // Es la propiedad que hace que esto no se reabra por una sola env var mal puesta.
    for (const env of [
      { NODE_ENV: 'production' as const, DEMO_MODE: 'true' },
      { NODE_ENV: 'production' as const, DEMO_MODE: 'false' },
      { NODE_ENV: 'test' as const, DEMO_MODE: 'false' },
    ]) {
      app = await buildApp({ ...ENV_BASE, ...env });
      expect((await pegar()).statusCode, JSON.stringify(env)).toBe(404);
      await app.close();
      app = undefined;
    }
  });
});
