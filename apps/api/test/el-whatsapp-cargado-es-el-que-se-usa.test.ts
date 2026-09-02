/**
 * El número de WhatsApp que carga la inmobiliaria es el que el inquilino toca en la app.
 *
 * DE DÓNDE SALIÓ. De la segunda auditoría del 31/08, clase "un campo que se escribe y no lo lee
 * nadie".
 *
 * QUÉ PASABA. `Inmobiliaria.whatsapp` se persiste desde Configuración —el panel lo pide como un
 * campo más de "Contacto y presencia"— y su **único lector** era el `GET /empresa` que repinta
 * ese mismo formulario. Mientras tanto, la PWA arma **siete** links `wa.me` con
 * `inmobiliariaTelefono`, que salía de `Inmobiliaria.telefono`.
 *
 * EL ESCENARIO. La inmo carga Teléfono = "011 4631-5870" (el fijo de la oficina) y WhatsApp =
 * "11 5234-7891". Ve el toast "Datos de la empresa guardados". El inquilino toca el botón verde:
 * se abre `wa.me/541146315870`, un fijo sin WhatsApp. **El chat no existe y el mensaje nunca
 * llega.**
 *
 * POR QUÉ EL FALLBACK NO ES DE MÁS. Hay inmobiliarias que hoy tienen el celular cargado en
 * Teléfono y el campo WhatsApp vacío. Sin el fallback, a ésas se les rompe el botón que hoy les
 * funciona: el arreglo de una haría el defecto de la otra.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginDemoTest } from './_login.js';

const FIJO = '011 4631-5870';
const CELU = '11 5234-7891';

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
let inmobiliariaId = '';
let original: { telefono: string | null; whatsapp: string } | null = null;

/** Lo que la PWA usa para armar los `wa.me`. */
async function telefonoQueVeElInquilino(): Promise<string | null> {
  const r = await app.inject({
    method: 'GET',
    url: '/mi-contrato',
    headers: { authorization: `Bearer ${token}` },
  });
  expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
  return (r.json() as { inmobiliariaTelefono: string | null }).inmobiliariaTelefono;
}

const configurar = (telefono: string | null, whatsapp: string) =>
  prisma.inmobiliaria.update({ where: { id: inmobiliariaId }, data: { telefono: telefono ?? '', whatsapp } });

beforeAll(async () => {
  prisma = new PrismaClient();
  inmobiliariaId = (await seedBase(prisma)).inmobiliariaId;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginDemoTest(app);
  const i = await prisma.inmobiliaria.findUniqueOrThrow({
    where: { id: inmobiliariaId },
    select: { telefono: true, whatsapp: true },
  });
  original = { telefono: i.telefono, whatsapp: i.whatsapp };
});

afterAll(async () => {
  if (original) await configurar(original.telefono, original.whatsapp);
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('qué número le llega al inquilino', () => {
  it('🔴 con los dos cargados, manda el WHATSAPP — no el fijo de la oficina', async () => {
    await configurar(FIJO, CELU);
    expect(await telefonoQueVeElInquilino()).toBe(CELU);
  });

  it('sin WhatsApp cargado cae al teléfono: no se rompe a quien tiene el celular ahí', async () => {
    // El control que le da sentido al fallback. Sin él, el arreglo de una inmobiliaria sería el
    // defecto de la otra.
    await configurar(CELU, '');
    expect(await telefonoQueVeElInquilino()).toBe(CELU);
  });

  it('sin ninguno de los dos devuelve null, no una cadena vacía', async () => {
    // La PWA esconde el botón cuando esto es falsy. Una cadena vacía es falsy en JS, pero
    // devolver `null` es lo que el contrato del endpoint declara y lo que el front tipea.
    await configurar('', '');
    expect(await telefonoQueVeElInquilino()).toBeNull();
  });

  it('el WhatsApp gana aunque el teléfono también esté cargado y sea válido', async () => {
    // No es "el primero que no esté vacío" por casualidad: es una precedencia declarada.
    await configurar('11 1111-1111', '11 2222-2222');
    expect(await telefonoQueVeElInquilino()).toBe('11 2222-2222');
  });
});
