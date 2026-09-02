/**
 * CARGA maneja la garantía mientras el contrato se está armando; no después.
 *
 * ESTE ARCHIVO ME CORRIGE A MÍ. En T-11 declaré el PUT de garantes como excepción legítima en
 * `edicion-de-contrato-corta-carga.test.ts`, con este motivo: *"papelerío del alta, y el garante
 * no tiene login"*. Las dos mitades siguen siendo ciertas — pero la conclusión era media verdad,
 * porque no miraba el **estado del contrato**.
 *
 *   · sobre un BORRADOR, cargar y corregir la garantía ES el trabajo de CARGA, y encima queda
 *     sujeta a aprobación;
 *   · sobre un contrato VIGENTE es otra cosa. Y el PUT es peor que el DELETE: borrar deja el
 *     hueco visible ("Sin garante registrado"), mientras que reescribirle el DNI, el teléfono o
 *     el número de póliza al garante de un contrato en curso **no lo nota nadie**. El
 *     `deleteMany` es borrado duro y ninguno de los dos escribe en `EventoAuditoria`:
 *     desaparecida la garantía, no queda rastro de quién la sacó ni de qué decía antes.
 *
 * Lo encontró una barrida posterior, buscando el mismo patrón que la auditoría del 31/08 ya
 * había confirmado en otros endpoints. Que la excepción estuviera escrita CON SU MOTIVO es lo
 * que permitió releerla y ver que le faltaba una condición.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 'garv-';
let app: FastifyInstance;
let prisma: PrismaClient;
let tCarga = '';
let tAdmin = '';
let inmobiliariaId = '';
let contratoActivo = '';
let contratoBorrador = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const CUERPO = {
  tipo: 'CAUCION' as const,
  nombreProveedor: 'Aseguradora Test',
  contactoTelefono: '+54 11 4000 0000',
  numeroPoliza: 'POL-1',
};

async function limpiar(): Promise<void> {
  await prisma.garante.deleteMany({ where: { nombreProveedor: { startsWith: P } } });
}

/** Un garante propio colgado del contrato que se le pase. */
async function nuevoGarante(contratoId: string, sufijo: string): Promise<string> {
  const g = await prisma.garante.create({
    data: {
      inmobiliariaId,
      contratoId,
      tipo: 'CAUCION',
      nombreProveedor: `${P}${sufijo}`,
      contactoTelefono: '+54 11 4000 0001',
      numeroPoliza: 'POL-ORIGINAL',
    },
  });
  return g.id;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  inmobiliariaId = (await seedBase(prisma)).inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  tCarga = await loginTest(app, 'camila@delsol.com', 'delsol123');

  // 🔴 SCOPEADOS AL TENANT DEL SEED, y con orden fijo. Estaban sin `inmobiliariaId`: agarraban
  // CUALQUIER contrato de toda la base, incluidos los que dejan otros archivos de test. Los
  // casos pasaban sólo si la suite entera había corrido antes y en el orden justo; corridos
  // solos, el `findFirstOrThrow` encontraba un contrato de OTRA inmobiliaria y el endpoint
  // —que sí scopea— contestaba 404 «Contrato inexistente». Un test que depende de la basura
  // que dejó otro no está probando lo que dice.
  contratoActivo = (
    await prisma.contrato.findFirstOrThrow({
      where: { estado: 'ACTIVO', inmobiliariaId },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
  ).id;
  contratoBorrador = (
    await prisma.contrato.findFirstOrThrow({
      where: { estado: 'BORRADOR', inmobiliariaId },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
  ).id;
});

afterAll(async () => {
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('la garantía de un contrato vigente', () => {
  it('el escenario se armó: hay un contrato ACTIVO y uno BORRADOR', () => {
    expect(contratoActivo).not.toBe('');
    expect(contratoBorrador).not.toBe('');
    expect(contratoActivo).not.toBe(contratoBorrador);
  });

  it('CARGA sí maneja la garantía de un BORRADOR: es su trabajo, y va a aprobación', async () => {
    // El control positivo, y el que sostiene la mitad correcta de mi razonamiento anterior.
    const id = await nuevoGarante(contratoBorrador, 'borrador');
    const r = await app.inject({
      method: 'PUT',
      url: `/contratos/${contratoBorrador}/garantes/${id}`,
      headers: auth(tCarga),
      payload: { ...CUERPO, numeroPoliza: 'POL-CORREGIDA' },
    });
    expect(r.statusCode, r.body.slice(0, 250)).toBe(200);
    expect((await prisma.garante.findUniqueOrThrow({ where: { id } })).numeroPoliza).toBe('POL-CORREGIDA');
  });

  it('y también la borra, si el contrato sigue siendo borrador', async () => {
    const id = await nuevoGarante(contratoBorrador, 'borrador-borrar');
    const r = await app.inject({
      method: 'DELETE',
      url: `/contratos/${contratoBorrador}/garantes/${id}`,
      headers: auth(tCarga),
    });
    expect(r.statusCode, r.body.slice(0, 250)).toBe(200);
  });

  it('🔴 CARGA NO reescribe la garantía de un contrato VIGENTE', async () => {
    // El PUT es el peor de los dos: borrar deja el hueco visible, reescribir el número de
    // póliza no lo nota nadie.
    const id = await nuevoGarante(contratoActivo, 'activo-put');
    const r = await app.inject({
      method: 'PUT',
      url: `/contratos/${contratoActivo}/garantes/${id}`,
      headers: auth(tCarga),
      payload: { ...CUERPO, numeroPoliza: 'POL-REESCRITA' },
    });
    expect(r.statusCode).toBe(403);
    // Y no escribió igual: el número de póliza sigue siendo el original.
    expect((await prisma.garante.findUniqueOrThrow({ where: { id } })).numeroPoliza).toBe('POL-ORIGINAL');
  });

  it('🔴 ni la borra', async () => {
    const id = await nuevoGarante(contratoActivo, 'activo-delete');
    const r = await app.inject({
      method: 'DELETE',
      url: `/contratos/${contratoActivo}/garantes/${id}`,
      headers: auth(tCarga),
    });
    expect(r.statusCode).toBe(403);
    expect(await prisma.garante.count({ where: { id } })).toBe(1);
  });

  it('ADMIN sí puede las dos cosas sobre el contrato vigente', async () => {
    const id = await nuevoGarante(contratoActivo, 'admin');
    const put = await app.inject({
      method: 'PUT',
      url: `/contratos/${contratoActivo}/garantes/${id}`,
      headers: auth(tAdmin),
      payload: { ...CUERPO, numeroPoliza: 'POL-ADMIN' },
    });
    expect(put.statusCode, put.body.slice(0, 250)).toBe(200);
    const del = await app.inject({
      method: 'DELETE',
      url: `/contratos/${contratoActivo}/garantes/${id}`,
      headers: auth(tAdmin),
    });
    expect(del.statusCode, del.body.slice(0, 250)).toBe(200);
    expect(await prisma.garante.count({ where: { id } })).toBe(0);
  });

  it('un contrato que no existe da 404, no 403: el guard no cambia la respuesta de siempre', async () => {
    // Sin esto, el `findFirst` que agregué para leer el estado podría estar filtrando por
    // tenant de más o de menos y nadie se enteraría.
    const r = await app.inject({
      method: 'DELETE',
      url: `/contratos/no-existe/garantes/tampoco`,
      headers: auth(tAdmin),
    });
    expect(r.statusCode).toBe(404);
  });
});
