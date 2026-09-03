/**
 * Cuando el profesional cierra el trabajo desde su link mágico, al inquilino le llega el mail.
 *
 * EL DEFECTO. Un reclamo se cierra por DOS puertas: `POST /reclamos/:id/resolver` (la operadora
 * desde el panel) y `POST /visitas-publicas/listo` (el profesional apretando «Listo» en el link
 * que le mandaron por WhatsApp). El aviso por mail de T-17 se cableó sólo en la primera. Por la
 * segunda —que es la que más se usa justamente cuando hay un profesional asignado— el reclamo
 * quedaba RESUELTO y al inquilino no le llegaba nada: apenas el aviso in-app «Calificá tu última
 * reparación», de severidad baja, que además exige que entre a la app.
 *
 * Es el patrón de siempre en este repo: se arregla un endpoint y se olvida el otro. Por eso el
 * test mira la puerta que se olvidó, y no la que ya andaba.
 *
 * QUÉ MIRA. El sobre que sale por el transport: que vaya al inquilino titular, que el asunto
 * diga que se resolvió, y que el cuerpo lleve la nota que escribió el profesional. Y las dos
 * veces que NO tiene que salir, que son las que hacen que el aviso no se vuelva spam: el
 * doble-tap del mismo link, y el cierre que ganó el panel.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

interface MailEnviado {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
}

const enviados: MailEnviado[] = [];

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: MailEnviado) => {
        enviados.push(m);
        return { messageId: 'test' };
      },
    }),
  },
}));

let app: FastifyInstance;
const prisma = new PrismaClient();

const P = 'ZZ-cierra-';
let contratoId = '';
let propiedadId = '';
let profesionalId = '';
let emailInquilino = '';
let tenant = '';

beforeAll(async () => {
  // El mailer lee la config SMTP al importarse: hay que setearla ANTES de traer la app.
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_USER = 'u';
  process.env.SMTP_PASS = 'p';
  process.env.SMTP_GAP_MS = '0'; // el aviso va por la cola; acá no se mide tiempo

  const { seedBase } = await import('../prisma/seed.js');
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  const { buildApp } = await import('../src/app.js');
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });

  // Un contrato cuyo titular TENGA email: sin eso el aviso se saltea por diseño y el test
  // estaría midiendo el silencio en vez del envío.
  const c = await prisma.contrato.findFirstOrThrow({
    where: { inquilinoTitular: { email: { not: null } } },
    select: { id: true, propiedadId: true, inmobiliariaId: true, inquilinoTitular: { select: { email: true } } },
  });
  contratoId = c.id;
  propiedadId = c.propiedadId;
  emailInquilino = c.inquilinoTitular!.email!;
  tenant = c.inmobiliariaId;
  profesionalId = (await prisma.profesional.findFirstOrThrow({ where: { inmobiliariaId: tenant } })).id;
  await limpiar();
});

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

async function limpiar(): Promise<void> {
  const recs = await prisma.reclamo.findMany({ where: { descripcion: { startsWith: P } }, select: { id: true } });
  const ids = recs.map((r) => r.id);
  if (!ids.length) return;
  await prisma.visitaProfesional.deleteMany({ where: { reclamoId: { in: ids } } });
  await prisma.reclamoEvento.deleteMany({ where: { reclamoId: { in: ids } } });
  await prisma.cargoContrato.deleteMany({ where: { reclamoId: { in: ids } } });
  await prisma.reclamo.deleteMany({ where: { id: { in: ids } } });
}

/** Un reclamo EN_CURSO con su visita en EN_CAMINO, y el JWT del profesional. */
async function reclamoConVisitaEnCamino(sufijo: string): Promise<{ reclamoId: string; jwt: string }> {
  const rec = await prisma.reclamo.create({
    data: {
      inmobiliariaId: tenant,
      contratoId,
      propiedadId,
      profesionalId,
      categoria: 'ELECTRICIDAD',
      descripcion: `${P}${sufijo}`,
      urgencia: 'ALTA',
      estado: 'EN_CURSO',
      pagador: 'PROPIETARIO',
    },
  });
  const visita = await prisma.visitaProfesional.create({
    data: {
      inmobiliariaId: tenant,
      reclamoId: rec.id,
      profesionalId,
      token: `${P}${sufijo}-tok`,
      estado: 'EN_CAMINO',
      confirmadaAt: new Date(Date.now() - 3_600_000),
      enCaminoAt: new Date(Date.now() - 1_800_000),
    },
  });
  const jwt = app.jwt.sign(
    { kind: 'profesional', visitaId: visita.id, inmobiliariaId: tenant, profesionalId },
    { expiresIn: '1h' },
  );
  return { reclamoId: rec.id, jwt };
}

