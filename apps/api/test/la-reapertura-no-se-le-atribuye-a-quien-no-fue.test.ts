/**
 * CUARTA AUDITORÍA · «Reportaste que sigue» para alguien que no reportó nada.
 *
 * EL DEFECTO. La pantalla del reclamo del inquilino tenía dos cards que leían el RASTRO de un
 * cierre anterior como si fuera el estado de hoy:
 *
 *  1. La ámbar «Reportaste que sigue» se mostraba con `estado === 'EN_CURSO' && !!resolucion`,
 *     apoyada en un comentario que decía que en prod esa combinación sólo puede venir del
 *     PERSISTE del inquilino. Era cierto hasta que se agregó `POST /reclamos/:id/reabrir`
 *     (T-63, para corregir un monto mal tipeado). Desde entonces, cuando **la inmobiliaria**
 *     reabría un reclamo, al inquilino se le decía que él había reportado que el problema
 *     seguía. Una acción atribuida a alguien que no la hizo.
 *
 *  2. La verde «Resuelto · confirmado por vos» se mostraba con `decisionActual === 'CONFORME'`
 *     sin mirar el estado. La fila `ConfirmacionReclamo` es one-shot y **nadie la borra**, y
 *     `/reabrir` acepta CERRADO — así que después de reabrir quedaban las DOS cards juntas:
 *     "resuelto, confirmado por vos" arriba y "reportaste que sigue" abajo.
 *
 * ESTOS CASOS son la punta a punta: manejan los endpoints de verdad y miran lo que `/mis-reclamos`
 * le manda a la app. La tabla de decisión fina —incluido el orden de los eventos— está en el
 * test puro `quien-reabrio-el-reclamo.test.ts`, que corre sin base.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest, loginDemoTest } from './_login.js';

let app: FastifyInstance;
let tAdmin = '';
let tInquilino = '';
const prisma = new PrismaClient();
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const PREFIJO = 'QA quien reabrio';
let contrato: { id: string; inmobiliariaId: string; propiedadId: string | null };

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  tInquilino = await loginDemoTest(app);
  // El contrato del inquilino demo: es el que `/mis-reclamos` va a devolver.
  const inq = await prisma.inquilino.findFirstOrThrow({
    where: { email: 'mariela.sosa@gmail.com' },
    select: { contratoId: true },
  });
  contrato = await prisma.contrato.findUniqueOrThrow({
    where: { id: inq.contratoId! },
    select: { id: true, inmobiliariaId: true, propiedadId: true },
  });
}, 420_000);

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

async function limpiar(): Promise<void> {
  const ids = (
    await prisma.reclamo.findMany({ where: { descripcion: { startsWith: PREFIJO } }, select: { id: true } })
  ).map((r) => r.id);
  if (!ids.length) return;
  await prisma.reclamoEvento.deleteMany({ where: { reclamoId: { in: ids } } });
  await prisma.confirmacionReclamo.deleteMany({ where: { reclamoId: { in: ids } } });
  await prisma.cargoContrato.deleteMany({ where: { reclamoId: { in: ids } } });
  await prisma.reclamo.deleteMany({ where: { id: { in: ids } } });
}

async function nuevoReclamoResuelto(sufijo: string): Promise<string> {
  const r = await prisma.reclamo.create({
    data: {
      inmobiliariaId: contrato.inmobiliariaId,
      contratoId: contrato.id,
      propiedadId: contrato.propiedadId,
      categoria: 'PLOMERIA',
      urgencia: 'MEDIA',
      descripcion: `${PREFIJO} — ${sufijo}`,
      estado: 'EN_CURSO',
    },
  });
  const res = await app.inject({
    method: 'POST',
    url: `/reclamos/${r.id}/resolver`,
    headers: auth(tAdmin),
    payload: { resolucion: `Arreglado: ${sufijo}` },
  });
  expect(res.statusCode).toBe(200);
  return r.id;
}

/** El reclamo tal como lo recibe la app del inquilino. */
async function comoLoVeElInquilino(id: string) {
  const r = await app.inject({ method: 'GET', url: '/mis-reclamos', headers: auth(tInquilino) });
  expect(r.statusCode).toBe(200);
  const fila = (r.json() as Array<Record<string, unknown>>).find((x) => x.id === id);
  expect(fila, 'el reclamo tiene que estar en /mis-reclamos del inquilino demo').toBeTruthy();
  return fila as { estado: string; resolucion: string | null; reabiertoPor: string | null };
}

