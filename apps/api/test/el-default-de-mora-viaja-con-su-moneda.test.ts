/**
 * TERCERA AUDITORÍA · El campo que se seleccionaba y no se devolvía.
 *
 * `GET /cobranza` ya hacía `select: { moraTipoDefault, moraValorDefault, monedaDefault }` — o
 * sea que alguien sabía que hacía falta— y armaba la respuesta con los dos primeros. El
 * tercero se quedaba en el server.
 *
 * Sin él el panel no podía aplicar la regla de T-58 (`resolverEsquemaMora`): un default
 * `MONTO_FIJO` sólo se hereda si la moneda coincide con la del contrato. El wizard de alta
 * heredaba igual, prefilleaba con esa tasa fantasma el `moraManual` de cada período vencido y
 * lo mandaba en el alta; el server lo persiste como `montoPunitorioManual` y `calcularMora`
 * lo respeta ANTES que su propio `SIN_MORA`. Quedaba deuda punitoria real y cobrable.
 *
 * La regla en sí ya está probada en `mora-cascada.test.ts`. Lo que este archivo prueba es lo
 * único que faltaba para poder aplicarla del otro lado: que el dato VIAJE.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): sacando `monedaDefault` del objeto
 * `mora` de la respuesta, los dos casos fallan.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
let inmobiliariaId = '';
// `string` y no `'ARS' | 'USD'`: `Inmobiliaria.monedaDefault` es String en el schema, no el
// enum `Moneda`. Tiparlo más angosto que la columna compila sólo hasta que alguien mira.
let monedaOriginal = 'ARS';

const cobranza = () => app.inject({ method: 'GET', url: '/cobranza', headers: { authorization: `Bearer ${token}` } });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  // ADMIN: /cobranza es ADMIN-only.
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  inmobiliariaId = inmo.id;
  monedaOriginal = inmo.monedaDefault;
});

afterAll(async () => {
  if (inmobiliariaId) {
    await prisma.inmobiliaria.update({ where: { id: inmobiliariaId }, data: { monedaDefault: monedaOriginal } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('el default de mora viaja con su moneda', () => {
  it('la respuesta trae monedaDefault', async () => {
    const r = await cobranza();
    expect(r.statusCode).toBe(200);
    // Con el bug: `mora` traía sólo tipoDefault y valorDefault.
    expect(r.json().mora).toHaveProperty('monedaDefault');
  });

  it('y es la del tenant, no un ARS fijo', async () => {
    await prisma.inmobiliaria.update({ where: { id: inmobiliariaId }, data: { monedaDefault: 'USD' } });
    expect((await cobranza()).json().mora.monedaDefault).toBe('USD');
    await prisma.inmobiliaria.update({ where: { id: inmobiliariaId }, data: { monedaDefault: 'ARS' } });
    expect((await cobranza()).json().mora.monedaDefault).toBe('ARS');
  });
});
