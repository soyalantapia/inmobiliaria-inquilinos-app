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
  await prisma.gastoRendido.deleteMany({ where: { refId: { startsWith: P } } });
  await prisma.gastoRendido.deleteMany({ where: { refId: { startsWith: `reclamo:${P}` } } });
  await prisma.reclamo.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.ingresoRendido.deleteMany({ where: { rendicion: { propietarioId: { in: [`${P}ownA`, `${P}ownB`] } } } });
  // AlquilerRendido cuelga de Rendicion con FK RESTRICT → borrarlo antes.
  await prisma.alquilerRendido.deleteMany({ where: { rendicion: { propietarioId: { in: [`${P}ownA`, `${P}ownB`] } } } });
  await prisma.rendicion.deleteMany({ where: { propietarioId: { in: [`${P}ownA`, `${P}ownB`] } } });
  // startsWith en vez de una lista de ids a mano: cada test nuevo que agregaba un
  // fixture y olvidaba sumarlo a la lista dejaba basura en la DB compartida.
  await prisma.movimientoCaja.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.pago.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.liquidacion.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.propiedad.updateMany({ where: { id: { startsWith: P } }, data: { contratoActualId: null } });
  // El historial va ANTES que el contrato: su FK es RESTRICT y desde que el alta escribe
  // un evento CREADO (T-29), todo contrato creado por la API tiene al menos una fila acá.
  // Se filtra por la relación para no repetir —ni desincronizar— el where de abajo.
  await prisma.eventoContrato.deleteMany({ where: { contrato: { id: { startsWith: P } } } });
  await prisma.contrato.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: { startsWith: P } } });
  await prisma.propietario.deleteMany({ where: { id: { in: [`${P}ownA`, `${P}ownB`] } } });
  await prisma.propiedad.deleteMany({ where: { id: { startsWith: P } } });
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
      tipo: 'TOTAL', // 1000 de 1000
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
        // 400 de 1000: no cubre la cuota.
        tipo: 'PARCIAL',
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
        // Con los 400 anteriores completa los 1000.
        tipo: 'TOTAL',
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

/**
 * ANULAR una rendición PARCIAL no puede dejar plata varada.
 *
 * En multi-dueño el `rendicionId` del movimiento apunta a la rendición que lo COMPLETÓ, no
 * a todas las que aportaron. Al anular una anterior, su fila del ledger se borraba pero el
 * movimiento seguía marcado como descontado → esa parte no se rendía nunca más.
 */
