import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Primeros tests del CRUD de servicios públicos por propiedad.
 *
 * POR QUÉ RECIÉN AHORA. `ServicioPublico` tiene CERO filas en producción: el
 * endpoint existe hace rato pero nunca corrió contra datos reales. "El código
 * está" no prueba nada acá — el alta de contrato ahora monta este panel en un
 * paso propio, así que por primera vez lo va a usar gente.
 *
 * Lo que se fija, en orden de riesgo:
 *  1. El PUT REEMPLAZA, no mergea. Es el comportamiento REAL y este test lo
 *     documenta, no lo corrige: mandar el body incompleto BORRA medidor,
 *     titular, observaciones y consumo. Quien escriba otra pantalla contra este
 *     endpoint tiene que enterarse acá y no en la base del cliente. Hoy la única
 *     pantalla que escribe está a salvo porque su diálogo PRECARGA todos los
 *     campos del servicio existente antes de guardar
 *     (`servicios-publicos-panel.tsx:231-235`) → el body sale completo. Es una
 *     salvaguarda del formulario, no del endpoint: una pantalla que solo edite
 *     un campo borra el resto sin avisar.
 *  2. `pagador` es la excepción: viaja `undefined` a Prisma y por eso se
 *     conserva. La asimetría con los otros cuatro campos es intencional
 *     (`servicios-publicos.ts:109`) y es exactamente el tipo de detalle que se
 *     rompe sin querer.
 *  3. Upsert por tipo: dos PUT al mismo tipo son una fila, no dos.
 *  4. Aislamiento por inmobiliaria y validación del tipo en la URL.
 */

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let tLECTURA = '';
let tidA = '';
let tidB = '';
/**
 * Propiedad propia de esta suite. NO usamos `prp_001`: el seed le carga LUZ, GAS,
 * AGUA y ABL (`prisma/seeds/inquilinoMundo.ts:79`), así que el test del upsert
 * arrancaría por el camino "update" y el del reemplazo a null pisaría datos que
 * otras suites esperan intactos.
 */
let propiedadA = '';
let propiedadB = '';
let usuarioLecturaId = '';

const EMAIL_LECTURA = 'zz-test-servicios-lectura@delsol.com';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function login(email: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'delsol123' } });
  return r.json().token as string;
}

const put = (url: string, token: string, payload: unknown) =>
  app.inject({ method: 'PUT', url, headers: auth(token), payload: payload as object });

const get = (url: string, token: string) => app.inject({ method: 'GET', url, headers: auth(token) });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tidA = inmo.id;

  // El seed no trae un LECTURA: lo necesitamos para probar que `propiedades.ver`
  // sin `propiedades.crear` lee pero no escribe.
  const lectura = await prisma.usuario.upsert({
    where: { inmobiliariaId_email: { inmobiliariaId: tidA, email: EMAIL_LECTURA } },
    update: { rol: 'LECTURA', activo: true },
    create: {
      inmobiliariaId: tidA,
      email: EMAIL_LECTURA,
      nombre: 'Zz',
      apellido: 'Lectura',
      rol: 'LECTURA',
      passwordHash: bcrypt.hashSync('delsol123', 10),
    },
  });
  usuarioLecturaId = lectura.id;

  const prpA = await prisma.propiedad.create({
    data: {
      inmobiliariaId: tidA,
      direccion: 'ZZ-TEST-SERVICIOS 100',
      ciudad: 'La Rioja',
      provincia: 'La Rioja',
      tipo: 'DEPARTAMENTO',
    },
  });
  propiedadA = prpA.id;

  // Tenant B con propiedad propia: el único modo honesto de probar el 404
  // cross-tenant (un id inexistente da 404 por razones equivocadas).
  const inmoB = await prisma.inmobiliaria.create({
    data: {
      nombre: 'ZZ-TEST-SERVICIOS-B',
      cuit: '30-99999901-1',
      email: 'zz-test-servicios-b@example.com',
      telefono: '0',
      matricula: 'ZZ-TEST-SRV-MAT',
      direccionCalle: 'Calle B',
      direccionAltura: '1',
      direccionCiudad: 'CABA',
      direccionProvincia: 'CABA',
      direccionCp: '1000',
      codigoReferido: 'ZZ-TEST-SRV-REF-B',
    },
  });
  tidB = inmoB.id;
  const prpB = await prisma.propiedad.create({
    data: {
      inmobiliariaId: tidB,
      direccion: 'Calle B 123',
      ciudad: 'CABA',
      provincia: 'CABA',
      tipo: 'DEPARTAMENTO',
    },
  });
  propiedadB = prpB.id;

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tADMIN = await login('roberto@delsol.com');
  tLECTURA = await login(EMAIL_LECTURA);
});

