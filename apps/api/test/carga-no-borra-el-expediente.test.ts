/**
 * Un rol CARGA carga; no destruye. Los tres borrados que se habían quedado sin corte.
 *
 * DE DÓNDE SALIÓ. De una barrida sobre el patrón que confirmó la auditoría del 31/08: enumerar
 * TODOS los `app.delete` de la API y mirar cuáles destruyen algo sin cortar a CARGA, sabiendo
 * que no hay middleware — cada handler repite el corte a mano y por eso se olvidan de a uno.
 *
 * LA REGLA QUE LOS TRES COMPARTEN: **deshacer no pesa lo mismo que hacer.** `contratos.crear` y
 * `propiedades.crear` incluyen a CARGA porque CARGAR es su trabajo; los tres endpoints de acá
 * usan esa misma capacidad para BORRAR.
 *
 *   · el documento del expediente → saca la fila y hace unlink real del archivo en el Volume.
 *     Ahí caen el contrato firmado, el pagaré, el convenio de desocupación, el seguro de caución
 *     y los DNI de los garantes. Sin papelera y sin rastro. (El otro DELETE del panel que toca
 *     el Volume exige `caja.eliminar` —sólo ADMIN—, PIN y evento de auditoría.)
 *   · el co-inquilino → borrado duro que le saca el acceso a la PWA a alguien con permiso PAGAR:
 *     justo el que informa los pagos.
 *   · el servicio de la propiedad → se va el NIS, el medidor y el `pagador`, que es lo que el
 *     inquilino lee en su app para saber a qué cuenta paga la luz. Asimetría clara: borrar la
 *     propiedad ENTERA sí estaba gateado, y ese DELETE arrastra este mismo `deleteMany`.
 *
 * LO QUE NO SE CORTA, Y ES A PROPÓSITO: el POST de co-inquilinos y el PUT/upsert de servicios.
 * Sumar un co-inquilino y corregir un NIS son literalmente el trabajo del rol.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 'cnbe-';
let app: FastifyInstance;
let prisma: PrismaClient;
let tCarga = '';
let tAdmin = '';
let inmobiliariaId = '';
let contratoId = '';
let propiedadId = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar(): Promise<void> {
  await prisma.documentoContrato.deleteMany({ where: { etiqueta: { startsWith: P } } });
  await prisma.coInquilino.deleteMany({ where: { email: { startsWith: P } } });
  if (propiedadId) await prisma.servicioPublico.deleteMany({ where: { propiedadId, tipo: 'AGUA' } });
}

/** Un documento propio en el expediente del contrato. */
async function nuevoDocumento(nombre: string): Promise<string> {
  const d = await prisma.documentoContrato.create({
    data: {
      inmobiliariaId,
      contratoId,
      tipo: 'CONTRATO_FIRMADO',
      etiqueta: `${P}${nombre}`,
      nombreArchivo: `${P}${nombre}.pdf`,
      tipoMime: 'application/pdf',
      tamanioBytes: 1024,
      archivoUrl: `/uploads/${inmobiliariaId}/${P}${nombre}.pdf`,
      subidoPor: 'test',
    },
  });
  return d.id;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  inmobiliariaId = (await seedBase(prisma)).inmobiliariaId;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  // `camila@delsol.com` es el usuario CARGA del seed.
  tCarga = await loginTest(app, 'camila@delsol.com', 'delsol123');

  const c = await prisma.contrato.findFirstOrThrow({
    where: { estado: 'ACTIVO' },
    select: { id: true, propiedadId: true },
  });
  contratoId = c.id;
  propiedadId = c.propiedadId;
  await limpiar();
});

