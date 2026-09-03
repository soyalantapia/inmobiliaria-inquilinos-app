/**
 * El reporte de cobranzas del mes pintaba los dólares como pesos.
 *
 * `GET /pagos` devuelve cada pago con su liquidación, pero la liquidación viajaba **sin
 * moneda**: el handler la rearma campo por campo y ese no estaba ni en el `select`. El panel,
 * que no tenía de dónde sacarla, imprimía `formatMonto(p.monto)` — y el default de esa función
 * es ARS. Un pago de US$ 2.000 salía «$ 2.000» en el PDF que la inmobiliaria imprime y firma,
 * y el «Total cobrado» del pie sumaba pesos con dólares en un número que no existe.
 *
 * POR QUÉ LA MONEDA SALE DE LA LIQUIDACIÓN Y NO DEL CONTRATO. Porque la liq **congela** la del
 * período. Lo dice el propio `plata.ts` donde arma el asiento de auditoría:
 *
 * > «Va de la liquidación y no del contrato a propósito: la liq CONGELA la moneda del período,
 * > así que si el contrato cambia de moneda después, los renglones viejos siguen diciendo la
 * > verdad.»
 *
 * Un contrato que pasa de dólares a pesos no puede reescribir lo que se cobró el año pasado.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 'pvm-';
const ALQ_USD = 2_000;

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
let inmobiliariaId = '';
let pagoId = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar(): Promise<void> {
  await prisma.pago.deleteMany({ where: { contratoId: `${P}usd` } });
  await prisma.liquidacion.deleteMany({ where: { contratoId: `${P}usd` } });
  await prisma.eventoContrato.deleteMany({ where: { contratoId: `${P}usd` } });
  await prisma.propiedad.updateMany({ where: { id: `${P}prop` }, data: { contratoActualId: null } });
  await prisma.contrato.deleteMany({ where: { id: `${P}usd` } });
  await prisma.propiedad.deleteMany({ where: { id: `${P}prop` } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  inmobiliariaId = (await seedBase(prisma)).inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');

  await prisma.propiedad.create({
    data: {
      id: `${P}prop`,
      inmobiliariaId,
      direccion: 'Dólares 200',
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
    },
  });
  await prisma.contrato.create({
    data: {
      id: `${P}usd`,
      inmobiliariaId,
      propiedadId: `${P}prop`,
      estado: 'ACTIVO',
      modoCobranza: 'INMOBILIARIA',
      monto: ALQ_USD,
      moneda: 'USD',
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2027-12-31'),
      diaPago: 5,
      indiceAjuste: 'FIJO',
      frecuenciaAjusteMeses: 12,
      tipoContrato: 'ALQUILER',
    },
  });
  const liq = await prisma.liquidacion.create({
    data: {
      inmobiliariaId,
      contratoId: `${P}usd`,
      periodo: '2026-07',
      montoAlquiler: ALQ_USD,
      montoTotal: ALQ_USD,
      moneda: 'USD',
      fechaVencimiento: new Date('2026-07-05'),
      estado: 'PAGADO',
    },
  });
  const pago = await prisma.pago.create({
    data: {
      inmobiliariaId,
      contratoId: `${P}usd`,
      liquidacionId: liq.id,
      periodo: '2026-07',
      tipo: 'TOTAL',
      monto: ALQ_USD,
      metodo: 'TRANSFERENCIA',
      estado: 'CONCILIADO',
      fechaTransferencia: new Date('2026-07-03'),
    },
  });
  pagoId = pago.id;
});

afterAll(async () => {
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

type PagoDeLaLista = {
  id: string;
  monto: string | number;
  contrato: { moneda?: string } | null;
  liquidacion: { moneda?: string };
};

const listar = async (): Promise<PagoDeLaLista[]> => {
  const r = await app.inject({ method: 'GET', url: '/pagos', headers: auth(token) });
  expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
  return r.json() as PagoDeLaLista[];
};

describe('un pago viaja con la moneda de su liquidación', () => {
  it('el escenario se armó de verdad: hay un pago conciliado en dólares', async () => {
    const p = (await listar()).find((x) => x.id === pagoId);
    expect(p, 'no vino el pago del fixture').toBeTruthy();
    expect(Number(p!.monto)).toBe(ALQ_USD);
  });

  it('🔴 la liquidación del pago dice USD', async () => {
    const p = (await listar()).find((x) => x.id === pagoId);
    // Con el bug: `undefined` — el campo no estaba ni en el select. El panel caía al
    // default de `formatMonto` y escribía «$ 2.000» en el PDF de cobranzas.
    expect(p!.liquidacion.moneda).toBe('USD');
  });

  it('los pagos en pesos del seed siguen diciendo ARS', async () => {
    // CONTROL POSITIVO: que no se haya puesto 'USD' fijo en ningún lado.
    const otros = (await listar()).filter((x) => x.id !== pagoId);
    expect(otros.length, 'el seed no trajo otros pagos').toBeGreaterThan(0);
    expect(otros.every((x) => x.liquidacion.moneda === 'ARS')).toBe(true);
  });
});