describe('Anular una rendición parcial: el gasto vuelve a quedar pendiente', () => {
  const PERIODO = '2026-07';

  beforeAll(async () => {
    await prisma.liquidacion.create({
      data: {
        id: `${P}liq3`,
        inmobiliariaId,
        contratoId: `${P}cnt`,
        periodo: PERIODO,
        montoAlquiler: 1000,
        montoTotal: 1000,
        fechaVencimiento: new Date('2026-07-10T00:00:00.000Z'),
        estado: 'PAGADO',
        moneda: 'ARS',
      },
    });
    await prisma.pago.create({
      data: {
        id: `${P}pago3`,
        inmobiliariaId,
        tipo: 'TOTAL', // 1000 de 1000
        contratoId: `${P}cnt`,
        liquidacionId: `${P}liq3`,
        periodo: PERIODO,
        monto: 1000,
        montoLiqTotal: 1000,
        metodo: 'TRANSFERENCIA',
        fechaTransferencia: new Date('2026-07-05T00:00:00.000Z'),
        estado: 'CONCILIADO',
      },
    });
    await prisma.movimientoCaja.create({
      data: {
        id: `${P}gasto3`,
        inmobiliariaId,
        propiedadId: `${P}prop`,
        tipo: 'GASTO',
        categoria: 'ELECTRICIDAD',
        descripcion: 'Tablero',
        monto: 200,
        fecha: new Date('2026-07-03T00:00:00.000Z'),
        cargadoPor: 'test',
        descontadoEnRendicion: false,
      },
    });
  });

  it('A y B rinden: el gasto queda cubierto y cerrado', async () => {
    for (const own of [`${P}ownA`, `${P}ownB`]) {
      const res = await app.inject({
        method: 'POST',
        url: '/rendiciones',
        headers: auth(token),
        payload: { propietarioId: own, periodo: PERIODO, metodo: 'TRANSFERENCIA' },
      });
      expect(res.statusCode).toBe(201);
      expect(Number(res.json().totalGastos)).toBe(100);
    }
    const gasto = await prisma.movimientoCaja.findUnique({ where: { id: `${P}gasto3` } });
    expect(gasto?.descontadoEnRendicion).toBe(true);
  });

  it('anular la rendición de A lo REABRE (antes quedaba cerrado con la mitad rendida)', async () => {
    const rendA = await prisma.rendicion.findFirst({
      where: { propietarioId: `${P}ownA`, periodo: PERIODO },
      select: { id: true },
    });
    expect(rendA).not.toBeNull();
    const res = await app.inject({
      method: 'POST',
      url: `/rendiciones/${rendA!.id}/anular`,
      headers: auth(token),
      // Motivo obligatorio desde la baja lógica.
      payload: { motivo: 'prueba de anulación multi-dueño' },
    });
    expect(res.statusCode).toBe(200);

    const gasto = await prisma.movimientoCaja.findUnique({ where: { id: `${P}gasto3` } });
    // EL BUG: el movimiento apuntaba a la rendición de B, así que el updateMany por
    // rendicionId no lo tocaba y quedaba descontado=true con sólo $100 en el ledger.
    expect(gasto?.descontadoEnRendicion).toBe(false);
    expect(gasto?.rendicionId).toBeNull();
    const agg = await prisma.gastoRendido.aggregate({
      where: { refId: `${P}gasto3`, tipo: 'CAJA' },
      _sum: { monto: true },
    });
    expect(Number(agg._sum.monto ?? 0)).toBe(100); // sólo queda la parte de B
  });

  it('A puede volver a rendir su parte: el total se conserva', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(token),
      payload: { propietarioId: `${P}ownA`, periodo: PERIODO, metodo: 'TRANSFERENCIA' },
    });
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().totalGastos)).toBe(100);
    const agg = await prisma.gastoRendido.aggregate({
      where: { refId: `${P}gasto3`, tipo: 'CAJA' },
      _sum: { monto: true },
    });
    expect(Number(agg._sum.monto ?? 0)).toBe(200);
  });
});

/**
 * La rendición guarda UN monto y UNA moneda (la valida contra las liquidaciones), pero
 * los movimientos de caja no llevaban moneda: entraban al neto sin mirar en cuál estaban.
 * Un gasto de $200 (pesos) sobre una propiedad con contrato en dólares se descontaba
 * como si fueran US$200 — el propietario cobraba US$200 de menos.
 */
