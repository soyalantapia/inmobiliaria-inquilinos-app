import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * El circuito completo: un contrato EN CURSO cargado por el equipo queda pendiente
 * con sus períodos guardados, y al aprobarlo se activa, devenga y aplica el estado
 * inicial. Si los períodos se perdieran entre el borrador y la aprobación, la deuda
 * histórica del inquilino desaparecería sin aviso — por eso este test existe.
 */
let app: FastifyInstance;
let prisma: PrismaClient;
let tokenOperador: string;
let tokenAdmin: string;
let inmobiliariaId: string;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  inmobiliariaId = inmo.id;
  await prisma.inmobiliaria.update({
    where: { id: inmobiliariaId },
    data: { contratosRequierenAprobacion: true },
  });
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tokenOperador = (await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'luciana@delsol.com', password: 'delsol123' },
  })).json().token;
  tokenAdmin = (await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  })).json().token;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('aprobar un contrato en curso', () => {
  it('activa, devenga y aplica los períodos anteriores que venían del borrador', async () => {
    const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId } });
    const propiedad = await prisma.propiedad.create({
      data: {
        inmobiliariaId, direccion: 'Test aprobar en curso', ciudad: 'CABA',
        provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO', estado: 'DISPONIBLE',
      },
    });
    await prisma.participacionPropietario.create({
      data: { inmobiliariaId, propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 },
    });

    // Contrato que arrancó hace 3 meses → tiene períodos vencidos.
    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 3, 1));
    const periodoViejo = `${inicio.getUTCFullYear()}-${String(inicio.getUTCMonth() + 1).padStart(2, '0')}`;

    const alta = await app.inject({
      method: 'POST', url: '/contratos',
      headers: { authorization: `Bearer ${tokenOperador}` },
      payload: {
        propiedadId: propiedad.id,
        inquilino: { nombre: 'En Curso' },
        monto: 100_000,
        fechaInicio: inicio.toISOString().slice(0, 10),
        fechaFin: new Date(Date.UTC(inicio.getUTCFullYear() + 2, inicio.getUTCMonth(), 1)).toISOString().slice(0, 10),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        periodosAnteriores: [{ periodo: periodoViejo, estado: 'PAGADO' }],
      },
    });
    expect(alta.statusCode).toBeLessThan(300);
    const contratoId = alta.json().id;

    const apr = await prisma.aprobacion.findFirstOrThrow({ where: { entidadId: contratoId } });
    const res = await app.inject({
      method: 'POST', url: `/aprobaciones/${apr.id}/aprobar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { pin: '1234' },
    });
    expect(res.statusCode, res.body).toBe(200);

    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(c.estado).toBe('ACTIVO');
    expect(c.periodosAnterioresPendientes).toBeNull(); // se consumieron

    const prop = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedad.id } });
    expect(prop.contratoActualId).toBe(contratoId); // reclamó la propiedad

    // El período declarado PAGADO quedó cerrado con su pago sintético.
    const liq = await prisma.liquidacion.findFirstOrThrow({
      where: { contratoId, periodo: periodoViejo },
    });
    expect(liq.estado).toBe('PAGADO');
    expect(await prisma.pago.count({ where: { liquidacionId: liq.id } })).toBe(1);
  });
});
