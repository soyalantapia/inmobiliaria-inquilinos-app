import { expect } from 'vitest';
import type { FastifyInstance } from 'fastify';

/**
 * Loguearse en los tests y **fallar fuerte si no salió un token**.
 *
 * POR QUÉ EXISTE. Los archivos de test hacen esto en su `beforeAll`:
 *
 *     const login = await app.inject({ method: 'POST', url: '/auth/login', payload: {...} });
 *     token = login.json().token;
 *
 * Si ese login no devuelve 200 —429 por el rate limit de `/auth/login` (30 en 15 minutos),
 * una base a medio sembrar, un usuario que otro archivo dejó inactivo— `token` queda
 * `undefined`, cada request manda `Bearer undefined` y **todos los casos del archivo fallan con
 * 401**. El síntoma aparece lejos de la causa: se leen siete `expected 401 to be 200` que
 * parecen un problema de permisos y no lo son.
 *
 * Pasó de verdad, en la primera corrida completa de los 125 archivos (T-28-N2-N1):
 * `ecosistema-profesionales.test.ts` dio 7 rojos así, y **pasaba 7/7 corriendo solo**. Tardó
 * 116s cuando en aislamiento tarda 15s, o sea que el login se cayó bajo carga. Perseguir eso
 * costó una bisección entera; con esta función el mensaje habría dicho qué pasaba en el primer
 * renglón.
 *
 * NO reintenta a propósito: un login que falla es una señal, y taparla con reintentos
 * convertiría un suite frágil en uno lento que igual miente.
 */
export async function loginTest(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
  expect(
    res.statusCode,
    `El login de ${email} devolvió ${res.statusCode} en vez de 200. Si es 429 es el rate limit ` +
      `de /auth/login (30 en 15 min); si es 401, alguien dejó ese usuario inactivo o con otra ` +
      `contraseña. Sin token, TODO este archivo va a fallar con 401 y el error va a parecer de ` +
      `permisos. Cuerpo: ${res.body.slice(0, 200)}`,
  ).toBe(200);

  const token = res.json().token as string | undefined;
  expect(token, `El login de ${email} devolvió 200 pero sin token.`).toBeTruthy();
  return token!;
}

/**
 * Lo mismo para `POST /auth/demo`, que es como entran los tests del lado inquilino.
 *
 * Falla igual de mudo y por dos motivos propios: devuelve **404** si `DEMO_MODE` está apagado y
 * **500** si la base no tiene sembrado al inquilino demo. Las dos cosas dejan `token` en
 * `undefined` y convierten el archivo entero en una tanda de 401 que no dice nada.
 */
export async function loginDemoTest(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/auth/demo' });
  expect(
    res.statusCode,
    `POST /auth/demo devolvió ${res.statusCode} en vez de 200. 404 = DEMO_MODE apagado; ` +
      `500 = falta el inquilino demo en la base (¿corrió seedBase?). Sin token, todo este ` +
      `archivo va a fallar con 401. Cuerpo: ${res.body.slice(0, 200)}`,
  ).toBe(200);

  const token = res.json().token as string | undefined;
  expect(token, 'POST /auth/demo devolvió 200 pero sin token.').toBeTruthy();
  return token!;
}