describe('Moneda de la caja: la rendición sólo descuenta los gastos de SU moneda', () => {
  const PERIODO = '2026-08';

  beforeAll(async () => {
    await prisma.liquidacion.create({
      data: {
        id: `${P}liq4`,
        inmobiliariaId,
        contratoId: `${P}cnt`,
        periodo: PERIODO,
        montoAlquiler: 1000,
        montoTotal: 1000,
        fechaVencimiento: new Date('2026-08-10T00:00:00.000Z'),
        estado: 'PAGADO',
        moneda: 'ARS',
      },
    });
    await prisma.pago.create({
      data: {
        id: `${P}pago4`,
        inmobiliariaId,
        tipo: 'TOTAL', // 1000 de 1000
        contratoId: `${P}cnt`,
        liquidacionId: `${P}liq4`,
        periodo: PERIODO,
        monto: 1000,
        montoLiqTotal: 1000,
        metodo: 'TRANSFERENCIA',
        fechaTransferencia: new Date('2026-08-05T00:00:00.000Z'),
        estado: 'CONCILIADO',
      },
    });
    // Dos gastos iguales en número, distintos en moneda, sobre la MISMA propiedad.
    for (const [sufijo, moneda] of [['ars', 'ARS'], ['usd', 'USD']] as const) {
      await prisma.movimientoCaja.create({
        data: {
          id: `${P}gasto4${sufijo}`,
          inmobiliariaId,
          propiedadId: `${P}prop`,
          tipo: 'GASTO',
          categoria: 'PLOMERIA',
          descripcion: `Gasto en ${moneda}`,
          monto: 200,
          moneda,
          fecha: new Date('2026-08-03T00:00:00.000Z'),
          cargadoPor: 'test',
          descontadoEnRendicion: false,
        },
      });
    }
  });

  it('la rendición en ARS toma el gasto en ARS y NO el que está en USD', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(token),
      payload: { propietarioId: `${P}ownA`, periodo: PERIODO, metodo: 'TRANSFERENCIA' },
    });
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().montoBruto)).toBe(500); // 1000 cobrado × 50%
    // EL BUG: sin el filtro por moneda daba 200 (la mitad de los 200 ARS + la mitad
    // de los 200 USD sumados como si fueran la misma plata).
    expect(Number(res.json().totalGastos)).toBe(100); // sólo su mitad de los 200 ARS
  });

  it('el gasto en USD queda intacto y pendiente (no se lo comió una rendición ajena)', async () => {
    const usd = await prisma.movimientoCaja.findUniqueOrThrow({ where: { id: `${P}gasto4usd` } });
    expect(usd.descontadoEnRendicion).toBe(false);
    expect(usd.rendicionId).toBeNull();
    // Y el que sí correspondía quedó tomado a medias (el co-dueño B debe su mitad).
    const ars = await prisma.movimientoCaja.findUniqueOrThrow({ where: { id: `${P}gasto4ars` } });
    expect(ars.descontadoEnRendicion).toBe(false); // sólo A rindió: falta la mitad de B
    const partes = await prisma.gastoRendido.findMany({ where: { refId: `${P}gasto4ars` } });
    expect(partes).toHaveLength(1);
    expect(Number(partes[0].monto)).toBe(100);
  });

  it('un gasto en USD tampoco se le cobra al co-dueño', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(token),
      payload: { propietarioId: `${P}ownB`, periodo: PERIODO, metodo: 'TRANSFERENCIA' },
    });
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().totalGastos)).toBe(100);
    // Con las dos mitades cobradas, el gasto en ARS sí queda cerrado.
    const ars = await prisma.movimientoCaja.findUniqueOrThrow({ where: { id: `${P}gasto4ars` } });
    expect(ars.descontadoEnRendicion).toBe(true);
    const usd = await prisma.movimientoCaja.findUniqueOrThrow({ where: { id: `${P}gasto4usd` } });
    expect(usd.descontadoEnRendicion).toBe(false);
  });
});

/**
 * Cambiar el reparto de una propiedad volvía a cobrar el arreglo desde cero.
 *
 * El tope por dueño evita que a UNA persona se le cobre dos veces SU parte, pero no
 * impide que la inmobiliaria recaude más que el gasto cuando el reparto CAMBIA: al dueño
 * nuevo "le toca" el total y nunca rindió nada, así que paga entero lo que el anterior ya
 * pagó. Con los reclamos era peor que con la caja: no tienen ningún estado terminal, así
 * que la query los volvía a traer para CADA dueño nuevo, indefinidamente. Y si el arreglo
 * era grande frente al alquiler, el dueño entrante ni podía cobrar su rendición (409 por
 * neto negativo) con un mensaje que lo mandaba a revisar gastos de caja inexistentes.
 */