afterAll(async () => {
  try {
    // Sin esto la corrida siguiente arranca con la LUZ ya cargada y el test del
    // upsert pasaría por el camino "update" desde el principio.
    if (propiedadA) {
      await prisma.servicioPublico.deleteMany({ where: { propiedadId: propiedadA } });
      await prisma.propiedad.deleteMany({ where: { id: propiedadA } });
    }
    if (propiedadB) await prisma.servicioPublico.deleteMany({ where: { propiedadId: propiedadB } });
    if (propiedadB) await prisma.propiedad.deleteMany({ where: { id: propiedadB } });
    if (tidB) await prisma.inmobiliaria.deleteMany({ where: { id: tidB } });
    if (usuarioLecturaId) await prisma.usuario.deleteMany({ where: { id: usuarioLecturaId } });
  } catch {
    // el diagnóstico útil es el error del beforeAll, no el de esta limpieza
  }
  await app?.close();
  await prisma?.$disconnect();
});

const COMPLETO = {
  distribuidora: 'EDELAR',
  nis: '1234567',
  numeroMedidor: 'MED-99',
  titular: 'Mariela Sosa',
  observaciones: 'El medidor está en el pasillo.',
  consumoPromedioMensual: 3450.5,
  pagador: 'PROPIETARIO',
};

