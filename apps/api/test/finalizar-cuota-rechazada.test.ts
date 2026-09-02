import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

// CAZABUG P1 — al finalizar un contrato, el deleteMany de cuotas futuras impagas
// usaba `pagos: { none: {} }` para "proteger un pago en vuelo", pero eso también
// protegía cuotas cuyo único pago está RECHAZADO (un pago MUERTO). Resultado: la
// cuota futura queda viva = deuda fantasma cobrable. El fix protege sólo si hay un
// pago INFORMADO o CONCILIADO (vivo).

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let tid = '';
const CID = 'cnt_002';
const LIQ_RECH = 'ZZ-cazabug-rech';
const LIQ_CONC = 'ZZ-cazabug-conc';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar() {
  await prisma.pago.deleteMany({ where: { liquidacionId: { in: [LIQ_RECH, LIQ_CONC] } } });
  await prisma.liquidacion.deleteMany({ where: { id: { in: [LIQ_RECH, LIQ_CONC] } } });
}
async function reactivar() {
  await prisma.contrato.updateMany({ where: { id: CID }, data: { estado: 'ACTIVO' } });
}

async function crearCuotaFutura(id: string, periodo: string, estadoPago: 'RECHAZADO' | 'CONCILIADO') {
  await prisma.liquidacion.create({
    data: {
      id, inmobiliariaId: tid, contratoId: CID, periodo,
      montoAlquiler: 620000, montoExpensas: null, montoTotal: 620000,
      fechaVencimiento: new Date('2099-06-10'), estado: 'PENDIENTE', moneda: 'ARS',
    },
  });
  await prisma.pago.create({
    data: {
      inmobiliariaId: tid, contratoId: CID, liquidacionId: id, periodo,
      tipo: 'TOTAL', monto: 620000, montoLiqTotal: 620000, metodo: 'TRANSFERENCIA',
      fechaTransferencia: new Date(), estado: estadoPago,
    },
  });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  await limpiar();
  await reactivar();
  await crearCuotaFutura(LIQ_RECH, '2099-06', 'RECHAZADO');
  await crearCuotaFutura(LIQ_CONC, '2099-07', 'CONCILIADO');
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tADMIN = await loginTest(app, 'roberto@delsol.com', 'delsol123');
});

afterAll(async () => {
  await limpiar();
  await reactivar();
  await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — finalizar anula cuotas futuras con pago RECHAZADO', () => {
  it('finaliza el contrato (200)', async () => {
    const r = await app.inject({ method: 'POST', url: `/contratos/${CID}/finalizar`, headers: auth(tADMIN) });
    expect(r.statusCode).toBe(200);
  });
  it('la cuota futura con pago RECHAZADO se ANULA (no queda deuda fantasma)', async () => {
    const liq = await prisma.liquidacion.findUnique({ where: { id: LIQ_RECH } });
    expect(liq).toBeNull();
  });
  it('la cuota futura con pago CONCILIADO SÍ se conserva (pago vivo)', async () => {
    const liq = await prisma.liquidacion.findUnique({ where: { id: LIQ_CONC } });
    expect(liq).not.toBeNull();
  });
});