describe('Cambia el dueño: el arreglo ya pagado no se vuelve a cobrar', () => {
  const PERIODO = '2026-09';
  const SIG = '2026-10';

  beforeAll(async () => {
    for (const [id, periodo, fecha] of [
      [`${P}liq5`, PERIODO, '2026-09'],
      [`${P}liq6`, SIG, '2026-10'],
    ] as const) {
      await prisma.liquidacion.create({
        data: {
          id, inmobiliariaId, contratoId: `${P}cnt`, periodo,
          montoAlquiler: 1000, montoTotal: 1000,
          fechaVencimiento: new Date(`${fecha}-10T00:00:00.000Z`), estado: 'PAGADO', moneda: 'ARS',
        },
      });
      await prisma.pago.create({
        data: {
          id: `${P}pago${periodo}`, inmobiliariaId, contratoId: `${P}cnt`, liquidacionId: id,
          periodo, tipo: 'TOTAL', monto: 1000, montoLiqTotal: 1000, metodo: 'TRANSFERENCIA',
          fechaTransferencia: new Date(`${fecha}-05T00:00:00.000Z`), estado: 'CONCILIADO',
        },
      });
    }
    await prisma.reclamo.create({
      data: {
        id: `${P}rec`, inmobiliariaId, contratoId: `${P}cnt`, propiedadId: `${P}prop`,
        categoria: 'PLOMERIA', urgencia: 'MEDIA', descripcion: 'Arreglo del dueño anterior',
        estado: 'RESUELTO', pagador: 'PROPIETARIO', costoTrabajo: 200,
        resueltoAt: new Date('2026-09-15T00:00:00.000Z'),
      },
    });
  });

  const refRec = () => `reclamo:${P}rec`;

  it('A y B (50/50) pagan cada uno su mitad del arreglo', async () => {
    for (const own of [`${P}ownA`, `${P}ownB`]) {
      const res = await app.inject({
        method: 'POST', url: '/rendiciones', headers: auth(token),
        payload: { propietarioId: own, periodo: PERIODO, metodo: 'TRANSFERENCIA' },
      });
      expect(res.statusCode).toBe(201);
    }
    const partes = await prisma.gastoRendido.findMany({ where: { refId: refRec(), tipo: 'TRABAJO' } });
    expect(partes.reduce((a, g) => a + Number(g.monto), 0)).toBeCloseTo(200, 2);
  });

  it('A pasa a ser dueño único y rinde otro mes: NO se le vuelve a cobrar el arreglo', async () => {
    // Sale B, A queda al 100% — el flujo real de una venta o una corrección del reparto.
    await prisma.participacionPropietario.deleteMany({
      where: { propiedadId: `${P}prop`, propietarioId: `${P}ownB` },
    });
    await prisma.participacionPropietario.updateMany({
      where: { propiedadId: `${P}prop`, propietarioId: `${P}ownA` }, data: { porcentaje: 100 },
    });

    const res = await app.inject({
      method: 'POST', url: '/rendiciones', headers: auth(token),
      payload: { propietarioId: `${P}ownA`, periodo: SIG, metodo: 'TRANSFERENCIA' },
    });
    expect(res.statusCode).toBe(201);
    // EL BUG: a A "le tocaba" 200 y sólo tenía 100 rendido → se le cobraban 100 más,
    // sobre un arreglo de 200 que ya estaba pagado entero. Total recaudado: 300.
    expect(Number(res.json().totalGastos)).toBe(0);
  });

  it('entre todos los dueños nunca se recauda más que el costo del arreglo', async () => {
    const partes = await prisma.gastoRendido.findMany({ where: { refId: refRec(), tipo: 'TRABAJO' } });
    expect(partes.reduce((a, g) => a + Number(g.monto), 0)).toBeCloseTo(200, 2);
  });
});

/**
 * Un dueño que cobra en pesos Y en dólares el mismo mes quedaba trabado.
 *
 * La rendición guarda UN monto, así que exige una sola moneda y respondía 409 diciendo
 * "rendí cada moneda por separado" — pero POST /rendiciones no aceptaba ningún parámetro
 * de moneda. La instrucción era imposible de ejecutar. Peor: como el chequeo mira TODAS
 * las liquidaciones cobradas del período (incluidas las ya rendidas), la moneda que se
 * llegó a rendir seguía envenenando el intento siguiente. Resultado: por período se
 * rendía como máximo UNA de las dos —la que cobró primero— y la otra no salía nunca.
 */
