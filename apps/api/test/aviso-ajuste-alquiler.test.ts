import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Subir el alquiler era MUDO para el inquilino. Los DOS caminos que cambian el
 * canon —POST /contratos/:id/ajustar y PATCH /contratos/:id/monto, que es
 * también el "ajuste masivo +X%"— escribían el monto nuevo sin avisar nada, y el
 * inquilino se enteraba cuando le llegaba la cuota.
 *
 * (De paso: NO existe ningún "ajuste automático por índice" en el sistema.
 * `Contrato.indiceAjuste` es informativo. Los dos caminos son manuales.)
 *
 * Camila, reunión 03/08: subió el alquiler a 550 y del otro lado no llegó nada.
 */
let app: FastifyInstance;
let prisma: PrismaClient;
let tokenAdmin: string;
let inmobiliariaId: string;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  inmobiliariaId = (
    await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } })
  ).id;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tokenAdmin = (
    await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'roberto@delsol.com', password: 'delsol123' },
    })
  ).json().token;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function contratoActivo(direccion: string, monto = 300_000) {
  const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId } });
  const propiedad = await prisma.propiedad.create({
    data: {
      inmobiliariaId,
      direccion,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      estado: 'DISPONIBLE',
    },
  });
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 },
  });
  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {
      propiedadId: propiedad.id,
      inquilino: { nombre: 'Avisame', apellido: 'Porfa', email: `aviso-${Date.now()}@test.local` },
      monto,
      fechaInicio: inicio.toISOString().slice(0, 10),
      fechaFin: new Date(Date.UTC(inicio.getUTCFullYear() + 2, inicio.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
    },
  });
  expect(alta.statusCode, alta.body).toBeLessThan(300);
  return alta.json().id as string;
}

/** Anuncios dirigidos EXACTAMENTE a este contrato. */
const avisosDe = (contratoId: string) =>
  prisma.anuncio.findMany({
    where: { inmobiliariaId, audiencia: 'CONTRATOS_ESPECIFICOS', audienciaIds: { has: contratoId } },
    orderBy: { enviadoAt: 'desc' },
  });

describe('subir el alquiler avisa al inquilino', () => {
  it('POST /contratos/:id/ajustar deja un aviso con el monto viejo y el nuevo', async () => {
    const contratoId = await contratoActivo('Aviso ajuste 100', 300_000);
    expect(await avisosDe(contratoId)).toHaveLength(0);

    const hoy = new Date();
    const periodo = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 2).padStart(2, '0')}`;
    const res = await app.inject({
      method: 'POST',
      url: `/contratos/${contratoId}/ajustar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { montoNuevo: 400_000, periodoDesde: periodo.replace('-13', '-12'), motivo: 'acuerdo' },
    });
    expect(res.statusCode, res.body).toBe(200);

    const avisos = await avisosDe(contratoId);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]!.prioridad).toBe('IMPORTANTE');
    // El cuerpo tiene que decir de cuánto a cuánto: un aviso que no dice el
    // número no sirve de nada.
    expect(avisos[0]!.cuerpo).toMatch(/300\.000/);
    expect(avisos[0]!.cuerpo).toMatch(/400\.000/);
    expect(avisos[0]!.destinatariosCount).toBeGreaterThan(0);
  });

  it('PATCH /contratos/:id/monto (el camino del ajuste masivo) también avisa', async () => {
    const contratoId = await contratoActivo('Aviso ajuste 200', 250_000);

    const res = await app.inject({
      method: 'PATCH',
      url: `/contratos/${contratoId}/monto`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { monto: 275_000, motivo: 'ajuste masivo', pin: '1234' },
    });
    expect(res.statusCode, res.body).toBe(200);

    const avisos = await avisosDe(contratoId);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]!.cuerpo).toMatch(/250\.000/);
    expect(avisos[0]!.cuerpo).toMatch(/275\.000/);
  });

  it('el aviso NO rompe el ajuste: si no hay a quién avisar, el monto se ajusta igual', async () => {
    // Contrato sin inquilino con email: resolverAudiencia no alcanza a nadie.
    // El ajuste es la operación importante; el aviso es best-effort.
    const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId } });
    const propiedad = await prisma.propiedad.create({
      data: {
        inmobiliariaId,
        direccion: 'Aviso ajuste sin destinatario 300',
        ciudad: 'CABA',
        provincia: 'Buenos Aires',
        tipo: 'DEPARTAMENTO',
        estado: 'DISPONIBLE',
      },
    });
    await prisma.participacionPropietario.create({
      data: { inmobiliariaId, propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 },
    });
    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: {
        propiedadId: propiedad.id,
        inquilino: { nombre: 'Sin', apellido: 'Mail' }, // sin email
        monto: 100_000,
        fechaInicio: inicio.toISOString().slice(0, 10),
        fechaFin: new Date(Date.UTC(inicio.getUTCFullYear() + 2, inicio.getUTCMonth(), 1))
          .toISOString()
          .slice(0, 10),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
      },
    });
    const contratoId = alta.json().id as string;

    const res = await app.inject({
      method: 'PATCH',
      url: `/contratos/${contratoId}/monto`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { monto: 120_000, pin: '1234' },
    });
    expect(res.statusCode, res.body).toBe(200);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(Number(c.monto)).toBe(120_000); // el ajuste se aplicó igual
  });
});
