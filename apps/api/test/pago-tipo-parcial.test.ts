import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

/**
 * CAZABUG — un cobro que NO cubre la cuota quedaba etiquetado `tipo: TOTAL`.
 *
 * `Pago.tipo` tenía `@default(TOTAL)` en el schema y cuatro de los seis caminos
 * que crean pagos no lo pasaban: heredaban TOTAL sin decidir nada. El campo no
 * es decorativo — es lo único que mira el front para marcar "· pago parcial" en
 * el comprobante del inquilino y en la fila del panel. Un cobro parcial se le
 * mostraba al inquilino como comprobante liso: creía estar al día debiendo.
 *
 * Se ejercita el camino del depósito (el más barato de armar de punta a punta);
 * los otros quedan blindados por el compilador: se sacó el default del schema,
 * así que crear un Pago sin decir el tipo ya no compila.
 */

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
let tid = '';
const CID = 'cnt_004';
const LIQ_A = 'ZZ-tipo-a';
const LIQ_B = 'ZZ-tipo-b';
const auth = () => ({ authorization: `Bearer ${token}` });

async function limpiar() {
  const ids = [LIQ_A, LIQ_B];
  await prisma.pago.deleteMany({ where: { liquidacionId: { in: ids } } });
  await prisma.liquidacion.deleteMany({ where: { id: { in: ids } } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  await limpiar();
  await prisma.cargoContrato.deleteMany({ where: { contratoId: CID, contraDeposito: true } });
  // Depósito de $50.000 contra una deuda de $70.000: alcanza para la primera
  // cuota entera y deja la segunda a medias — ahí es donde vive el bug.
  await prisma.contrato.updateMany({
    where: { id: CID },
    data: {
      estado: 'FINALIZADO', estadoDeposito: 'RETENIDO', depositoGarantia: 50000,
      depositoDevueltoMonto: null, depositoDevueltoAt: null,
      moraTipo: 'SIN_MORA', moraValor: null, tasaPunitorioDiaria: null,
    },
  });
  const crear = (id: string, periodo: string, venc: string, monto: number) =>
    prisma.liquidacion.create({
      data: {
        id, inmobiliariaId: tid, contratoId: CID, periodo,
        montoAlquiler: monto, montoExpensas: null, montoTotal: monto,
        fechaVencimiento: new Date(venc), estado: 'VENCIDO', moneda: 'ARS',
      },
    });
  await crear(LIQ_A, '2024-03', '2024-03-05', 40000);
  await crear(LIQ_B, '2024-04', '2024-04-05', 30000);

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
}, 420_000);

afterAll(async () => {
  await limpiar();
  await prisma.contrato.updateMany({
    where: { id: CID },
    data: { estado: 'ACTIVO', estadoDeposito: 'RETENIDO', depositoGarantia: null, depositoDevueltoMonto: null, depositoDevueltoAt: null },
  });
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('el tipo del pago dice la verdad sobre si cubrió la cuota', () => {
  it('el depósito se imputa: la primera cuota entera, la segunda a medias', async () => {
    const r = await app.inject({
      method: 'POST', url: `/contratos/${CID}/deposito/resolver`, headers: auth(),
      payload: { decision: 'EJECUTAR', montoDevuelto: 0, motivo: 'Deuda impaga (cazabug tipo)' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().depositoAplicadoADeuda).toBe(50000);

    expect((await prisma.liquidacion.findUniqueOrThrow({ where: { id: LIQ_A } })).estado).toBe('PAGADO');
    expect((await prisma.liquidacion.findUniqueOrThrow({ where: { id: LIQ_B } })).estado).toBe('PARCIAL');
  });

  it('el cobro que CUBRIÓ la cuota es TOTAL', async () => {
    const pago = await prisma.pago.findFirstOrThrow({ where: { liquidacionId: LIQ_A, estado: 'CONCILIADO' } });
    expect(Number(pago.monto)).toBe(40000);
    expect(pago.tipo).toBe('TOTAL');
  });

  it('el que NO la cubrió es PARCIAL (antes heredaba TOTAL del default del schema)', async () => {
    const pago = await prisma.pago.findFirstOrThrow({ where: { liquidacionId: LIQ_B, estado: 'CONCILIADO' } });
    expect(Number(pago.monto)).toBe(10000); // $50.000 − $40.000
    expect(pago.tipo).toBe('PARCIAL');
  });
});
