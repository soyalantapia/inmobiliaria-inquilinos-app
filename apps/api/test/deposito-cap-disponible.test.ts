import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

// CAZABUG P1 — POST /contratos/:id/deposito/resolver capeaba montoDevuelto contra el
// BRUTO del depósito, ignorando las reparaciones ya imputadas contra él (CargoContrato
// contraDeposito). Se le devolvía al inquilino plata ya deducida por daños → doble pago.
// Fix: disponible = max(0, depósito − Σ contraDeposito), igual que /depositos/en-custodia.

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let tid = '';
const CID = 'cnt_004';
const CARGO = 'ZZ-cazabug-cargo-deposito';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const resolver = (montoDevuelto: number) =>
  app.inject({ method: 'POST', url: `/contratos/${CID}/deposito/resolver`, headers: auth(tADMIN), payload: { decision: 'DEVOLVER', montoDevuelto } });

async function limpiar() {
  await prisma.cargoContrato.deleteMany({ where: { id: CARGO } });
}
async function reset() {
  await prisma.contrato.updateMany({
    where: { id: CID },
    // estadoDeposito es NO-NULLABLE (@default(RETENIDO)) desde el refactor "una sola
    // cuenta del depósito": el reset lo devuelve a RETENIDO, no a null.
    data: { estado: 'ACTIVO', estadoDeposito: 'RETENIDO', depositoGarantia: null, depositoDevueltoMonto: null, depositoDevueltoAt: null, motivoDeposito: null },
  });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  await limpiar();
  // Contrato terminado con depósito RETENIDO $100.000 y una reparación de $40.000
  // imputada contra el depósito → disponible real a devolver = $60.000.
  await prisma.contrato.updateMany({
    where: { id: CID },
    data: { estado: 'FINALIZADO', estadoDeposito: 'RETENIDO', depositoGarantia: 100000, depositoDevueltoMonto: null, depositoDevueltoAt: null },
  });
  await prisma.cargoContrato.create({
    data: { id: CARGO, inmobiliariaId: tid, contratoId: CID, tipo: 'REPARACION', concepto: 'Reparación imputada al depósito (cazabug)', monto: 40000, moneda: 'ARS', contraDeposito: true },
  });
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tADMIN = await loginTest(app, 'roberto@delsol.com', 'delsol123');
});

afterAll(async () => {
  await limpiar();
  await reset();
  await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — depósito capea contra lo disponible, no el bruto', () => {
  it('devolver más que el disponible ($60k) se rechaza aunque sea ≤ bruto ($100k)', async () => {
    const r = await resolver(100000);
    expect(r.statusCode).toBe(400); // con el bug: 200 (100000 <= 100000 bruto)
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: CID } });
    expect(c.estadoDeposito).toBe('RETENIDO'); // no se resolvió
  });

  it('devolver exactamente el disponible ($60k) pasa', async () => {
    const r = await resolver(60000);
    expect(r.statusCode).toBe(200);
    expect(r.json().estadoDeposito).toBe('DEVUELTO');
    expect(Number(r.json().depositoDevueltoMonto)).toBe(60000);
  });
});