afterAll(async () => {
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CARGA no destruye lo que sí puede cargar', () => {
  it('el escenario se armó', () => {
    expect(tCarga).not.toBe('');
    expect(contratoId).not.toBe('');
  });

  it('🔴 CARGA no borra un documento del expediente', async () => {
    const id = await nuevoDocumento('contrato-firmado');
    const r = await app.inject({
      method: 'DELETE',
      url: `/contratos/${contratoId}/documentos/${id}`,
      headers: auth(tCarga),
    });
    expect(r.statusCode).toBe(403);
    // Y el archivo sigue en el expediente: un 403 que igual borra sería peor que no tener guard.
    expect(await prisma.documentoContrato.count({ where: { id } })).toBe(1);
  });

  it('ADMIN sí lo borra: el endpoint sigue sirviendo', async () => {
    const id = await nuevoDocumento('para-borrar');
    const r = await app.inject({
      method: 'DELETE',
      url: `/contratos/${contratoId}/documentos/${id}`,
      headers: auth(tAdmin),
    });
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
    expect(await prisma.documentoContrato.count({ where: { id } })).toBe(0);
  });

  it('🔴 CARGA no saca a un co-inquilino del contrato', async () => {
    const co = await prisma.coInquilino.create({
      data: {
        inmobiliariaId,
        contratoId,
        nombre: 'Co Inquilino',
        email: `${P}co@example.com`,
        relacion: 'Pareja',
        permiso: 'PAGAR',
      },
    });
    const r = await app.inject({
      method: 'DELETE',
      url: `/contratos/${contratoId}/co-inquilinos/${co.id}`,
      headers: auth(tCarga),
    });
    expect(r.statusCode).toBe(403);
    expect(await prisma.coInquilino.count({ where: { id: co.id } })).toBe(1);
  });

  it('pero CARGA sí puede SUMAR un co-inquilino: invitar es carga, revocar no', async () => {
    // El control que le da sentido al de arriba. Si el POST también cortara, el rol no podría
    // hacer su trabajo y el arreglo estaría de más.
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${contratoId}/co-inquilinos`,
      headers: auth(tCarga),
      payload: { nombre: 'Sumado PorCamila', email: `${P}sumado@example.com`, relacion: 'Familiar', permiso: 'VER' },
    });
    expect(r.statusCode, r.body.slice(0, 250)).toBeLessThan(300);
  });

  it('🔴 CARGA no borra el servicio de una propiedad', async () => {
    await prisma.servicioPublico.deleteMany({ where: { propiedadId, tipo: 'AGUA' } });
    await prisma.servicioPublico.create({
      data: { inmobiliariaId, propiedadId, tipo: 'AGUA', distribuidora: 'AySA', nis: '12345' },
    });
    const r = await app.inject({
      method: 'DELETE',
      url: `/propiedades/${propiedadId}/servicios/AGUA`,
      headers: auth(tCarga),
    });
    expect(r.statusCode).toBe(403);
    expect(await prisma.servicioPublico.count({ where: { propiedadId, tipo: 'AGUA' } })).toBe(1);
  });

  it('pero CARGA sí puede CARGAR el servicio: el NIS es su trabajo', async () => {
    // El otro control positivo. El upsert queda abierto a propósito.
    const r = await app.inject({
      method: 'PUT',
      url: `/propiedades/${propiedadId}/servicios/AGUA`,
      headers: auth(tCarga),
      payload: { distribuidora: 'AySA', nis: '99999' },
    });
    expect(r.statusCode, r.body.slice(0, 250)).toBeLessThan(300);
    expect((await prisma.servicioPublico.findFirstOrThrow({ where: { propiedadId, tipo: 'AGUA' } })).nis).toBe('99999');
  });

  it('ADMIN sí borra el servicio', async () => {
    const r = await app.inject({
      method: 'DELETE',
      url: `/propiedades/${propiedadId}/servicios/AGUA`,
      headers: auth(tAdmin),
    });
    expect(r.statusCode, r.body.slice(0, 200)).toBeLessThan(300);
    expect(await prisma.servicioPublico.count({ where: { propiedadId, tipo: 'AGUA' } })).toBe(0);
  });
});