const listo = (jwt: string, notaFinal: string) =>
  app.inject({
    method: 'POST',
    url: '/visitas-publicas/listo',
    headers: { authorization: `Bearer ${jwt}` },
    payload: { notaFinal },
  });

/**
 * Los mails de ESTE reclamo, al inquilino titular.
 *
 * Se filtra por el id del reclamo —viaja en el link de «reabrir» que lleva el cuerpo— y no
 * vaciando el buffer entre casos. El aviso se dispara con `void` DESPUÉS de responder y sale
 * por una cola: vaciar el arreglo no sincroniza nada, y un mail del caso anterior que aterriza
 * tarde se cuenta como si fuera de éste. Filtrar por id es la única forma de que cada caso
 * mire lo suyo.
 */
function mailsDe(reclamoId: string): MailEnviado[] {
  return enviados.filter(
    (m) => m.to === emailInquilino && `${m.text ?? ''}${m.html ?? ''}`.includes(reclamoId),
  );
}

/** Espera a que salga el mail de ese reclamo. */
async function esperarMailDe(reclamoId: string): Promise<MailEnviado[]> {
  for (let i = 0; i < 100; i++) {
    const propios = mailsDe(reclamoId);
    if (propios.length) return propios;
    await new Promise((r) => setTimeout(r, 50));
  }
  return mailsDe(reclamoId);
}

/**
 * Espera a que la cola se vacíe, para afirmar que NO salió nada. Sin esto, un «no salió mail»
 * pasaría en verde por llegar antes que el mail, que es la peor forma de pasar.
 */
async function esperarQueLaColaSeVacie(): Promise<void> {
  let anterior = -1;
  while (enviados.length !== anterior) {
    anterior = enviados.length;
    await new Promise((r) => setTimeout(r, 400));
  }
}

describe('el profesional cierra y al inquilino le avisa', () => {
  it('🔴 POST /visitas-publicas/listo le manda el mail de reclamo resuelto', async () => {
    const { reclamoId, jwt } = await reclamoConVisitaEnCamino('mail');

    const r = await listo(jwt, 'Cambié el térmico y probé todos los tomas.');
    expect(r.statusCode, r.body).toBe(200);

    // Lo que ya andaba, para que el caso no pase por un cierre que no ocurrió.
    const rec = await prisma.reclamo.findUniqueOrThrow({ where: { id: reclamoId }, select: { estado: true } });
    expect(rec.estado).toBe('RESUELTO');

    const propios = await esperarMailDe(reclamoId);
    expect(propios.length, 'no salió ningún mail para el inquilino titular').toBe(1);
    expect(propios[0]!.subject).toContain('resolvió');
    // La nota del profesional es lo único que le explica al inquilino QUÉ se hizo.
    expect(`${propios[0]!.text ?? ''}${propios[0]!.html ?? ''}`).toContain('Cambié el térmico');
  });

  it('el doble-tap del mismo link no manda un segundo mail', async () => {
    // El link se puede volver a abrir, y el profesional lo hace. Sin este caso, la corrección
    // convierte un olvido en spam.
    const { reclamoId, jwt } = await reclamoConVisitaEnCamino('doble');
    expect((await listo(jwt, 'Listo el trabajo.')).statusCode).toBe(200);
    expect((await esperarMailDe(reclamoId)).length).toBe(1);

    expect((await listo(jwt, 'otra vez')).statusCode).toBe(200);
    await esperarQueLaColaSeVacie();
    expect(mailsDe(reclamoId).length, 'el reintento mandó un segundo mail').toBe(1);
  });

  it('si el reclamo ya lo cerró otro, este /listo no avisa: el mail lo mandó esa puerta', async () => {
    // El `updateMany` condicionado por estado es el lock del cierre. Si no pegó, tampoco tiene
    // que avisar — si no, el inquilino recibe dos mails por el mismo reclamo.
    const { reclamoId, jwt } = await reclamoConVisitaEnCamino('carrera');
    await prisma.reclamo.update({
      where: { id: reclamoId },
      data: { estado: 'RESUELTO', resueltoAt: new Date() },
    });

    expect((await listo(jwt, 'llegué tarde')).statusCode).toBe(200);
    await esperarQueLaColaSeVacie();
    expect(mailsDe(reclamoId)).toEqual([]);
  });
});
