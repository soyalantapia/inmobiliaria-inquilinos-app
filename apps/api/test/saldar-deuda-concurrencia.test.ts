import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

// CAZABUG P1 — POST /contratos/:id/saldar-deuda leía la suma de conciliados FUERA de
// la tx (montoPagadoPorLiquidacion) y creaba el Pago CONCILIADO sin lockear la liq:
// dos requests concurrentes veían el mismo saldo y creaban DOS Pago CONCILIADO por la
// misma deuda → doble-cobro (infla caja, comisión, rendición y el saldo del inquilino).
// Fix: FOR UPDATE + re-agregado DENTRO de la tx (patrón /pagos/manual). Bajo el fix, N
// requests concurrentes producen EXACTAMENTE 1 pago por cuota.

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let tid = '';
const CID = 'cnt_003';
const LIQ = 'ZZ-cazabug-saldar-conc';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar() {
  await prisma.pago.deleteMany({ where: { liquidacionId: LIQ } });
  await prisma.liquidacion.deleteMany({ where: { id: LIQ } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  await limpiar();
  await prisma.contrato.updateMany({ where: { id: CID }, data: { estado: 'ACTIVO' } });
  // Cuota VENCIDA (vencimiento pasado, sin pagos) exclusiva de este test.
  await prisma.liquidacion.create({
    data: {
      id: LIQ, inmobiliariaId: tid, contratoId: CID, periodo: '2024-03',
      montoAlquiler: 90000, montoExpensas: null, montoTotal: 90000,
      fechaVencimiento: new Date('2024-03-05'), estado: 'VENCIDO', moneda: 'ARS',
    },
  });
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tADMIN = await loginTest(app, 'roberto@delsol.com', 'delsol123');
});

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — saldar-deuda no duplica el cobro bajo concurrencia', () => {
  it('5 saldar-deuda concurrentes crean UN solo pago CONCILIADO para la cuota', async () => {
    const saldar = () => app.inject({ method: 'POST', url: `/contratos/${CID}/saldar-deuda`, headers: auth(tADMIN), payload: {} });
    const rs = await Promise.all([saldar(), saldar(), saldar(), saldar(), saldar()]);
    // Todas responden 200 (idempotentes): la 1ª salda, las demás ven saldo 0 y no duplican.
    for (const r of rs) expect(r.statusCode).toBe(200);

    const pagos = await prisma.pago.findMany({ where: { liquidacionId: LIQ, estado: 'CONCILIADO' } });
    expect(pagos.length).toBe(1); // <- con el bug, la carrera crea hasta 5

    const liq = await prisma.liquidacion.findUniqueOrThrow({ where: { id: LIQ } });
    expect(liq.estado).toBe('PAGADO');
    // El único pago cubre exactamente el saldo exigible (no un múltiplo).
    expect(Number(pagos[0]!.monto)).toBeGreaterThanOrEqual(90000);
  });
});
