import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Primeros tests del expediente del contrato (`DocumentoContrato`).
 *
 * POR QUÉ AHORA. El alta de contrato pasó de subir dos fotos de DNI a subir N
 * papeles con `garanteIndex`, y el detalle calcula "cuántos faltan" sobre lo que
 * devuelve este GET. Nada de eso tenía un solo test.
 *
 * Lo que se fija:
 *  1. `garanteIndex` viaja, se guarda y VUELVE. Es lo único que distingue el DNI
 *     del garante 1 del garante 2 en todo el expediente: si se pierde en el
 *     camino, el checklist marca cargado lo que no está.
 *  2. La defensa de `archivoUrl` (`documentos.ts:102`). Es la única barrera
 *     entre "meto una URL a mano" y leer un archivo de otra inmobiliaria: el
 *     GET /uploads autoriza por el tenant del PATH, así que una fila con la URL
 *     ajena adentro sería una fuga real.
 *  3. `contratos.ver` LEE pero no ADJUNTA. Un LECTURA no escribe el expediente.
 */

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let tLECTURA = '';
let tidA = '';
let tidB = '';
let contratoB = '';
let usuarioLecturaId = '';
const creados: string[] = [];

const CONTRATO = 'cnt_001';
const EMAIL_LECTURA = 'zz-test-docs-lectura@delsol.com';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function login(email: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'delsol123' } });
  return r.json().token as string;
}

/** Body válido de punta a punta: cada test rompe UNA sola cosa a la vez. */
function payload(over: Record<string, unknown> = {}) {
  return {
    tipo: 'DNI_GARANTE_FRENTE',
    etiqueta: 'DNI garante · frente · Garante 2',
    garanteIndex: 2,
    nombreArchivo: 'dni-garante-2-frente.jpg',
    tipoMime: 'image/jpeg',
    tamanioBytes: 123456,
    archivoUrl: `/uploads/${tidA}/zz-test-doc.jpg`,
    ...over,
  };
}

const postDoc = (token: string, body: Record<string, unknown>, contratoId = CONTRATO) =>
  app.inject({ method: 'POST', url: `/contratos/${contratoId}/documentos`, headers: auth(token), payload: body });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tidA = inmo.id;

  const lectura = await prisma.usuario.upsert({
    where: { inmobiliariaId_email: { inmobiliariaId: tidA, email: EMAIL_LECTURA } },
    update: { rol: 'LECTURA', activo: true },
    create: {
      inmobiliariaId: tidA,
      email: EMAIL_LECTURA,
      nombre: 'Zz',
      apellido: 'Docs',
      rol: 'LECTURA',
      passwordHash: bcrypt.hashSync('delsol123', 10),
    },
  });
  usuarioLecturaId = lectura.id;

  // Tenant B con contrato propio: sin él, el "404 cross-tenant" se probaría con
  // un id inexistente y daría verde por el motivo equivocado.
  const inmoB = await prisma.inmobiliaria.create({
    data: {
      nombre: 'ZZ-TEST-DOCS-B',
      cuit: '30-99999902-2',
      email: 'zz-test-docs-b@example.com',
      telefono: '0',
      matricula: 'ZZ-TEST-DOC-MAT',
      direccionCalle: 'Calle B',
      direccionAltura: '2',
      direccionCiudad: 'CABA',
      direccionProvincia: 'CABA',
      direccionCp: '1000',
      codigoReferido: 'ZZ-TEST-DOC-REF-B',
    },
  });
  tidB = inmoB.id;
  const prpB = await prisma.propiedad.create({
    data: { inmobiliariaId: tidB, direccion: 'Calle B 200', ciudad: 'CABA', provincia: 'CABA', tipo: 'DEPARTAMENTO' },
  });
  const cB = await prisma.contrato.create({
    data: {
      inmobiliariaId: tidB,
      propiedadId: prpB.id,
      estado: 'ACTIVO',
      monto: 100000,
      moneda: 'ARS',
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2027-12-31'),
      diaPago: 5,
      indiceAjuste: 'FIJO',
      frecuenciaAjusteMeses: 12,
    },
  });
  contratoB = cB.id;

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tADMIN = await login('roberto@delsol.com');
  tLECTURA = await login(EMAIL_LECTURA);
});

afterAll(async () => {
  try {
    if (creados.length) await prisma.documentoContrato.deleteMany({ where: { id: { in: creados } } });
    if (contratoB) {
      const c = await prisma.contrato.findUnique({ where: { id: contratoB }, select: { propiedadId: true } });
      await prisma.documentoContrato.deleteMany({ where: { contratoId: contratoB } });
      await prisma.contrato.deleteMany({ where: { id: contratoB } });
      if (c) await prisma.propiedad.deleteMany({ where: { id: c.propiedadId } });
    }
    if (tidB) await prisma.inmobiliaria.deleteMany({ where: { id: tidB } });
    if (usuarioLecturaId) await prisma.usuario.deleteMany({ where: { id: usuarioLecturaId } });
  } catch {
    // el diagnóstico útil es el error del beforeAll, no el de esta limpieza
  }
  await app?.close();
  await prisma?.$disconnect();
});

