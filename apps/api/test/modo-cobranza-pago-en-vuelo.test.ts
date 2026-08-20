/**
 * T-64 · Cambiar el modo de cobranza con un comprobante esperando validación.
 *
 * EL AGUJERO. El guard de `PATCH /contratos/:id/modo-cobranza` se apoya en
 * `alquilerCobradoSinRendir`, que cuenta SÓLO pagos `CONCILIADO`
 * (`lib/rendicion-pendiente.ts:238`). Un comprobante queda `INFORMADO` en la bandeja hasta que
 * una persona lo decide — días, no la ventana de milisegundos que cerró T-36. En ese hueco el
 * modo se cambia con el guard en cero, y el pago aterriza del lado equivocado cuando alguien lo
 * valida: `POST /pagos/:id/validar` no mira el modo, y la rendición y la caja filtran por el
 * modo ACTUAL en cualquier período.
 *
 * LOS DOS SENTIDOS:
 *  → a PROPIETARIO_DIRECTO: la plata está en la cuenta de la inmobiliaria y el contrato pasa a
 *    directo ⇒ queda fuera de `POST /rendiciones` y del arqueo. Ningún endpoint se la hace
 *    llegar al dueño, y volver atrás rebota con el otro 409.
 *  → a INMOBILIARIA: el inquilino transfirió al CBU del DUEÑO ⇒ la rendición lo toma como
 *    rendible y le transfiere de nuevo lo que ya cobró. Doble pago, sin alarma.
 *
 * El repo ya trata INFORMADO+CONCILIADO como "pago vivo" en core.ts:1937, :1941, :2258, :2364,
 * :3608 y :3781. Este handler era el único que había quedado afuera.
 *
 * NECESITA BASE: se verifica en el job `integracion` de la CI, con su Postgres descartable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
const auth = () => ({ authorization: `Bearer ${token}` });

/** Contrato sin plata cobrada, para que el 409 que salte sea el NUESTRO y no el de sin-rendir. */
let contratoId = '';
let modoOriginal: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO' = 'INMOBILIARIA';
let pagoId = '';

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const r = await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'luciana@delsol.com', password: 'delsol123' }, // OPERADOR
  });
  token = r.json().token;

  // Elegido por PROPIEDADES, no por id fijo: el seed cambia seguido. Sin CONCILIADO el guard
  // de sin-rendir da 0, así que lo único que puede frenar el cambio es el guard nuevo.
  const cand = await prisma.contrato.findFirst({
    where: {
      modoCobranza: 'INMOBILIARIA',
      // SIN NINGÚN pago, no sólo sin CONCILIADOS: así `alquilerCobradoSinRendir` da 0 (o sea
      // el 409 que salte es el nuestro) y además no choca con el índice único parcial
      // `pagos_liquidacionId_informado_key`, que admite un solo INFORMADO por liquidación.
      pagos: { none: {} },
      liquidaciones: { some: {} },
    },
    select: { id: true, inmobiliariaId: true, modoCobranza: true, liquidaciones: { take: 1, select: { id: true, periodo: true, montoTotal: true } } },
  });
  if (!cand) return;
  contratoId = cand.id;
  modoOriginal = cand.modoCobranza as typeof modoOriginal;
  // `noUncheckedIndexedAccess` está activo: el índice puede ser undefined aunque el `where`
  // exija `liquidaciones: { some: {} }`.
  const liq = cand.liquidaciones[0];
  if (!liq) return;
  const pago = await prisma.pago.create({
    data: {
      inmobiliariaId: cand.inmobiliariaId,
      contratoId: cand.id,
      liquidacionId: liq.id,
      periodo: liq.periodo,
      tipo: 'TOTAL',
      monto: liq.montoTotal,
      metodo: 'TRANSFERENCIA',
      fechaTransferencia: new Date(),
      estado: 'INFORMADO',
    },
  });
  pagoId = pago.id;
});

afterAll(async () => {
  // Este archivo comparte la base con los demás: no puede dejar ni el pago ni el modo tocados.
  if (pagoId) await prisma.pago.delete({ where: { id: pagoId } }).catch(() => {});
  if (contratoId) await prisma.contrato.update({ where: { id: contratoId }, data: { modoCobranza: modoOriginal } }).catch(() => {});
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('T-64 — un comprobante en la bandeja frena el cambio de modo', () => {
  it('el escenario se pudo armar', () => {
    expect(contratoId, 'no hay contrato sin cobros conciliados en el seed').not.toBe('');
    expect(pagoId).not.toBe('');
  });

  it('con un pago INFORMADO, el cambio a cobranza directa da 409 PAGOS_EN_VUELO', async () => {
    const r = await app.inject({
      method: 'PATCH', url: `/contratos/${contratoId}/modo-cobranza`, headers: auth(),
      payload: { modoCobranza: 'PROPIETARIO_DIRECTO' },
    });
    // Con el bug: 200 (o 400 por falta de cuenta), y la plata quedaba fuera de la rendición.
    expect(r.statusCode).toBe(409);
    expect(r.json().codigo).toBe('PAGOS_EN_VUELO');
    expect(r.json().pendientes).toBe(1);
  });

  it('y el modo NO cambió', async () => {
    const c = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { modoCobranza: true } });
    expect(c?.modoCobranza).toBe(modoOriginal);
  });

  it('resuelto el comprobante, este guard deja de frenar', async () => {
    await prisma.pago.update({ where: { id: pagoId }, data: { estado: 'RECHAZADO', observacion: 'T-64' } });
    const r = await app.inject({
      method: 'PATCH', url: `/contratos/${contratoId}/modo-cobranza`, headers: auth(),
      payload: { modoCobranza: 'PROPIETARIO_DIRECTO' },
    });
    // Puede seguir frenando por OTRA razón legítima (p.ej. 400 FALTA_CUENTA_COBRANZA si el
    // dueño no tiene cuenta de cobro cargada). Lo que se afirma es que ya no es por este guard.
    expect(r.json().codigo).not.toBe('PAGOS_EN_VUELO');
  });
});
