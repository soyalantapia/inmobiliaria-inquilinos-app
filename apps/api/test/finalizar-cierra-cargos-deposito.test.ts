/**
 * T-66 · Finalizar un contrato resolvía el depósito y dejaba sus cargos huérfanos.
 *
 * DOS DEFECTOS LIGADOS, los dos por no replicar lo que `POST /contratos/:id/deposito/resolver`
 * ya hacía:
 *
 *  1. NO TOPEABA el monto a devolver contra el DISPONIBLE. `resolver` rechaza con 400 si se
 *     quiere devolver más de lo que queda después de las reparaciones imputadas al depósito
 *     (`plata.ts:1141-1156`); `finalizar` escribía `montoDepositoDevuelto` crudo. O sea: se
 *     podía devolver el 100% del depósito teniendo arreglos ya imputados contra él, y esos
 *     arreglos los terminaba pagando la inmobiliaria.
 *  2. NO CERRABA los `CargoContrato` con `contraDeposito`. Quedaban `saldadoAt: null` para
 *     siempre e insaldables por los cuatro caminos.
 *
 * Y ESTÁN LIGADOS: cerrar sin topear sería peor que no cerrar, porque taparía la pérdida — el
 * libro diría "saldado" sobre plata que se devolvió y nadie retuvo.
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
let prisma: PrismaClient;
let token = '';
const auth = () => ({ authorization: `Bearer ${token}` });

const DEPOSITO = 500_000;
const REPARACION = 120_000;
let contratoId = '';
let cargoId = '';

beforeAll(async () => {
  prisma = new PrismaClient();
  const base = await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  // ADMIN, no la OPERADORA: desde que `finalizar` exige `deposito.devolver` para resolver el
  // depósito, un OPERADOR se come un 403 antes de llegar al tope. Este archivo prueba EL TOPE
  // y el cierre de cargos, no quién puede; el rol lo cubre
  // `el-deposito-no-tiene-puerta-de-servicio.test.ts`.
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');

  // Contrato PROPIO, no uno del seed: finalizar es destructivo y esta base es compartida
  // entre los 55 archivos de la suite. Se apoya en una propiedad existente, pero como NO es
  // su `contratoActual`, el updateMany de la propiedad que hace finalizar no la toca.
  // 🔴 SCOPEADO AL TENANT DEL SEED. Estaba SIN `where`: agarraba la primera propiedad de
  // CUALQUIER inmobiliaria. Mientras la base sólo tuvo el tenant del seed no se notó, pero
  // basta con que otro archivo cree una propiedad ajena —cosa legítima, es como se prueba el
  // aislamiento— para que este test la agarre y el endpoint conteste 404 con el token del
  // seed. El rojo aparece acá y la causa está en el archivo de al lado.
  const prop = await prisma.propiedad.findFirst({ where: { inmobiliariaId: base.inmobiliariaId }, select: { id: true, inmobiliariaId: true } });
  if (!prop) return;
  const cnt = await prisma.contrato.create({
    data: {
      inmobiliariaId: prop.inmobiliariaId,
      propiedadId: prop.id,
      monto: 300_000,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2027-12-31'),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 6,
      estado: 'ACTIVO',
      depositoGarantia: DEPOSITO,
      estadoDeposito: 'RETENIDO',
    },
  });
  contratoId = cnt.id;
  // Una reparación ya imputada contra el depósito: es la que compromete la plata.
  const cargo = await prisma.cargoContrato.create({
    data: {
      inmobiliariaId: prop.inmobiliariaId,
      contratoId: cnt.id,
      tipo: 'REPARACION',
      concepto: 'T-66 — arreglo imputado al depósito',
      monto: REPARACION,
      moneda: 'ARS',
      contraDeposito: true,
    },
  });
  cargoId = cargo.id;
});

afterAll(async () => {
  if (cargoId) await prisma.cargoContrato.deleteMany({ where: { contratoId } }).catch(() => {});
  if (contratoId) {
    await prisma.pago.deleteMany({ where: { contratoId } }).catch(() => {});
    await prisma.liquidacion.deleteMany({ where: { contratoId } }).catch(() => {});
    await prisma.contrato.delete({ where: { id: contratoId } }).catch(() => {});
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('T-66 — finalizar y el depósito', () => {
  it('el escenario se armó', () => {
    expect(contratoId).not.toBe('');
    expect(cargoId).not.toBe('');
  });

  it('devolver MÁS que el disponible se rechaza, con la cuenta explicada', async () => {
    const r = await app.inject({
      method: 'POST', url: `/contratos/${contratoId}/finalizar`, headers: auth(),
      // El bruto entero, ignorando los $120.000 comprometidos en la reparación.
      payload: { tipo: 'FINALIZADO', decisionDeposito: 'DEVOLVER', montoDepositoDevuelto: DEPOSITO },
    });
    // Con el bug: 200, y la inmobiliaria se comía la reparación.
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toContain(String(REPARACION));
  });

  it('y el contrato NO se finalizó: el 400 corta antes de tocar nada', async () => {
    const c = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { estado: true, estadoDeposito: true } });
    expect(c?.estado).toBe('ACTIVO');
    expect(c?.estadoDeposito).toBe('RETENIDO');
  });

  it('con el monto correcto finaliza', async () => {
    const r = await app.inject({
      method: 'POST', url: `/contratos/${contratoId}/finalizar`, headers: auth(),
      payload: { tipo: 'FINALIZADO', decisionDeposito: 'DEVOLVER', montoDepositoDevuelto: DEPOSITO - REPARACION },
    });
    expect(r.statusCode).toBe(200);
  });

  it('y el cargo del depósito quedó CERRADO, no huérfano', async () => {
    const cargo = await prisma.cargoContrato.findUnique({ where: { id: cargoId } });
    // Con el bug: saldadoAt seguía en null, e insaldable por los cuatro caminos.
    expect(cargo?.saldadoAt).not.toBeNull();
    expect(cargo?.saldadoPorId).not.toBeNull();
  });
});