describe('la reapertura no se le atribuye a quien no fue', () => {
  it('🔴 si reabre la INMOBILIARIA, al inquilino no se le dice que reportó nada', async () => {
    const id = await nuevoReclamoResuelto('pérdida en la cocina');
    const re = await app.inject({
      method: 'POST',
      url: `/reclamos/${id}/reabrir`,
      headers: auth(tAdmin),
      payload: { motivo: 'El monto del profesional estaba mal cargado' },
    });
    expect(re.statusCode).toBe(200);

    const visto = await comoLoVeElInquilino(id);
    expect(visto.estado).toBe('EN_CURSO');
    expect(visto.resolucion).toBeTruthy(); // el rastro que confundía a la pantalla
    // Con el bug: la pantalla infería 'INQUILINO' de esta misma combinación.
    expect(visto.reabiertoPor).toBe('INMOBILIARIA');
  });

  it('si reabre el INQUILINO (PERSISTE), sí es suya', async () => {
    const id = await nuevoReclamoResuelto('la ducha sigue fría');
    const pers = await app.inject({
      method: 'POST',
      url: `/mis-reclamos/${id}/confirmar-resolucion`,
      headers: auth(tInquilino),
      payload: { decision: 'PERSISTE', comentario: 'Sigue saliendo agua fría a la mañana' },
    });
    expect(pers.statusCode).toBe(200);

    const visto = await comoLoVeElInquilino(id);
    expect(visto.estado).toBe('EN_CURSO');
    expect(visto.reabiertoPor).toBe('INQUILINO');
  });

  it('🔴 el camino largo: conforme → cerrado → lo reabre la inmobiliaria', async () => {
    const id = await nuevoReclamoResuelto('cortocircuito en el palier');
    const conf = await app.inject({
      method: 'POST',
      url: `/mis-reclamos/${id}/confirmar-resolucion`,
      headers: auth(tInquilino),
      payload: { decision: 'CONFORME' },
    });
    expect(conf.statusCode).toBe(200);
    const re = await app.inject({
      method: 'POST',
      url: `/reclamos/${id}/reabrir`,
      headers: auth(tAdmin),
      payload: { motivo: 'Se cargó mal a quién se le cobra' },
    });
    expect(re.statusCode).toBe(200);

    // La confirmación CONFORME sigue ahí: es one-shot y nadie la borra. Ése es justamente el
    // dato con el que la card verde decía "Resuelto · confirmado por vos" sobre un reclamo
    // que hoy está en curso.
    const confirmacion = await prisma.confirmacionReclamo.findFirst({ where: { reclamoId: id } });
    expect(confirmacion?.estado).toBe('CONFORME');

    const visto = await comoLoVeElInquilino(id);
    expect(visto.estado).toBe('EN_CURSO');
    expect(visto.reabiertoPor).toBe('INMOBILIARIA');
  });

  it('CONTROL POSITIVO — un reclamo resuelto y no reabierto no atribuye nada', async () => {
    const id = await nuevoReclamoResuelto('canilla del patio');
    const visto = await comoLoVeElInquilino(id);
    expect(visto.estado).toBe('RESUELTO');
    expect(visto.reabiertoPor).toBeNull();
  });

  it('CONTROL POSITIVO — uno cerrado por el inquilino tampoco', async () => {
    const id = await nuevoReclamoResuelto('luz del lavadero');
    await app.inject({
      method: 'POST',
      url: `/mis-reclamos/${id}/confirmar-resolucion`,
      headers: auth(tInquilino),
      payload: { decision: 'CONFORME' },
    });
    const visto = await comoLoVeElInquilino(id);
    expect(visto.estado).toBe('CERRADO');
    expect(visto.reabiertoPor).toBeNull();
  });
});
