import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P1 — en la rendición al propietario, el costo de un reclamo a cargo del
// PROPIETARIO se deduplicaba por EXISTENCIA global del refId (reclamo:<id>): apenas UN
// co-dueño lo rendía, el reclamo quedaba excluido para TODOS los demás → los otros
// co-dueños nunca recibían el descuento de SU parte y la inmobiliaria se comía la
// diferencia. Fix: dedup por (dueño, reclamo) — cada co-dueño recibe su parte una vez.

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let tid = '';
const PERIODO = '2099-05';
const LIQ = 'ZZ-cazabug-B-liq';
const OWNER_A = 'own_001'; // 60% de prp_001
const OWNER_B = 'own_002'; // 40% de prp_001
let reclamoId = '';
let refId = '';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const rendir = (propietarioId: string) =>
  app.inject({ method: 'POST', url: '/rendiciones', headers: auth(tADMIN), payload: { propietarioId, periodo: PERIODO } });

async function limpiar() {
  const rends = await prisma.rendicion.findMany({ where: { periodo: PERIODO, propietarioId: { in: [OWNER_A, OWNER_B] } }, select: { id: true } });
  const rendIds = rends.map((r) => r.id);
  if (rendIds.length) {
    await prisma.gastoRendido.deleteMany({ where: { rendicionId: { in: rendIds } } });
    await prisma.alquilerRendido.deleteMany({ where: { rendicionId: { in: rendIds } } });
    await prisma.ingresoRendido.deleteMany({ where: { rendicionId: { in: rendIds } } });
    await prisma.rendicion.deleteMany({ where: { id: { in: rendIds } } });
  }
  if (reclamoId) await prisma.reclamo.deleteMany({ where: { id: reclamoId } });
  await prisma.pago.deleteMany({ where: { liquidacionId: LIQ } });
  await prisma.liquidacion.deleteMany({ where: { id: LIQ } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  await limpiar();
  // Ambos co-dueños necesitan CBU para poder rendir (guard 409). En la DB compartida el
  // alias puede quedar nulo por otra sesión, así que lo aseguramos.
  await prisma.propietario.update({ where: { id: OWNER_A }, data: { cbuAlias: 'castro.eduardo.cuenta' } });
  await prisma.propietario.update({ where: { id: OWNER_B }, data: { cbuAlias: 'morales.silvana.mp' } });
  // Cuota de prp_001 (multi-dueño 60/40) COBRADA en el período (pago CONCILIADO).
  await prisma.liquidacion.create({
    data: {
      id: LIQ, inmobiliariaId: tid, contratoId: 'cnt_001', periodo: PERIODO,
      montoAlquiler: 480000, montoExpensas: null, montoTotal: 480000,
      fechaVencimiento: new Date('2099-05-05'), estado: 'PAGADO', moneda: 'ARS',
    },
  });
  await prisma.pago.create({
    data: {
      inmobiliariaId: tid, contratoId: 'cnt_001', liquidacionId: LIQ, periodo: PERIODO,
      tipo: 'TOTAL', monto: 480000, montoLiqTotal: 480000, metodo: 'TRANSFERENCIA',
      fechaTransferencia: new Date('2099-05-04'), estado: 'CONCILIADO', condonado: false,
    },
  });
  // Reclamo a cargo del PROPIETARIO, resuelto dentro del período, $1000 de trabajo.
  const rec = await prisma.reclamo.create({
    data: {
      inmobiliariaId: tid, contratoId: 'cnt_001', propiedadId: 'prp_001',
      categoria: 'PLOMERIA', urgencia: 'MEDIA', descripcion: 'Reparación de caño (cazabug multi-dueño)',
      estado: 'RESUELTO', pagador: 'PROPIETARIO', costoTrabajo: 1000, resueltoAt: new Date('2099-05-15'),
    },
  });
  reclamoId = rec.id;
  refId = `reclamo:${rec.id}`;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tADMIN = login.json().token;
});

afterAll(async () => {
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — reclamo multi-dueño: cada co-dueño recibe su parte', () => {
  it('rendir al dueño A (60%) descuenta $600 del reclamo', async () => {
    const r = await rendir(OWNER_A);
    expect(r.statusCode).toBe(201);
    const g = await prisma.gastoRendido.findFirst({ where: { refId, tipo: 'TRABAJO', rendicion: { propietarioId: OWNER_A } } });
    expect(g).not.toBeNull();
    expect(Number(g!.monto)).toBeCloseTo(600, 2);
  });

  it('rendir al dueño B (40%) TAMBIÉN descuenta su parte $400 (no lo excluye el dedup)', async () => {
    const r = await rendir(OWNER_B);
    expect(r.statusCode).toBe(201);
    const g = await prisma.gastoRendido.findFirst({ where: { refId, tipo: 'TRABAJO', rendicion: { propietarioId: OWNER_B } } });
    expect(g).not.toBeNull(); // con el bug: null (excluido por dedup binario global)
    expect(Number(g!.monto)).toBeCloseTo(400, 2);
  });

  it('en total el reclamo se rindió exactamente una vez por dueño (2 filas, suma $1000)', async () => {
    const gs = await prisma.gastoRendido.findMany({ where: { refId, tipo: 'TRABAJO' } });
    expect(gs.length).toBe(2);
    const suma = gs.reduce((a, g) => a + Number(g.monto), 0);
    expect(suma).toBeCloseTo(1000, 2);
  });
});
