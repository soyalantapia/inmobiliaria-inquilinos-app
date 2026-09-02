/**
 * Un rol CARGA no puede redirigir la plata de una propiedad a una cuenta que él eligió.
 *
 * DE DÓNDE SALIÓ. De la auditoría por clases de defecto del 31/08 (ver
 * `work-agent/AUDITORIA-2026-08-31.md`), buscando la misma forma que T-11: un endpoint cuya
 * capacidad deja pasar a un rol que no debería poder hacer lo que ese endpoint realmente hace.
 *
 * LA CADENA, QUE ES LO QUE IMPORTA. No era un endpoint flojo, eran dos que se encadenaban:
 *
 *   1. `POST /propietarios` acepta `cbuAlias` y no cortaba a CARGA. Y a diferencia del alta de
 *      contrato, `propietarios.crear` NO tiene `rolesAprobacion`: lo que CARGA da de alta acá no
 *      lo revisa nadie.
 *   2. `PUT /propiedades/:id/participaciones` no cambia porcentajes: hace `deleteMany` +
 *      `createMany` del set completo, o sea REEMPLAZA A LOS DUEÑOS. Tampoco cortaba a CARGA.
 *
 * Encadenados: CARGA crea un propietario con el CBU que quiera y le pasa el 100% de una
 * propiedad ajena. La próxima rendición transfiere ahí. Agravante: CARGA no tiene `pagos.ver`,
 * así que movía plata que su propio rol le niega mirar.
 *
 * POR ESO EL ÚLTIMO CASO ES LA CADENA ENTERA, no dos 403 sueltos: probar cada eslabón por
 * separado no dice que la cadena esté cortada, y es la cadena la que mueve la plata.
 *
 * EL PRECEDENTE. Los hermanos destructivos de esos dos endpoints ya cortaban: el DELETE de
 * propiedades, y el DELETE y el PUT de propietarios. Este último tiene el razonamiento escrito
 * —"`cbuAlias` es el DESTINO de la rendición"— y esa misma lógica nunca había llegado ni al
 * reparto ni al alta.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 'cnrp-';
let app: FastifyInstance;
let prisma: PrismaClient;
let tokenCarga = '';
let tokenAdmin = '';
let inmobiliariaId = '';
let propiedadId = '';
let duenioLegitimo = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar(): Promise<void> {
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: `${P}prop` } });
  await prisma.propiedad.deleteMany({ where: { id: `${P}prop` } });
  await prisma.propietario.deleteMany({ where: { id: { in: [`${P}own`] } } });
  // El propietario que el ataque intenta crear: se borra por email para no dejar residuo si
  // alguna corrida lo logró (que es justamente lo que este archivo tiene que impedir).
  await prisma.propietario.deleteMany({ where: { email: `${P}intruso@example.com` } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  inmobiliariaId = (await seedBase(prisma)).inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tokenAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  // `camila@delsol.com` es el usuario CARGA del seed.
  tokenCarga = await loginTest(app, 'camila@delsol.com', 'delsol123');

  await prisma.propiedad.create({
    data: {
      id: `${P}prop`,
      inmobiliariaId,
      direccion: 'Reparto 100',
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
    },
  });
  const own = await prisma.propietario.create({
    data: {
      id: `${P}own`,
      inmobiliariaId,
      nombre: 'Dueña',
      apellido: 'Legitima',
      cuit: '27-00000022-7',
      email: `${P}legitima@example.com`,
      telefono: '+54 9 11 7000 0000',
      cbuAlias: 'la.legitima.cbu',
    },
  });
  duenioLegitimo = own.id;
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: `${P}prop`, propietarioId: duenioLegitimo, porcentaje: 100 },
  });
});

afterAll(async () => {
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CARGA no redirige la plata de una propiedad', () => {
  it('el escenario se armó: hay un CARGA, un ADMIN y una propiedad con dueña', async () => {
    expect(tokenCarga).not.toBe('');
    expect(tokenAdmin).not.toBe('');
    expect(await prisma.participacionPropietario.count({ where: { propiedadId: `${P}prop` } })).toBe(1);
  });

  it('CARGA sí puede dar de alta un propietario: es literalmente su trabajo', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/propietarios',
      headers: auth(tokenCarga),
      payload: {
        nombre: 'Cargado',
        apellido: 'PorCamila',
        email: `${P}ficha@example.com`,
        telefono: '+54 9 11 7000 0001',
        cuit: '20-00000023-1',
      },
    });
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
    await prisma.propietario.deleteMany({ where: { email: `${P}ficha@example.com` } });
  });

  it('🔴 CARGA NO puede darlo de alta con CBU: eso es a dónde va la rendición', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/propietarios',
      headers: auth(tokenCarga),
      payload: {
        nombre: 'Intruso',
        apellido: 'ConCbu',
        email: `${P}intruso@example.com`,
        telefono: '+54 9 11 7000 0002',
        cbuAlias: 'la.cuenta.del.intruso',
      },
    });
    expect(r.statusCode).toBe(403);
    // Y no lo creó igual: un 403 que persiste sería peor que no tener el guard.
    expect(await prisma.propietario.count({ where: { email: `${P}intruso@example.com` } })).toBe(0);
  });

  it('🔴 CARGA tampoco puede fijar la comisión, que es cuánto se queda la inmobiliaria', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/propietarios',
      headers: auth(tokenCarga),
      payload: { nombre: 'Otro', apellido: 'ConComision', telefono: '+54 9 11 7000 0003', comisionPct: 0 },
    });
    expect(r.statusCode).toBe(403);
  });

  it('🔴 CARGA NO puede reescribir el reparto de una propiedad', async () => {
    const r = await app.inject({
      method: 'PUT',
      url: `/propiedades/${propiedadId || `${P}prop`}/participaciones`,
      headers: auth(tokenCarga),
      payload: { participaciones: [{ propietarioId: duenioLegitimo, porcentaje: 100 }] },
    });
    expect(r.statusCode).toBe(403);
  });

  it('ADMIN sí puede las tres cosas: el guard no rompe la operación normal', async () => {
    // El control positivo. Sin esto, un guard que devolviera 403 a todos pasaría los casos de
    // arriba y dejaría la cartera imposible de cargar.
    const alta = await app.inject({
      method: 'POST',
      url: '/propietarios',
      headers: auth(tokenAdmin),
      payload: {
        nombre: 'Segundo',
        apellido: 'Duenio',
        email: `${P}segundo@example.com`,
        telefono: '+54 9 11 7000 0004',
        cbuAlias: 'el.segundo.cbu',
        comisionPct: 5,
      },
    });
    expect(alta.statusCode, alta.body.slice(0, 200)).toBe(200);
    const segundo = (alta.json() as { id: string }).id;

    const reparto = await app.inject({
      method: 'PUT',
      url: `/propiedades/${P}prop/participaciones`,
      headers: auth(tokenAdmin),
      payload: {
        participaciones: [
          { propietarioId: duenioLegitimo, porcentaje: 60 },
          { propietarioId: segundo, porcentaje: 40 },
        ],
      },
    });
    expect(reparto.statusCode, reparto.body.slice(0, 250)).toBe(200);
    expect(await prisma.participacionPropietario.count({ where: { propiedadId: `${P}prop` } })).toBe(2);

    // Se deja como estaba para no ensuciar la base compartida.
    await app.inject({
      method: 'PUT',
      url: `/propiedades/${P}prop/participaciones`,
      headers: auth(tokenAdmin),
      payload: { participaciones: [{ propietarioId: duenioLegitimo, porcentaje: 100 }] },
    });
    await prisma.propietario.deleteMany({ where: { id: segundo } });
  });

  it('🔴 LA CADENA ENTERA: CARGA no puede quedarse con la plata de la propiedad', async () => {
    // Probar cada eslabón por separado no dice que la cadena esté cortada. Este caso la corre
    // completa, como la correría alguien de verdad.
    const alta = await app.inject({
      method: 'POST',
      url: '/propietarios',
      headers: auth(tokenCarga),
      payload: {
        nombre: 'Intruso',
        apellido: 'Cadena',
        email: `${P}intruso@example.com`,
        telefono: '+54 9 11 7000 0005',
        cbuAlias: 'la.cuenta.del.intruso',
      },
    });
    expect(alta.statusCode, 'el paso 1 de la cadena tiene que cortar').toBe(403);

    // Aun suponiendo que consiguiera el propietario por otro camino, el paso 2 también corta.
    const reparto = await app.inject({
      method: 'PUT',
      url: `/propiedades/${P}prop/participaciones`,
      headers: auth(tokenCarga),
      payload: { participaciones: [{ propietarioId: duenioLegitimo, porcentaje: 100 }] },
    });
    expect(reparto.statusCode, 'el paso 2 de la cadena tiene que cortar').toBe(403);

    // Y lo que de verdad importa: la dueña legítima sigue teniendo el 100%.
    const partes = await prisma.participacionPropietario.findMany({ where: { propiedadId: `${P}prop` } });
    expect(partes).toHaveLength(1);
    expect(partes[0]!.propietarioId).toBe(duenioLegitimo);
    expect(partes[0]!.porcentaje).toBe(100);
  });
});
