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
  await prisma.gastoRendido.deleteMany({ where: { refId: { in: [`${P}gasto`, `${P}gasto2`] } } });
  await prisma.ingresoRendido.deleteMany({ where: { rendicion: { propietarioId: { in: [`${P}ownA`, `${P}ownB`] } } } });
  // AlquilerRendido cuelga de Rendicion con FK RESTRICT → borrarlo antes.
  await prisma.alquilerRendido.deleteMany({ where: { rendicion: { propietarioId: { in: [`${P}ownA`, `${P}ownB`] } } } });
  await prisma.rendicion.deleteMany({ where: { propietarioId: { in: [`${P}ownA`, `${P}ownB`] } } });
  await prisma.movimientoCaja.deleteMany({ where: { id: { in: [`${P}gasto`, `${P}gasto2`] } } });
  await prisma.pago.deleteMany({ where: { id: { in: [`${P}pago`, `${P}pago2a`, `${P}pago2b`] } } });
  await prisma.liquidacion.deleteMany({ where: { id: { in: [`${P}liq`, `${P}liq2`] } } });
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

/**
 * EL CASO QUE FALTABA: el MISMO dueño rindiendo dos veces el mismo período.
 *
 * La suite de arriba cubre "A una vez → B una vez", que siempre funcionó. El agujero
 * estaba en la rendición INCREMENTAL (el flujo normal: el inquilino paga en tandas y se
 * rinde a medida que entra la plata): en multi-dueño el movimiento queda
 * `descontadoEnRendicion=false` hasta que las partes cubren el 100%, así que la segunda
 * rendición del MISMO dueño volvía a tomar el gasto entero y le descontaba su parte DOS
 * VECES — y encima marcaba el gasto como cubierto, dejando al co-dueño sin pagar la suya.
 */
describe('Rendición INCREMENTAL al mismo dueño: no se le cobra dos veces la misma parte', () => {
  const PERIODO = '2026-06';

  beforeAll(async () => {
    await prisma.liquidacion.create({
      data: {
        id: `${P}liq2`,
        inmobiliariaId,
        contratoId: `${P}cnt`,
        periodo: PERIODO,
        montoAlquiler: 1000,
        montoTotal: 1000,
        fechaVencimiento: new Date('2026-06-10T00:00:00.000Z'),
        estado: 'PARCIAL',
        moneda: 'ARS',
      },
    });
    // 1ª tanda: el inquilino paga 400 de los 1000.
    await prisma.pago.create({
      data: {
        id: `${P}pago2a`,
        inmobiliariaId,
        contratoId: `${P}cnt`,
        liquidacionId: `${P}liq2`,
        periodo: PERIODO,
        monto: 400,
        montoLiqTotal: 1000,
        metodo: 'TRANSFERENCIA',
        fechaTransferencia: new Date('2026-06-05T00:00:00.000Z'),
        estado: 'CONCILIADO',
      },
    });
    await prisma.movimientoCaja.create({
      data: {
        id: `${P}gasto2`,
        inmobiliariaId,
        propiedadId: `${P}prop`,
        tipo: 'GASTO',
        categoria: 'PLOMERIA',
        descripcion: 'Service de caldera',
        monto: 200,
        fecha: new Date('2026-06-03T00:00:00.000Z'),
        cargadoPor: 'test',
        descontadoEnRendicion: false,
      },
    });
  });

  it('1ª rendición a A: cobra su mitad del gasto (100)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(token),
      payload: { propietarioId: `${P}ownA`, periodo: PERIODO, metodo: 'TRANSFERENCIA' },
    });
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().montoBruto)).toBe(200); // 400 cobrado × 50%
    expect(Number(res.json().totalGastos)).toBe(100); // su mitad de 200
  });

  it('2ª rendición al MISMO dueño (entra el resto): NO le vuelve a cobrar el gasto', async () => {
    // 2ª tanda: entran los 600 restantes.
    await prisma.pago.create({
      data: {
        id: `${P}pago2b`,
        inmobiliariaId,
        contratoId: `${P}cnt`,
        liquidacionId: `${P}liq2`,
        periodo: PERIODO,
        monto: 600,
        montoLiqTotal: 1000,
        metodo: 'TRANSFERENCIA',
        fechaTransferencia: new Date('2026-06-20T00:00:00.000Z'),
        estado: 'CONCILIADO',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(token),
      payload: { propietarioId: `${P}ownA`, periodo: PERIODO, metodo: 'TRANSFERENCIA' },
    });
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().montoBruto)).toBe(300); // 600 nuevos × 50%
    // EL BUG: sin el cap por dueño esto daba 100 otra vez (A pagaba 200 de un gasto
    // de 200 del que le tocaban 100) y encima cerraba el gasto, dejando a B sin pagar.
    expect(Number(res.json().totalGastos)).toBe(0);
    const gasto = await prisma.movimientoCaja.findUnique({ where: { id: `${P}gasto2` } });
    expect(gasto?.descontadoEnRendicion).toBe(false); // sigue esperando la parte de B
  });

  it('el co-dueño B sigue pudiendo pagar SU parte, y el total se conserva', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(token),
      payload: { propietarioId: `${P}ownB`, periodo: PERIODO, metodo: 'TRANSFERENCIA' },
    });
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().totalGastos)).toBe(100);
    const agg = await prisma.gastoRendido.aggregate({
      where: { refId: `${P}gasto2`, tipo: 'CAJA' },
      _sum: { monto: true },
    });
    // Conservación: entre los dos dueños se rindió exactamente el gasto, ni más ni menos.
    expect(Number(agg._sum.monto ?? 0)).toBe(200);
    const gasto = await prisma.movimientoCaja.findUnique({ where: { id: `${P}gasto2` } });
    expect(gasto?.descontadoEnRendicion).toBe(true);
  });
});