describe('Dueño con cobros en dos monedas: se rinde una por vez', () => {
  const PERIODO = '2026-11';

  beforeAll(async () => {
    // Segunda propiedad del MISMO dueño, con contrato en dólares (una liquidación por
    // contrato+período, así que la mezcla necesita dos contratos).
    await prisma.propiedad.create({
      data: {
        id: `${P}prop2`, inmobiliariaId, direccion: 'Multi-moneda 456',
        ciudad: 'CABA', provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO',
      },
    });
    await prisma.participacionPropietario.create({
      data: { inmobiliariaId, propiedadId: `${P}prop2`, propietarioId: `${P}ownA`, porcentaje: 100 },
    });
    await prisma.contrato.create({
      data: {
        id: `${P}cnt2`, inmobiliariaId, propiedadId: `${P}prop2`, monto: 500,
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2027-01-01T00:00:00.000Z'),
        diaPago: 10, indiceAjuste: 'ICL', frecuenciaAjusteMeses: 12,
        estado: 'ACTIVO', modoCobranza: 'INMOBILIARIA', moneda: 'USD',
      },
    });
    for (const [cnt, moneda, monto] of [
      [`${P}cnt`, 'ARS', 1000],
      [`${P}cnt2`, 'USD', 500],
    ] as const) {
      const liqId = `${P}liq7${moneda}`;
      await prisma.liquidacion.create({
        data: {
          id: liqId, inmobiliariaId, contratoId: cnt, periodo: PERIODO,
          montoAlquiler: monto, montoTotal: monto,
          fechaVencimiento: new Date('2026-11-10T00:00:00.000Z'), estado: 'PAGADO', moneda,
        },
      });
      await prisma.pago.create({
        data: {
          id: `${P}pago7${moneda}`, inmobiliariaId, contratoId: cnt, liquidacionId: liqId,
          periodo: PERIODO, tipo: 'TOTAL', monto, montoLiqTotal: monto, metodo: 'TRANSFERENCIA',
          fechaTransferencia: new Date('2026-11-05T00:00:00.000Z'), estado: 'CONCILIADO',
        },
      });
    }
  });

  const rendir = (moneda?: 'ARS' | 'USD') =>
    app.inject({
      method: 'POST', url: '/rendiciones', headers: auth(token),
      payload: { propietarioId: `${P}ownA`, periodo: PERIODO, metodo: 'TRANSFERENCIA', ...(moneda ? { moneda } : {}) },
    });

  it('sin elegir moneda → 409, y ahora dice cuáles hay', async () => {
    const res = await rendir();
    expect(res.statusCode).toBe(409);
    expect(res.json().monedas.sort()).toEqual(['ARS', 'USD']);
  });

  it('eligiendo ARS rinde SOLO lo cobrado en pesos', async () => {
    const res = await rendir('ARS');
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().montoBruto)).toBe(1000); // no 1500: el USD no entra
  });

  it('y después la de dólares TAMBIÉN sale (antes quedaba trabada para siempre)', async () => {
    const res = await rendir('USD');
    expect(res.statusCode).toBe(201);
    // EL BUG: la liq ARS ya rendida seguía contando en el chequeo de monedas → 409 eterno.
    expect(Number(res.json().montoBruto)).toBe(500);
  });

  it('las dos rendiciones existen, cada una con su moneda', async () => {
    const rends = await prisma.rendicion.findMany({
      where: { propietarioId: `${P}ownA`, periodo: PERIODO }, orderBy: { montoBruto: 'desc' },
    });
    expect(rends).toHaveLength(2);
    expect(rends.map((r) => Number(r.montoBruto))).toEqual([1000, 500]);
  });
});
