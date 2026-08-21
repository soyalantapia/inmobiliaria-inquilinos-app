import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

// CAZABUG P3 — el monto de un pago se guardaba CRUDO (sin redondear a centavos):
// un sub-centavo (0.004) pasaba `.positive()` y se persistía 0.00 (pago fantasma),
// y un 100.006 se guardaba 100.01 dejando el pago por encima del saldo. El fix
// redondea el monto en el schema (montoCents) antes del guard/tipo/create.

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let tid = '';
const LIQ = 'ZZ-cazabug-centavos';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const cobrar = (monto: number) =>
  app.inject({
    method: 'POST',
    url: '/pagos/manual',
    headers: auth(tADMIN),
    payload: { liquidacionId: LIQ, monto, metodo: 'EFECTIVO', fecha: new Date().toISOString().slice(0, 10) },
  });

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
  // La DB de test es compartida (varias sesiones): aseguramos cnt_001 ACTIVO.
  await prisma.contrato.updateMany({ where: { id: 'cnt_001' }, data: { estado: 'ACTIVO' } });
  await prisma.propiedad.updateMany({ where: { id: 'prp_001' }, data: { estado: 'ALQUILADA', contratoActualId: 'cnt_001' } });
  await prisma.liquidacion.create({
    data: {
      id: LIQ, inmobiliariaId: tid, contratoId: 'cnt_001', periodo: '2099-01',
      montoAlquiler: 100000, montoExpensas: null, montoTotal: 100000,
      fechaVencimiento: new Date('2099-01-05'), estado: 'PENDIENTE', moneda: 'ARS',
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

describe('CAZABUG — monto de pago redondeado a centavos', () => {
  it('un monto sub-centavo (0.004) se rechaza (no se guarda pago de $0)', async () => {
    const r = await cobrar(0.004);
    expect(r.statusCode).toBe(400);
    const pagos = await prisma.pago.count({ where: { liquidacionId: LIQ } });
    expect(pagos).toBe(0); // no quedó un pago fantasma
  });

  it('un monto con >2 decimales (100.006) se guarda redondeado a 100.01', async () => {
    const r = await cobrar(100.006);
    expect(r.statusCode).toBe(201);
    const pago = await prisma.pago.findFirstOrThrow({ where: { liquidacionId: LIQ }, orderBy: { informadoAt: 'desc' } });
    expect(Number(pago.monto)).toBe(100.01);
  });

  it('un monto normal sigue andando (50000 → PARCIAL)', async () => {
    const r = await cobrar(50000);
    expect(r.statusCode).toBe(201);
    expect(r.json().tipo).toBe('PARCIAL');
    expect(Number(r.json().monto)).toBe(50000);
  });
});
