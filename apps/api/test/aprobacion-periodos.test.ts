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

/**
 * Review de esta tarea (hallazgo 1 + 2): el safeParse de periodosAnterioresPendientes
 * no distinguía "no hay nada" (columna null — el camino normal) de "hay datos pero
 * son inválidos" (columna con contenido que no pasa el schema — una anomalía). Los
 * dos casos caían en el mismo no-op silencioso: la aprobación devolvía 200 y la
 * deuda histórica se perdía sin dejar rastro. Ahora el caso con contenido inválido
 * tiene que EXPLOTAR con EstadoInicialInvalido (→ 400, rollback, la aprobación queda
 * PENDIENTE y reintentable) en vez de activarse en silencio.
 */
describe('aprobar con estado inicial corrupto/inconsistente (no debe perderse en silencio)', () => {
  async function crearBorradorEnCurso(direccion: string) {
    const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId } });
    const propiedad = await prisma.propiedad.create({
      data: {
        inmobiliariaId, direccion, ciudad: 'CABA',
        provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO', estado: 'DISPONIBLE',
      },
    });
    await prisma.participacionPropietario.create({
      data: { inmobiliariaId, propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 },
    });

    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 3, 1));

    const alta = await app.inject({
      method: 'POST', url: '/contratos',
      headers: { authorization: `Bearer ${tokenOperador}` },
      payload: {
        propiedadId: propiedad.id,
        inquilino: { nombre: direccion },
        monto: 100_000,
        fechaInicio: inicio.toISOString().slice(0, 10),
        fechaFin: new Date(Date.UTC(inicio.getUTCFullYear() + 2, inicio.getUTCMonth(), 1)).toISOString().slice(0, 10),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        // Sin periodosAnteriores en el alta: lo pisamos directo en la DB abajo
        // para simular el estado corrupto que el review pide cubrir.
      },
    });
    expect(alta.statusCode, alta.body).toBeLessThan(300);
    const contratoId = alta.json().id as string;
    const apr = await prisma.aprobacion.findFirstOrThrow({ where: { entidadId: contratoId } });
    return { contratoId, aprobacionId: apr.id, propiedadId: propiedad.id };
  }

  it('un período que no corresponde al contrato da 400 y deja la aprobación PENDIENTE (rollback)', async () => {
    const { contratoId, aprobacionId, propiedadId } = await crearBorradorEnCurso('Test período inexistente');

    // Estado inicial "válido para el schema" pero que aplicarEstadoInicial no va a
    // encontrar entre las liquidaciones devengadas: un período muy anterior al
    // inicio del contrato (2000-01, mientras el contrato arrancó hace 3 meses).
    await prisma.contrato.update({
      where: { id: contratoId },
      data: { periodosAnterioresPendientes: [{ periodo: '2000-01', estado: 'PAGADO' }] },
    });

    const res = await app.inject({
      method: 'POST', url: `/aprobaciones/${aprobacionId}/aprobar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { pin: '1234' },
    });
    expect(res.statusCode, res.body).toBe(400);

    const aprAfter = await prisma.aprobacion.findUniqueOrThrow({ where: { id: aprobacionId } });
    expect(aprAfter.estado).toBe('PENDIENTE'); // reintentable: el rollback no la dejó decidida

    const contratoAfter = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(contratoAfter.estado).not.toBe('ACTIVO'); // el rollback no activó el contrato

    const propAfter = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    expect(propAfter.contratoActualId).toBeNull(); // tampoco quedó reclamada
  });

  it('una columna con JSON corrupto (no pasa el schema) también da 400, no un no-op silencioso', async () => {
    const { contratoId, aprobacionId } = await crearBorradorEnCurso('Test JSON corrupto');

    // Basura que no pasa PeriodosAnterioresSchema (no es un array de períodos):
    // antes safeParse fallaba igual que con null y el endpoint lo trataba como
    // "no hay estado inicial", perdiendo la deuda histórica sin aviso.
    await prisma.contrato.update({
      where: { id: contratoId },
      data: { periodosAnterioresPendientes: { esto: 'no es un array de períodos' } },
    });

    const res = await app.inject({
      method: 'POST', url: `/aprobaciones/${aprobacionId}/aprobar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { pin: '1234' },
    });
    expect(res.statusCode, res.body).toBe(400);

    const aprAfter = await prisma.aprobacion.findUniqueOrThrow({ where: { id: aprobacionId } });
    expect(aprAfter.estado).toBe('PENDIENTE');

    const contratoAfter = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(contratoAfter.estado).not.toBe('ACTIVO');
  });
});
