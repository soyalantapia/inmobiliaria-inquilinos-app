/**
 * `POST /contratos` rechaza un SOLO_EXPENSAS con monto de alquiler. Sin este archivo, nada lo
 * sostenía.
 *
 * DE DÓNDE SALE. Camila lo planteó el 03/08 `[30:04]`: hay unidades que **no pagan alquiler** —el
 * canon lo arregla el propietario por fuera y la inmobiliaria sólo administra el consorcio—. El
 * alta ya frenaba el caso obvio (`monto: 0` con un contrato de alquiler), pero la validación era
 * **asimétrica**: un `{ tipoContrato: 'SOLO_EXPENSAS', monto: 500000 }` pasaba y se persistía tal
 * cual, y a partir de ahí el contrato devengaba alquiler todos los meses estando marcado como de
 * solo expensas. El freno se agregó; el test que lo cuida, no.
 *
 * POR QUÉ IMPORTA QUE ESTÉ. Es un guard sin red: si un refactor del zod o un reordenamiento de
 * las validaciones del alta lo saca, nada avisa — y el defecto que vuelve es **facturarle
 * alquiler a alguien que no paga alquiler**, que es exactamente lo que la tarea vino a evitar.
 * Los tests que ya nombran SOLO_EXPENSAS son del devengo o de la renovación, y el único que da
 * de alta uno lo hace con `monto: 0`, o sea el caso bueno.
 *
 * EL CASO QUE COMPRA EL LUGAR DEL CHEQUEO es el de CARGA: el freno está ANTES de la bifurcación
 * borrador/activación, así que también tapa el alta que queda pendiente de aprobación. Moverlo
 * adentro de la rama que activa dejaría entrar el dato malo por la otra puerta.
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
let tCarga = '';
const prisma = new PrismaClient();

const P = 'ZZ-solexp-';

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  tCarga = await loginTest(app, 'camila@delsol.com', 'delsol123');
  await limpiar();
});

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

async function limpiar(): Promise<void> {
  const props = await prisma.propiedad.findMany({
    where: { direccion: { startsWith: P } },
    select: { id: true },
  });
  const ids = props.map((x) => x.id);
  if (ids.length) {
    const cnts = await prisma.contrato.findMany({ where: { propiedadId: { in: ids } }, select: { id: true } });
    const cids = cnts.map((c) => c.id);
    if (cids.length) {
      // Orden por FK, y el mismo que usan los demás altas de esta suite. `eventoContrato` es el
      // que sorprende: el alta escribe uno y su constraint frena el borrado del contrato.
      await prisma.liquidacion.deleteMany({ where: { contratoId: { in: cids } } });
      await prisma.eventoContrato.deleteMany({ where: { contratoId: { in: cids } } });
      await prisma.movimientoFeed.deleteMany({ where: { contratoId: { in: cids } } });
      await prisma.aprobacion.deleteMany({ where: { entidadId: { in: cids } } });
      await prisma.inquilino.updateMany({ where: { contratoId: { in: cids } }, data: { contratoId: null } });
    }
    await prisma.propiedad.updateMany({ where: { id: { in: ids } }, data: { contratoActualId: null } });
    if (cids.length) await prisma.contrato.deleteMany({ where: { id: { in: cids } } });
    await prisma.participacionPropietario.deleteMany({ where: { propiedadId: { in: ids } } });
    await prisma.propiedad.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.inquilino.deleteMany({ where: { nombre: { startsWith: P } } });
}

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

/** Una propiedad libre por caso: el alta la ocupa y la siguiente no la podría usar. */
async function propiedadLibre(sufijo: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/propiedades',
    headers: auth(tAdmin),
    payload: {
      direccion: `${P}${sufijo}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
    },
  });
  expect(res.statusCode, `crear propiedad ${sufijo}: ${res.body}`).toBeLessThan(300);
  return res.json().id as string;
}

/** El payload mínimo que el alta acepta, con lo que cada caso quiera pisar. */
function alta(propiedadId: string, sufijo: string, extra: Record<string, unknown>) {
  return {
    propiedadId,
    inquilino: { nombre: `${P}${sufijo}` },
    fechaInicio: '2026-01-01',
    fechaFin: '2028-01-01',
    diaPago: 10,
    indiceAjuste: 'ICL',
    frecuenciaAjusteMeses: 12,
    ...extra,
  };
}

const contarContratos = () =>
  prisma.contrato.count({ where: { propiedad: { direccion: { startsWith: P } } } });

describe('el alta no le pone alquiler a un contrato de solo expensas', () => {
  it('🔴 SOLO_EXPENSAS con monto > 0 → 400, y no queda nada persistido', async () => {
    const propiedadId = await propiedadLibre('rechazo');
    const antes = await contarContratos();

    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(tAdmin),
      payload: alta(propiedadId, 'rechazo', {
        tipoContrato: 'SOLO_EXPENSAS',
        monto: 500_000,
        montoExpensas: 90_000,
      }),
    });

    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().message).toContain('solo expensas');
    // Lo que de verdad importa: que no se haya guardado a medias. Un 400 con el contrato
    // adentro sería peor que el bug original.
    expect(await contarContratos()).toBe(antes);
  });

  it('🔴 y tampoco entra por la puerta de CARGA, que queda pendiente de aprobación', async () => {
    // El freno vive ANTES de la bifurcación borrador/activación. Este caso es el que impide
    // que alguien lo mueva adentro de la rama que activa: ahí el dato malo entraría igual,
    // esperando aprobación, y el que aprueba ve un contrato que dice «solo expensas» con un
    // alquiler adentro.
    const propiedadId = await propiedadLibre('carga');
    const antes = await contarContratos();

    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(tCarga),
      payload: alta(propiedadId, 'carga', {
        tipoContrato: 'SOLO_EXPENSAS',
        monto: 320_000,
        montoExpensas: 75_000,
      }),
    });

    expect(res.statusCode, res.body).toBe(400);
    expect(await contarContratos()).toBe(antes);
  });

  it('CONTROL POSITIVO — el mismo alta con monto 0 sí entra, y queda en 0', async () => {
    // Sin esto, el test pasaría igual si alguien rompiera el alta entera de SOLO_EXPENSAS.
    const propiedadId = await propiedadLibre('ok');
    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(tAdmin),
      payload: alta(propiedadId, 'ok', { tipoContrato: 'SOLO_EXPENSAS', monto: 0, montoExpensas: 90_000 }),
    });
    expect(res.statusCode, res.body).toBeLessThan(300);

    const c = await prisma.contrato.findUniqueOrThrow({
      where: { id: res.json().id as string },
      select: { monto: true, tipoContrato: true, montoExpensas: true },
    });
    expect(c.tipoContrato).toBe('SOLO_EXPENSAS');
    expect(Number(c.monto)).toBe(0);
    expect(Number(c.montoExpensas)).toBe(90_000);
  });

  it('el chequeo asimétrico de al lado sigue vivo: ALQUILER con monto 0 → 400', async () => {
    // Los dos frenos son la misma regla mirada de los dos lados, y viven pegados. Si alguien
    // «simplifica» el par, este caso avisa que se llevó puesto el otro.
    const propiedadId = await propiedadLibre('inverso');
    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(tAdmin),
      payload: alta(propiedadId, 'inverso', { tipoContrato: 'ALQUILER', monto: 0 }),
    });
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().message).toContain('mayor a cero');
  });
});
