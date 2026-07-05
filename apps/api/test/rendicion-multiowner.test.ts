import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Regresión del bug multi-propietario (B2): en una propiedad con varios dueños,
 * un gasto de caja debe rendirse POR PARTES (cada dueño su participación) y
 * conservarse el total. Antes se marcaba el gasto descontado-entero tras la
 * primera rendición → el 2º dueño nunca recibía su parte (la inmo la absorbía).
 *
 * Con la lógica vieja, la 2ª rendición daría totalGastos=0 → este test la atrapa.
 */

const P = 'mo_'; // prefijo de los fixtures, para limpiar al final
let app: FastifyInstance;
let token: string;
let inmobiliariaId: string;

const prisma = new PrismaClient();

async function limpiar() {
  await prisma.gastoRendido.deleteMany({ where: { refId: `${P}gasto` } });
  await prisma.rendicion.deleteMany({ where: { propietarioId: { in: [`${P}ownA`, `${P}ownB`] } } });
  await prisma.movimientoCaja.deleteMany({ where: { id: `${P}gasto` } });
  await prisma.pago.deleteMany({ where: { id: `${P}pago` } });
  await prisma.liquidacion.deleteMany({ where: { id: `${P}liq` } });
  await prisma.contrato.deleteMany({ where: { id: `${P}cnt` } });
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: `${P}prop` } });
  await prisma.propietario.deleteMany({ where: { id: { in: [`${P}ownA`, `${P}ownB`] } } });
  await prisma.propiedad.deleteMany({ where: { id: `${P}prop` } });
}

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  await limpiar();

  await prisma.propiedad.create({
    data: {
      id: `${P}prop`,
      inmobiliariaId,
      direccion: 'Multi-owner 123',
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
    },
  });
  for (const s of ['A', 'B']) {
    await prisma.propietario.create({
      data: {
        id: `${P}own${s}`,
        inmobiliariaId,
        nombre: `Owner${s}`,
        apellido: 'Test',
        cuit: `20-0000000${s === 'A' ? 1 : 2}-9`,
        email: `owner${s.toLowerCase()}@motest.com`,
        telefono: '1100000000',
        comisionPct: 0, // sin comisión: neto = bruto - gastos (math limpia)
        cbuAlias: `mo.alias.${s.toLowerCase()}`,
      },
    });
    await prisma.participacionPropietario.create({
      data: { inmobiliariaId, propiedadId: `${P}prop`, propietarioId: `${P}own${s}`, porcentaje: 50 },
    });
  }
  await prisma.contrato.create({
    data: {
      id: `${P}cnt`,
      inmobiliariaId,
      propiedadId: `${P}prop`,
      monto: 1000,
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2027-01-01T00:00:00.000Z'),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      estado: 'ACTIVO',
      modoCobranza: 'INMOBILIARIA',
    },
  });
  await prisma.liquidacion.create({
    data: {
      id: `${P}liq`,
      inmobiliariaId,
      contratoId: `${P}cnt`,
      periodo: '2026-05',
      montoAlquiler: 1000,
      montoTotal: 1000,
      fechaVencimiento: new Date('2026-05-10T00:00:00.000Z'),
      estado: 'PAGADO',
    },
  });
  // La rendición es INCREMENTAL desde los pagos CONCILIADO: una liq PAGADO sin
  // fila Pago no tiene nada que rendir (409 "no hay cobros nuevos").
  await prisma.pago.create({
    data: {
      id: `${P}pago`,
      inmobiliariaId,
      contratoId: `${P}cnt`,
      liquidacionId: `${P}liq`,
      periodo: '2026-05',
      monto: 1000,
      montoLiqTotal: 1000,
      metodo: 'TRANSFERENCIA',
      fechaTransferencia: new Date('2026-05-10T00:00:00.000Z'),
      estado: 'CONCILIADO',
      decididoAt: new Date('2026-05-10T00:00:00.000Z'),
    },
  });
  await prisma.movimientoCaja.create({
    data: {
      id: `${P}gasto`,
      inmobiliariaId,
      propiedadId: `${P}prop`,
      tipo: 'GASTO',
      categoria: 'PLOMERIA',
      descripcion: 'Plomería test',
      monto: 200,
      fecha: new Date('2026-05-15T00:00:00.000Z'),
      cargadoPor: 'test',
    },
  });

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
});

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('Rendición multi-propietario: el gasto se reparte y se conserva', () => {
  it('dueño A (50%): bruto 500, descuenta su mitad del gasto (100), gasto NO cerrado aún', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(token),
      payload: { propietarioId: `${P}ownA`, periodo: '2026-05', metodo: 'TRANSFERENCIA', pin: '1234' },
    });
    expect(res.statusCode).toBe(201);
    const r = res.json();
    expect(Number(r.montoBruto)).toBe(500);
    expect(Number(r.totalGastos)).toBe(100);
    expect(Number(r.montoNeto)).toBe(400);
    const gasto = await prisma.movimientoCaja.findUnique({ where: { id: `${P}gasto` } });
    expect(gasto?.descontadoEnRendicion).toBe(false); // sólo media parte rendida
  });

  it('dueño B (50%): TAMBIÉN descuenta su mitad (100) — antes daba 0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(token),
      payload: { propietarioId: `${P}ownB`, periodo: '2026-05', metodo: 'TRANSFERENCIA', pin: '1234' },
    });
    expect(res.statusCode).toBe(201);
    const r = res.json();
    expect(Number(r.totalGastos)).toBe(100);
    expect(Number(r.montoNeto)).toBe(400);
    const gasto = await prisma.movimientoCaja.findUnique({ where: { id: `${P}gasto` } });
    expect(gasto?.descontadoEnRendicion).toBe(true); // ahora sí, cubierto 100%
  });

  it('conservación: la suma de las partes rendidas == monto total del gasto', async () => {
    const agg = await prisma.gastoRendido.aggregate({
      where: { refId: `${P}gasto`, tipo: 'CAJA' },
      _sum: { monto: true },
    });
    expect(Number(agg._sum.monto ?? 0)).toBe(200);
  });
});