describe('Servicios públicos — upsert por tipo', () => {
  it('dos PUT al mismo tipo son UNA fila (no duplica)', async () => {
    const r1 = await put(`/propiedades/${propiedadA}/servicios/LUZ`, tADMIN, COMPLETO);
    expect(r1.statusCode).toBe(200);
    const id1 = r1.json().id as string;

    const r2 = await put(`/propiedades/${propiedadA}/servicios/LUZ`, tADMIN, {
      ...COMPLETO,
      distribuidora: 'EDENOR',
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().id, 'el segundo PUT tiene que editar la MISMA fila').toBe(id1);
    expect(r2.json().distribuidora).toBe('EDENOR');

    const lista = await get(`/propiedades/${propiedadA}/servicios`, tADMIN);
    expect(lista.statusCode).toBe(200);
    const luces = (lista.json() as { tipo: string }[]).filter((s) => s.tipo === 'LUZ');
    expect(luces.length, 'una sola fila de LUZ').toBe(1);

    // Y contra la DB, no solo contra lo que devuelve el endpoint.
    const filas = await prisma.servicioPublico.count({ where: { propiedadId: propiedadA, tipo: 'LUZ' } });
    expect(filas).toBe(1);
  });

  it('otro tipo es otra fila (la unique es (propiedad, tipo))', async () => {
    const r = await put(`/propiedades/${propiedadA}/servicios/AGUA`, tADMIN, {
      distribuidora: 'Aguas Riojanas',
      nis: '777',
    });
    expect(r.statusCode).toBe(200);
    const lista = await get(`/propiedades/${propiedadA}/servicios`, tADMIN);
    const tipos = (lista.json() as { tipo: string }[]).map((s) => s.tipo).sort();
    expect(tipos).toEqual(['AGUA', 'LUZ']);
  });
});

describe('Servicios públicos — el PUT REEMPLAZA, no mergea', () => {
  it('mandar solo distribuidora+nis borra medidor, titular, observaciones y consumo', async () => {
    // 1. Queda cargado completo.
    const completo = await put(`/propiedades/${propiedadA}/servicios/GAS`, tADMIN, COMPLETO);
    expect(completo.statusCode).toBe(200);
    const antes = completo.json();
    expect(antes.numeroMedidor).toBe('MED-99');
    expect(antes.titular).toBe('Mariela Sosa');
    expect(antes.observaciones).toBe('El medidor está en el pasillo.');
    expect(antes.consumoPromedioMensual).toBe(3450.5);

    // 2. Una pantalla que solo edita la distribuidora manda el body corto.
    const parcial = await put(`/propiedades/${propiedadA}/servicios/GAS`, tADMIN, {
      distribuidora: 'Ecogas',
      nis: '1234567',
    });
    expect(parcial.statusCode).toBe(200);

    // 3. Lo que NO vino se fue a null. Es el comportamiento real del endpoint
    //    (`servicios-publicos.ts:103-108`): documentado, no arreglado.
    const despues = parcial.json();
    expect(despues.distribuidora).toBe('Ecogas');
    expect(despues.numeroMedidor).toBeNull();
    expect(despues.titular).toBeNull();
    expect(despues.observaciones).toBeNull();
    expect(despues.consumoPromedioMensual).toBeNull();

    // 4. Y persistió así: no es un artefacto de la respuesta.
    const fila = await prisma.servicioPublico.findFirstOrThrow({
      where: { propiedadId: propiedadA, tipo: 'GAS' },
    });
    expect(fila.numeroMedidor).toBeNull();
    expect(fila.titular).toBeNull();
    expect(fila.observaciones).toBeNull();
    expect(fila.consumoPromedioMensual).toBeNull();
  });

  it('`pagador` es la excepción: con undefined se CONSERVA', async () => {
    // Se cargó con PROPIETARIO en el test anterior y el body corto no lo mandó.
    const fila = await prisma.servicioPublico.findFirstOrThrow({
      where: { propiedadId: propiedadA, tipo: 'GAS' },
    });
    expect(fila.pagador, 'undefined no se traduce a null: Prisma lo ignora en el update').toBe('PROPIETARIO');

    // Y sí se puede cambiar mandándolo.
    const r = await put(`/propiedades/${propiedadA}/servicios/GAS`, tADMIN, {
      distribuidora: 'Ecogas',
      nis: '1234567',
      pagador: 'EXPENSAS',
    });
    expect(r.json().pagador).toBe('EXPENSAS');
  });

  it('en el ALTA (create) el pagador ausente cae al default INQUILINO', async () => {
    const r = await put(`/propiedades/${propiedadA}/servicios/CABLE`, tADMIN, {
      distribuidora: 'Flow',
      nis: '999',
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().pagador).toBe('INQUILINO');
  });
});

describe('Servicios públicos — validación y aislamiento', () => {
  it('tipo de servicio inválido → 400 (y no toca la DB)', async () => {
    const r = await put(`/propiedades/${propiedadA}/servicios/PILETA`, tADMIN, {
      distribuidora: 'X',
      nis: '1',
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toBe('Tipo de servicio inválido');
  });

  it('body inválido (sin nis) → 400 con detalle', async () => {
    const r = await put(`/propiedades/${propiedadA}/servicios/INTERNET`, tADMIN, { distribuidora: 'Fibertel' });
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toBe('Datos inválidos');
    const existe = await prisma.servicioPublico.count({ where: { propiedadId: propiedadA, tipo: 'INTERNET' } });
    expect(existe).toBe(0);
  });

  it('propiedad de OTRA inmobiliaria → 404 en GET y en PUT', async () => {
    const g = await get(`/propiedades/${propiedadB}/servicios`, tADMIN);
    expect(g.statusCode).toBe(404);
    const p = await put(`/propiedades/${propiedadB}/servicios/LUZ`, tADMIN, { distribuidora: 'X', nis: '1' });
    expect(p.statusCode).toBe(404);
    // Y no escribió nada del otro lado (el 404 podría llegar DESPUÉS del write).
    const filas = await prisma.servicioPublico.count({ where: { propiedadId: propiedadB } });
    expect(filas).toBe(0);
  });

  it('sin token → 401', async () => {
    const r = await app.inject({ method: 'GET', url: `/propiedades/${propiedadA}/servicios` });
    expect(r.statusCode).toBe(401);
  });

  it('un LECTURA ve los servicios pero NO los puede escribir', async () => {
    const g = await get(`/propiedades/${propiedadA}/servicios`, tLECTURA);
    expect(g.statusCode, 'propiedades.ver la tiene LECTURA').toBe(200);
    const p = await put(`/propiedades/${propiedadA}/servicios/LUZ`, tLECTURA, { distribuidora: 'X', nis: '1' });
    expect(p.statusCode, 'propiedades.crear NO la tiene').toBe(403);
  });
});
