/**
 * El detalle del contrato decía quién lo cargó con un cuid.
 *
 * `Contrato.cargadoPor` guarda el **ID** del usuario. `GET /contratos/:id` lo devolvía tal cual,
 * y el panel lo imprime adentro de frases:
 *
 *   «Cargado por cmtj10jgm002bugz0o6y2kp8m · rechazado por el admin»
 *   «Contrato rechazado. cmtj10jgm002bugz0o6y2kp8m ya recibió la notificación.»
 *
 * El front ya esperaba un nombre —tiene el fallback `?? 'Usuario desconocido'`—: lo que faltaba
 * era resolverlo del lado del server. La función que lo hace existía desde antes, pero vivía
 * **privada** dentro de `operacion.ts`, así que el archivo que la necesitaba no la tenía. Ahora
 * es un módulo compartido y hay una sola forma de resolver un nombre.
 *
 * Salió del triage de los PRs de julio: estaba anotado en #44.
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
let tAdmin = '';
const prisma = new PrismaClient();
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

let contratoId = '';
let usuario: { id: string; nombre: string; apellido: string | null };

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  usuario = await prisma.usuario.findFirstOrThrow({
    where: { email: 'roberto@delsol.com' },
    select: { id: true, nombre: true, apellido: true },
  });
  const c = await prisma.contrato.findFirstOrThrow({ where: { id: 'cnt_001' }, select: { id: true } });
  contratoId = c.id;
  // El contrato del seed no trae `cargadoPor`: se lo ponemos, que es lo que hace el alta real.
  await prisma.contrato.update({ where: { id: contratoId }, data: { cargadoPor: usuario.id } });
});

afterAll(async () => {
  await prisma.contrato.update({ where: { id: contratoId }, data: { cargadoPor: null } });
  await app.close();
  await prisma.$disconnect();
});

const detalle = async () => {
  const r = await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: auth(tAdmin) });
  expect(r.statusCode).toBe(200);
  return r.json() as { cargadoPor: string | null };
};

describe('el contrato dice quién lo cargó por su nombre', () => {
  it('🔴 devuelve el NOMBRE, no el id', async () => {
    const c = await detalle();
    const esperado = `${usuario.nombre} ${usuario.apellido ?? ''}`.trim();
    expect(c.cargadoPor).toBe(esperado);
    // Con el bug: el cuid. Se afirma aparte porque es lo que se veía en pantalla.
    expect(c.cargadoPor).not.toBe(usuario.id);
  });

  it('un id que ya no existe no degrada la frase a un identificador ilegible', async () => {
    // Alguien que se dio de baja del equipo. Antes la pantalla decía «Cargado por cmtxxx…».
    await prisma.contrato.update({ where: { id: contratoId }, data: { cargadoPor: 'usuario-que-ya-no-esta' } });
    const c = await detalle();
    expect(c.cargadoPor).toBe('Panel');
    await prisma.contrato.update({ where: { id: contratoId }, data: { cargadoPor: usuario.id } });
  });

  it('un contrato sin `cargadoPor` sigue devolviendo null, y el front pone su propio texto', async () => {
    await prisma.contrato.update({ where: { id: contratoId }, data: { cargadoPor: null } });
    const c = await detalle();
    expect(c.cargadoPor).toBeNull();
    await prisma.contrato.update({ where: { id: contratoId }, data: { cargadoPor: usuario.id } });
  });
});
