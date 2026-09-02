/**
 * T-28 · Los dos guards que deciden si la plata del banco puede saldar ESA cuota.
 *
 * `POST /resumenes-bancarios/:id/creditos/:creditoId/conciliar` crea un `Pago` **CONCILIADO**
 * por el monto del crédito bancario y marca la liquidación PAGADO/PARCIAL. Ese pago entra al
 * cierre de caja con comisión y arma rendición pendiente al propietario: es plata que se
 * transfiere de verdad.
 *
 * Dos guards lo custodian, y **ninguno de los dos estaba probado en su rama de rechazo**. El
 * único test que pega al endpoint —`conciliar-informado-huerfano.test.ts`— arma su fixture con
 * `moneda: 'ARS'` sobre `cnt_001`, que en el seed no declara `modoCobranza` y cae en el default
 * INMOBILIARIA. O sea: los dos guards se ejercitaban **sólo en su rama "pasa"**. Borrarlos
 * enteros dejaba la suite verde.
 *
 * QUÉ CUSTODIAN, que es por qué vale escribir esto:
 *
 *  · **MONEDA.** El extracto bancario **no declara en qué moneda está**. Sin el guard, un
 *    crédito de $500.000 cancela una liquidación de **USD 500.000 a 1:1**: el inquilino queda
 *    al día habiendo pagado ~1/1000 de lo que debe, la liq va a PAGADO, y esa diferencia se le
 *    rinde al dueño como si hubiera entrado. Las dos pantallas dicen PAGADO.
 *  · **modoCobranza.** En cobranza directa el inquilino le transfiere **al dueño**; la
 *    inmobiliaria no recibió nada. Sin el guard, un crédito cualquiera del extracto salda esa
 *    cuota, entra al arqueo con comisión y genera rendición: la inmo le transfiere al
 *    propietario plata que nunca tuvo, y el dueño ya la había cobrado él.
 *
 * LO QUE ESTE ARCHIVO FIJA no es el 409: es que **no se movió nada**. Un guard que rechaza pero
 * deja el pago creado sería peor que no tenerlo, y el status code solo no lo distingue.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): sacando el guard de moneda, el caso USD
 * devuelve 200 y queda un Pago CONCILIADO de $500.000 contra una deuda de USD 500.000. Sacando
 * el de modoCobranza, el caso de cobranza directa hace lo mismo.
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
let token = '';
let inmobiliariaId = '';
const prisma = new PrismaClient();

/** Prefijo propio: esta base la comparten 140 archivos. */
const P = 'cred_';
const auth = () => ({ authorization: `Bearer ${token}` });

/** El contrato de cobranza directa del seed — el único con `PROPIETARIO_DIRECTO`. */
const CNT_DIRECTO = 'cnt_005';
/** El normal, por cuenta recaudadora. */
const CNT_INMO = 'cnt_001';
const PERIODO = '2098-11';

async function limpiar() {
  // Los pagos por liquidacionId y no por prefijo: la conciliación crea un pago con id
  // autogenerado que igual cuelga de la liquidación, y la FK es RESTRICT.
  await prisma.creditoDetectado.deleteMany({ where: { resumenBancarioId: { startsWith: P } } });
  await prisma.resumenBancario.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.pago.deleteMany({ where: { liquidacionId: { startsWith: P } } });
  await prisma.alquilerRendido.deleteMany({ where: { liquidacionId: { startsWith: P } } });
  await prisma.liquidacion.deleteMany({ where: { id: { startsWith: P } } });
}

/**
 * Una liquidación con saldo y un crédito bancario listo para conciliarse contra ella.
 * El período es 2098 a propósito: nadie más lo devenga, así que el `@@unique([contratoId,
 * periodo])` no choca con el cron ni con otro archivo.
 */
