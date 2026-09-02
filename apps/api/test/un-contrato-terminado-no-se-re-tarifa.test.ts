/**
 * TERCERA AUDITORÍA · El ajuste de canon no exigía contrato ACTIVO; sus dos hermanos sí.
 *
 * `POST /contratos/:id/ajustar` corta con 409 si el contrato no está ACTIVO. `PATCH
 * /contratos/:id/expensas` también, con el motivo escrito al lado: «Un contrato terminado no
 * se re-tarifa: sus cuotas son historia (y las de deuda histórica, todas vencidas, no
 * deberían moverse nunca)». `PATCH /contratos/:id/monto` —el tercer camino, el que usa el
 * ajuste masivo— ni siquiera traía `estado` en el select.
 *
 * Y NO ES TEÓRICO. La cuota del mes en curso SOBREVIVE a la baja: la finalización sólo borra
 * las PENDIENTE con vencimiento futuro, así que la del mes queda como deuda real e impaga.
 * `recomputarLiquidacionesFuturas` alcanza las PENDIENTE y VENCIDO desde el período actual,
 * así que un `monto: 1` la reescribe: la deuda del ex-inquilino se evapora, queda una fila
 * `AjusteAlquiler` falsa, y sale un aviso de ajuste por mail a alguien que ya no vive ahí.
 *
 * El panel ya lo gateaba en sus dos call sites (`c.estado === 'ACTIVO'` en el botón del
 * detalle y en el ajuste masivo). Lo que faltaba era que el server no dependiera de eso.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): neutralizando el guard nuevo, el
 * primer caso pasa de 409 a 200 y la cuota vencida de $480.000 queda en $1.
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
let inmobiliariaId = '';
let propiedadId = '';

const PIN = '54321';
const CANON = 480_000;

let cTerminado = '';
let cActivo = '';

const ajustar = (contratoId: string, monto: number) =>
  app.inject({
    method: 'PATCH',
    url: `/contratos/${contratoId}/monto`,
    headers: { authorization: `Bearer ${token}` },
    payload: { monto, pin: PIN },
  });

/** Contrato PROPIO con una cuota del mes en curso ya vencida e impaga. */
async function contratoConDeudaVencida(estado: 'ACTIVO' | 'RESCINDIDO') {
  const c = await prisma.contrato.create({
    data: {
      inmobiliariaId,
      propiedadId,
      monto: CANON,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2027-12-31'),
      diaPago: 5,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 6,
      estado,
    },
  });
  const hoy = new Date();
  const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  await prisma.liquidacion.create({
    data: {
      inmobiliariaId,
      contratoId: c.id,
      periodo,
      montoAlquiler: CANON,
      montoTotal: CANON,
      // Venció hace unos días: es deuda REAL, la que sobrevive a la baja.
      fechaVencimiento: new Date(hoy.getTime() - 5 * 86400000),
      estado: 'VENCIDO',
    },
  });
  return c.id;
}

const cuotaDe = (contratoId: string) =>
  prisma.liquidacion.findFirstOrThrow({ where: { contratoId }, orderBy: { periodo: 'desc' } });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  const prop = await prisma.propiedad.findFirstOrThrow({ select: { id: true, inmobiliariaId: true } });
  propiedadId = prop.id;
  inmobiliariaId = prop.inmobiliariaId;
  // El endpoint exige PIN: se lo ponemos al ADMIN con el que entramos.
  const bcrypt = await import('bcryptjs');
  const usuario = await prisma.usuario.findFirstOrThrow({ where: { email: 'roberto@delsol.com' } });
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { pinHash: bcrypt.hashSync(PIN, 8), pinIntentosFallidos: 0, pinBloqueadoHasta: null },
  });
  cTerminado = await contratoConDeudaVencida('RESCINDIDO');
  cActivo = await contratoConDeudaVencida('ACTIVO');
});

afterAll(async () => {
  const ids = [cTerminado, cActivo].filter(Boolean);
  if (ids.length) {
    // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
    await prisma.ajusteAlquiler.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.eventoContrato.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.pago.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.contrato.deleteMany({ where: { id: { in: ids } } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('un contrato terminado no se re-tarifa', () => {
  it('el escenario se armó', async () => {
    expect(cTerminado).not.toBe('');
    expect(Number((await cuotaDe(cTerminado)).montoTotal)).toBe(CANON);
  });

  it('ajustar el monto de un contrato RESCINDIDO se rechaza', async () => {
    const r = await ajustar(cTerminado, 1);
    expect(r.statusCode).toBe(409); // con el bug: 200
    expect(r.json().message).toContain('activo');
  });

  it('y la deuda del ex-inquilino sigue entera', async () => {
    const liq = await cuotaDe(cTerminado);
    // Con el bug: montoTotal 1. La deuda de $480.000 se evaporaba.
    expect(Number(liq.montoTotal)).toBe(CANON);
    expect(Number(liq.montoAlquiler)).toBe(CANON);
  });

  it('ni queda una fila de ajuste inventada', async () => {
    expect(await prisma.ajusteAlquiler.count({ where: { contratoId: cTerminado } })).toBe(0);
  });

  it('CONTROL POSITIVO — el mismo ajuste sobre un contrato ACTIVO sigue funcionando', async () => {
    const r = await ajustar(cActivo, 500_000);
    expect(r.statusCode).toBe(200);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: cActivo } });
    expect(Number(c.monto)).toBe(500_000);
    // Y la cuota vencida SÍ se re-devenga cuando el contrato está vivo: es para lo que sirve.
    expect(Number((await cuotaDe(cActivo)).montoTotal)).toBe(500_000);
  });
});
