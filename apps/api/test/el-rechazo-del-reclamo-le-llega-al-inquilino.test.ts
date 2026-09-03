/**
 * T-17 · Rechazar un reclamo le exigía a la inmobiliaria un motivo que el inquilino nunca leía.
 *
 * `POST /reclamos/:id/rechazar` **obliga** a escribir un motivo, y el mensaje de error dice para
 * qué es: *«Contale al inquilino por qué se rechaza (mínimo 5 caracteres)»*.
 *
 * Después, del lado del inquilino, no pasaba nada:
 *
 *  - `GET /mis-notificaciones` cortaba con `CERRADOS = ['RESUELTO','CERRADO','RECHAZADO']`, así
 *    que el rechazo quedaba afuera del feed;
 *  - en la PWA el reclamo se iba a la solapa **«archivados»**.
 *
 * O sea: el motivo se escribía para alguien que no se enteraba de que existía. La inmobiliaria
 * cumplía con su parte —a veces con una explicación larga— y del otro lado el reclamo
 * desaparecía en silencio. Eso es peor que no pedir el motivo: hace creer que se avisó.
 *
 * DE DÓNDE SALE EL AVISO. Del **evento** `RECHAZADO`, no de `Reclamo.resolucion`, por dos
 * razones que este test fija: el evento trae CUÁNDO —`/rechazar` no toca `resueltoAt`— y
 * sobrevive a una reapertura posterior, que sí pisa `resolucion`.
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

const PREFIJO = 'QA rechazo avisa';
const MOTIVO = 'Corresponde al consorcio: la filtración viene de la terraza común.';
let contrato: { id: string; inmobiliariaId: string; propiedadId: string | null };

interface Notif {
  id: string;
  titulo: string;
  detalle: string;
  href: string;
}

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  tInquilino = await loginDemoTest(app);
  // El contrato sale de la SESIÓN, no de un email escrito a mano: un literal del seed se rompe
  // cuando otro PR toca el seed, y hay un 50% de que se rompa en verde.
  const payload = JSON.parse(Buffer.from(tInquilino.split('.')[1]!, 'base64url').toString('utf8')) as {
    contratoId?: string;
  };
  expect(payload.contratoId, 'la sesión demo tiene que traer un contrato').toBeTruthy();
  contrato = await prisma.contrato.findUniqueOrThrow({
    where: { id: payload.contratoId! },
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

async function reclamoRechazado(sufijo: string, motivo = MOTIVO): Promise<string> {
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
    url: `/reclamos/${r.id}/rechazar`,
    headers: auth(tAdmin),
    payload: { motivo },
  });
  expect(res.statusCode, res.body.slice(0, 150)).toBe(200);
  return r.id;
}

const notificaciones = async (): Promise<Notif[]> => {
  const r = await app.inject({ method: 'GET', url: '/mis-notificaciones', headers: auth(tInquilino) });
  expect(r.statusCode).toBe(200);
  return r.json() as Notif[];
};

describe('el rechazo de un reclamo le llega al inquilino', () => {
  it('🔴 aparece en sus notificaciones, CON el motivo que la inmobiliaria tuvo que escribir', async () => {
    const id = await reclamoRechazado('humedad en el techo');
    const notifs = await notificaciones();
    const aviso = notifs.find((n) => n.href === `/reclamos/${id}`);
    expect(aviso, 'con el bug: el rechazo no producía ninguna notificación').toBeTruthy();
    expect(aviso!.titulo).toMatch(/rechaz/i);
    // El motivo es el punto entero: sin él, el aviso sólo dice «no».
    expect(aviso!.detalle).toContain('Corresponde al consorcio');
  });

  it('el aviso sobrevive a una reapertura posterior, porque sale del EVENTO y no de `resolucion`', async () => {
    // `/resolver` pisa `resolucion`. Si el aviso saliera de ahí, un reclamo rechazado y después
    // reabierto y resuelto mostraría el texto equivocado — o ninguno.
    const id = await reclamoRechazado('cerradura trabada');
    const notifsAntes = await notificaciones();
    expect(notifsAntes.some((n) => n.href === `/reclamos/${id}`)).toBe(true);

    await prisma.reclamo.update({ where: { id }, data: { resolucion: 'otra cosa que pisó el texto' } });
    const aviso = (await notificaciones()).find((n) => n.href === `/reclamos/${id}`);
    expect(aviso!.detalle).toContain('Corresponde al consorcio');
  });

  it('un rechazo VIEJO no queda avisando para siempre', async () => {
    // Este feed se deriva en cada lectura: no hay «marcar como leído» que lo saque. La ventana
    // de 60 días es la misma que ya usan los ajustes de alquiler en este mismo endpoint.
    const id = await reclamoRechazado('timbre sin sonido');
    await prisma.reclamoEvento.updateMany({
      where: { reclamoId: id, tipo: 'RECHAZADO' },
      data: { fecha: new Date(Date.now() - 90 * 86400000) },
    });
    const notifs = await notificaciones();
    expect(notifs.some((n) => n.href === `/reclamos/${id}`)).toBe(false);
  });

  it('CONTROL POSITIVO — un reclamo EN CURSO no genera aviso de rechazo', async () => {
    const r = await prisma.reclamo.create({
      data: {
        inmobiliariaId: contrato.inmobiliariaId,
        contratoId: contrato.id,
        propiedadId: contrato.propiedadId,
        categoria: 'PLOMERIA',
        urgencia: 'MEDIA',
        descripcion: `${PREFIJO} — sigue abierto`,
        estado: 'EN_CURSO',
      },
    });
    const notifs = await notificaciones();
    expect(notifs.some((n) => n.titulo.match(/rechaz/i) && n.href === `/reclamos/${r.id}`)).toBe(false);
  });
});