async function armar(opts: { contratoId: string; moneda: 'ARS' | 'USD'; monto: number }) {
  await limpiar();
  await prisma.liquidacion.create({
    data: {
      id: `${P}liq`,
      inmobiliariaId,
      contratoId: opts.contratoId,
      periodo: PERIODO,
      montoAlquiler: opts.monto,
      montoTotal: opts.monto,
      fechaVencimiento: new Date('2098-11-10T00:00:00.000Z'),
      estado: 'PENDIENTE',
      moneda: opts.moneda,
    },
  });
  await prisma.resumenBancario.create({
    data: { id: `${P}res`, inmobiliariaId, fileName: `${P}extracto.csv`, fileSize: 1024, subidoPor: 'test' },
  });
  await prisma.creditoDetectado.create({
    data: {
      id: `${P}credito`,
      inmobiliariaId,
      resumenBancarioId: `${P}res`,
      fecha: new Date('2098-11-06T00:00:00.000Z'),
      // Siempre PESOS: es lo único que un extracto puede traer, y ahí está el problema.
      monto: 500_000,
      concepto: 'TRANSFERENCIA RECIBIDA',
      titularOrigen: 'Alguien',
      nroOperacion: `${P}999`,
      bancoOrigen: 'Test',
    },
  });
}

const conciliar = () =>
  app.inject({
    method: 'POST',
    url: `/resumenes-bancarios/${P}res/creditos/${P}credito/conciliar`,
    headers: auth(),
    payload: { liquidacionId: `${P}liq` },
  });

/** Lo que tiene que seguir siendo verdad después de un rechazo: NADA se movió. */
async function nadaSeMovio() {
  const liq = await prisma.liquidacion.findUniqueOrThrow({ where: { id: `${P}liq` } });
  const pagos = await prisma.pago.count({ where: { liquidacionId: `${P}liq` } });
  const credito = await prisma.creditoDetectado.findUniqueOrThrow({ where: { id: `${P}credito` } });
  return { estado: liq.estado, fechaPago: liq.fechaPago, pagos, conciliado: credito.conciliado, pagoId: credito.pagoId };
}

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
}, 420_000);

afterAll(async () => {
  // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('un crédito del extracto no salda una deuda en dólares', () => {
  it('rechaza con 409 y dice por qué', async () => {
    await armar({ contratoId: CNT_INMO, moneda: 'USD', monto: 500_000 });
    const r = await conciliar();
    // Con el bug: 200, y $500.000 cancelaban USD 500.000.
    expect(r.statusCode).toBe(409);
    expect(r.json().message).toMatch(/no declara moneda/i);
    expect(r.json().message).toMatch(/USD/);
  });

  it('y no se movió NADA: ni pago, ni estado, ni el crédito', async () => {
    const d = await nadaSeMovio();
    expect(d.pagos).toBe(0);
    expect(d.estado).toBe('PENDIENTE');
    expect(d.fechaPago).toBeNull();
    expect(d.conciliado).toBe(false);
    expect(d.pagoId).toBeNull();
  });
});

describe('ni una cuota de un contrato que cobra directo al propietario', () => {
  it('rechaza con 409 y dice por qué', async () => {
    await armar({ contratoId: CNT_DIRECTO, moneda: 'ARS', monto: 500_000 });
    const r = await conciliar();
    // Con el bug: 200. La inmo le rendía al dueño plata que nunca tuvo, y el dueño ya la
    // había cobrado él directo del inquilino.
    expect(r.statusCode).toBe(409);
    expect(r.json().message).toMatch(/cobra directo al propietario/i);
  });

  it('y tampoco se movió nada', async () => {
    const d = await nadaSeMovio();
    expect(d.pagos).toBe(0);
    expect(d.estado).toBe('PENDIENTE');
    expect(d.conciliado).toBe(false);
  });
});

describe('CONTROL POSITIVO — en pesos y por cuenta recaudadora sí concilia', () => {
  it('crea el pago CONCILIADO y deja la liquidación paga', async () => {
    // Sin este caso, los dos de arriba pasarían igual con un endpoint que rechaza todo.
    await armar({ contratoId: CNT_INMO, moneda: 'ARS', monto: 500_000 });
    const r = await conciliar();
    expect([200, 201]).toContain(r.statusCode);

    const pagos = await prisma.pago.findMany({ where: { liquidacionId: `${P}liq` } });
    expect(pagos).toHaveLength(1);
    expect(pagos[0]?.estado).toBe('CONCILIADO');
    expect(Number(pagos[0]?.monto)).toBe(500_000);

    const liq = await prisma.liquidacion.findUniqueOrThrow({ where: { id: `${P}liq` } });
    expect(liq.estado).toBe('PAGADO');

    const credito = await prisma.creditoDetectado.findUniqueOrThrow({ where: { id: `${P}credito` } });
    expect(credito.conciliado).toBe(true);
    expect(credito.pagoId).toBe(pagos[0]?.id);
  });
});