describe('Expediente del contrato — POST con garanteIndex', () => {
  it('guarda el garanteIndex y lo devuelve en el GET', async () => {
    const r = await postDoc(tADMIN, payload());
    expect(r.statusCode).toBe(201);
    const doc = r.json();
    creados.push(doc.id);
    expect(doc.garanteIndex).toBe(2);

    // Contra la DB: que la respuesta lo tenga no prueba que se haya guardado.
    const fila = await prisma.documentoContrato.findUniqueOrThrow({ where: { id: doc.id } });
    expect(fila.garanteIndex).toBe(2);
    expect(fila.inmobiliariaId).toBe(tidA);

    const lista = await app.inject({
      method: 'GET',
      url: `/contratos/${CONTRATO}/documentos`,
      headers: auth(tADMIN),
    });
    expect(lista.statusCode).toBe(200);
    const enLista = (lista.json() as { id: string; garanteIndex: number | null }[]).find((d) => d.id === doc.id);
    expect(enLista?.garanteIndex, 'sin esto el garante 1 y el 2 son el mismo papel').toBe(2);
  });

  it('sin garanteIndex queda null (los papeles del titular no son de nadie)', async () => {
    const r = await postDoc(tADMIN, payload({ tipo: 'CONTRATO_FIRMADO', etiqueta: 'Contrato firmado', garanteIndex: undefined }));
    expect(r.statusCode).toBe(201);
    creados.push(r.json().id);
    expect(r.json().garanteIndex).toBeNull();
  });

  it('garanteIndex 0 → 400 (los índices son 1-based, como los manda el front)', async () => {
    const r = await postDoc(tADMIN, payload({ garanteIndex: 0 }));
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toBe('Datos inválidos');
  });
});

describe('Expediente del contrato — archivoUrl de otro tenant', () => {
  it('rechaza con 400 una URL del tenant vecino, y no crea la fila', async () => {
    const antes = await prisma.documentoContrato.count({ where: { contratoId: CONTRATO } });
    const r = await postDoc(tADMIN, payload({ archivoUrl: `/uploads/${tidB}/robado.jpg` }));
    expect(r.statusCode).toBe(400);
    // El mensaje distingue este rechazo del 400 de zod: si algún día el body
    // deja de validar por otra razón, este test no da verde por accidente.
    expect(r.json().message).toBe('archivoUrl inválido');
    const despues = await prisma.documentoContrato.count({ where: { contratoId: CONTRATO } });
    expect(despues).toBe(antes);
  });

  it('rechaza URLs que no son de /uploads o intentan salir del directorio', async () => {
    for (const url of [
      'https://evil.example.com/x.jpg',
      `/uploads/${tidA}/../${tidB}/x.jpg`,
      `/uploads/${tidA}/sub/dir/x.jpg`,
      '/uploads/x.jpg',
    ]) {
      const r = await postDoc(tADMIN, payload({ archivoUrl: url }));
      expect(r.statusCode, `archivoUrl ${url}`).toBe(400);
    }
  });

  it('acepta la URL propia (el caso feliz, para que el test de arriba signifique algo)', async () => {
    const r = await postDoc(tADMIN, payload({ archivoUrl: `/uploads/${tidA}/propio.jpg` }));
    expect(r.statusCode).toBe(201);
    creados.push(r.json().id);
  });
});

describe('Expediente del contrato — permisos y aislamiento', () => {
  it('un LECTURA (contratos.ver) LEE el expediente', async () => {
    const r = await app.inject({ method: 'GET', url: `/contratos/${CONTRATO}/documentos`, headers: auth(tLECTURA) });
    expect(r.statusCode).toBe(200);
    expect(Array.isArray(r.json())).toBe(true);
  });

  it('…pero NO puede adjuntar (contratos.crear) ni borrar', async () => {
    const p = await postDoc(tLECTURA, payload({ archivoUrl: `/uploads/${tidA}/lectura.jpg` }));
    expect(p.statusCode).toBe(403);
    const d = await app.inject({
      method: 'DELETE',
      url: `/contratos/${CONTRATO}/documentos/${creados[0]}`,
      headers: auth(tLECTURA),
    });
    expect(d.statusCode).toBe(403);
    // Y el documento sigue vivo: el 403 no puede ser "falló después de borrar".
    const vive = await prisma.documentoContrato.count({ where: { id: creados[0] } });
    expect(vive).toBe(1);
  });

  it('contrato de otra inmobiliaria → 404 en GET y en POST', async () => {
    const g = await app.inject({ method: 'GET', url: `/contratos/${contratoB}/documentos`, headers: auth(tADMIN) });
    expect(g.statusCode).toBe(404);
    const p = await postDoc(tADMIN, payload(), contratoB);
    expect(p.statusCode).toBe(404);
    const filas = await prisma.documentoContrato.count({ where: { contratoId: contratoB } });
    expect(filas).toBe(0);
  });

  it('sin token → 401', async () => {
    const r = await app.inject({ method: 'GET', url: `/contratos/${CONTRATO}/documentos` });
    expect(r.statusCode).toBe(401);
  });
});
