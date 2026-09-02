/**
 * Deshacer el cobro de un cargo es una REVERSIÓN, y las reversiones son de ADMIN.
 *
 * DE DÓNDE SALIÓ. De la auditoría por clases de defecto del 31/08
 * (`work-agent/AUDITORIA-2026-08-31.md`), clase "el permiso no coincide con lo que el endpoint
 * hace".
 *
 * QUÉ PASABA. `POST /cargos/:id/descobrar` exigía `pago.conciliar` (ADMIN + CAJA) y hacía de una
 * sola vez las dos cosas que la matriz sí reserva a ADMIN: registra `PAGO_REVERTIDO`
 * —`pago.revertir` es `roles: ['ADMIN']`— y borra el `MovimientoCaja` que había dejado `saldar`
 * —`caja.eliminar`, también ADMIN, y encima con PIN—.
 *
 * POR QUÉ EXISTÍA. `descobrar` nació después y por otro camino (destrabar el 409 de
 * `imputarCostoReclamo`) y **heredó el gate de su acción directa** (`saldar`, que sí es
 * `pago.conciliar`) en vez del de su inversa. El hermano `POST /pagos/:id/anular` tiene el
 * razonamiento correcto escrito desde antes; nadie lo trajo hasta acá.
 *
 * LA REGLA QUE DEJA: **deshacer nunca pesa lo mismo que hacer.** `saldar` cobra una deuda que
 * existe; `descobrar` la resucita y borra el ingreso que la respaldaba.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 'desrev-';
const EMAIL_CAJA = 'desrev.cajero@example.com';

let app: FastifyInstance;
let prisma: PrismaClient;
let tCAJA = '';
let tADMIN = '';
let inmobiliariaId = '';
let contratoId = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar(): Promise<void> {
  await prisma.movimientoCaja.deleteMany({ where: { descripcion: { contains: P } } });
  await prisma.cargoContrato.deleteMany({ where: { concepto: { startsWith: P } } });
}

/** Un cargo propio, cobrado, listo para intentar deshacerlo. */
async function cargoCobrado(nombre: string): Promise<string> {
  const cargo = await prisma.cargoContrato.create({
    data: {
      inmobiliariaId,
      contratoId,
      tipo: 'REPARACION',
      concepto: `${P}${nombre}`,
      monto: 123_000,
      contraDeposito: false,
    },
  });
  const r = await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tADMIN) });
  expect(r.statusCode, `saldar devolvió ${r.statusCode}: ${r.body.slice(0, 200)}`).toBeLessThan(300);
  return cargo.id;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  inmobiliariaId = (await seedBase(prisma)).inmobiliariaId;
  await limpiar();
  // El seed no trae ningún CAJA: el rol existe en la matriz y no hay con qué probarlo.
  await prisma.usuario.upsert({
    where: { inmobiliariaId_email: { inmobiliariaId, email: EMAIL_CAJA } },
    update: { rol: 'CAJA', activo: true },
    create: {
      inmobiliariaId,
      email: EMAIL_CAJA,
      nombre: 'Cajero',
      apellido: 'DeReversion',
      rol: 'CAJA',
      passwordHash: bcrypt.hashSync('delsol123', 10),
    },
  });
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tADMIN = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  tCAJA = await loginTest(app, EMAIL_CAJA, 'delsol123');

  const c = await prisma.contrato.findFirstOrThrow({ where: { estado: 'ACTIVO' }, select: { id: true } });
  contratoId = c.id;
});

afterAll(async () => {
  await limpiar();
  await prisma.usuario.deleteMany({ where: { email: EMAIL_CAJA } }).catch(() => {});
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('descobrar es una reversión: la hace un ADMIN', () => {
  it('el escenario se armó: hay un CAJA de verdad', () => {
    expect(tCAJA).not.toBe('');
    expect(tADMIN).not.toBe('');
  });

  it('CAJA sí puede COBRAR un cargo — la acción directa sigue siendo suya', async () => {
    // El control positivo, y el que le da sentido al de abajo: el corte es sobre la INVERSA,
    // no sobre la caja. Si CAJA dejara de poder cobrar, el arreglo estaría de más.
    const cargo = await prisma.cargoContrato.create({
      data: {
        inmobiliariaId,
        contratoId,
        tipo: 'REPARACION',
        concepto: `${P}cobra-caja`,
        monto: 45_000,
        contraDeposito: false,
      },
    });
    const r = await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tCAJA) });
    expect(r.statusCode, r.body.slice(0, 200)).toBeLessThan(300);
    expect((await prisma.cargoContrato.findUniqueOrThrow({ where: { id: cargo.id } })).saldadoAt).not.toBeNull();
  });

  it('🔴 CAJA NO puede DESHACER el cobro: resucita la deuda y borra el ingreso', async () => {
    const id = await cargoCobrado('caja-deshace');
    const r = await app.inject({ method: 'POST', url: `/cargos/${id}/descobrar`, headers: auth(tCAJA) });
    expect(r.statusCode).toBe(403);
    // Y no lo deshizo igual: un 403 que igual escribe sería peor que no tener el guard.
    expect((await prisma.cargoContrato.findUniqueOrThrow({ where: { id } })).saldadoAt).not.toBeNull();
  });

  it('🔴 y el ingreso de caja sigue ahí: las dos mitades no se contradicen', async () => {
    // El daño de este endpoint son DOS escrituras. Que el cargo siga cobrado no alcanza:
    // el `MovimientoCaja` que lo respalda también tiene que seguir en pie.
    const id = await cargoCobrado('caja-ingreso');
    await app.inject({ method: 'POST', url: `/cargos/${id}/descobrar`, headers: auth(tCAJA) });
    const ingresos = await prisma.movimientoCaja.findMany({
      where: { contratoId, descripcion: { contains: `${P}caja-ingreso` } },
    });
    expect(ingresos.length, 'el ingreso que dejó saldar tiene que seguir existiendo').toBeGreaterThan(0);
  });

  it('ADMIN sí puede deshacerlo: el endpoint sigue sirviendo para lo que se creó', async () => {
    // Sin esto, un guard que devolviera 403 a todos dejaría el 409 de `imputarCostoReclamo`
    // en el callejón sin salida que este endpoint vino a destrabar.
    const id = await cargoCobrado('admin-deshace');
    const r = await app.inject({ method: 'POST', url: `/cargos/${id}/descobrar`, headers: auth(tADMIN) });
    expect(r.statusCode, r.body.slice(0, 200)).toBeLessThan(300);
    expect((await prisma.cargoContrato.findUniqueOrThrow({ where: { id } })).saldadoAt).toBeNull();
  });
});
