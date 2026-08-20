import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Conciliar un crédito del extracto deja huérfano el aviso de pago del inquilino.
 *
 * El flujo real: el inquilino avisa que transfirió (queda un Pago INFORMADO esperando
 * que la inmobiliaria lo valide) y unos días después llega el extracto del banco con
 * ESA MISMA transferencia. Al conciliar el crédito, la liquidación pasa a PAGADO —
 * correcto, la plata está— pero el INFORMADO queda pendiente para siempre.
 *
 * No es plata mal contada: el tope al saldo de /pagos/:id/validar impide el doble cobro,
 * y el 409 que devuelve dice claramente "ya fue cubierta por otro cobro, rechazá o
 * reasigná". Es trabajo manual evitable: alguien tiene que rechazar a mano, uno por uno,
 * avisos que el banco ya confirmó, en una bandeja ("Pagos a validar") cuyo sentido es
 * mostrar lo que falta decidir.
 *
 * El fix cierra ese INFORMADO como parte de la misma transacción de la conciliación.
 *
 * ⚠️ Al correr la regresión: `credito-dedup.test.ts` en el MISMO lote que `plata.test.ts`
 * hace fallar los 3 tests de `POST /pagos/manual` (uno con 500). No es una regresión del
 * código — `plata` sola pasa 29/29 con y sin este fix. Verificado con stash en las dos
 * direcciones. Si aparecen esas 3 fallas, correr `plata` aislada antes de investigar.
 */

let app: FastifyInstance;
let token: string;
let inmobiliariaId: string;
const prisma = new PrismaClient();
const P = 'inf_'; // prefijo de fixtures

async function limpiar() {
  // Los pagos se borran por liquidacionId, NO por prefijo de id: la conciliación crea
  // un pago nuevo con id autogenerado que igual cuelga de la liquidación, y la FK
  // pagos_liquidacionId_fkey es RESTRICT → sin esto el deleteMany de liquidaciones
  // falla con 23001 y la suite entera queda en "skipped".
  await prisma.creditoDetectado.deleteMany({ where: { resumenBancarioId: { startsWith: P } } });
  await prisma.resumenBancario.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.pago.deleteMany({ where: { liquidacionId: { startsWith: P } } });
  await prisma.liquidacion.deleteMany({ where: { id: { startsWith: P } } });

  // Y además, el SLOT que este test ocupa: (cnt_001, 2026-09).
  //
  // La limpieza por prefijo de id borra lo que este archivo creó, y nada más. Pero
  // `Liquidacion` tiene `@@unique([contratoId, periodo])`, así que alcanza con que
  // CUALQUIER OTRA COSA haya devengado ese período de cnt_001 para que el `create` de
  // abajo explote con un 23505 — y no es hipotético: el devengo corre solo, en proceso,
  // cada 6 horas (`CRON_DEVENGO`), así que cualquier API apuntada a esta misma base lo
  // crea sin que nadie lo pida. Pasó, y el rojo parecía un bug del código bajo prueba.
  const ocupando = await prisma.liquidacion.findMany({
    where: { contratoId: 'cnt_001', periodo: '2026-09' },
    select: { id: true },
  });
  if (ocupando.length) {
    const ids = ocupando.map((l) => l.id);
    await prisma.pago.deleteMany({ where: { liquidacionId: { in: ids } } });
    await prisma.alquilerRendido.deleteMany({ where: { liquidacionId: { in: ids } } });
    await prisma.liquidacion.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
}, 420_000);

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${token}` });

/** Liquidación con saldo + el aviso del inquilino (INFORMADO) + el crédito del banco. */
async function armarEscenario(montoCredito: number) {
  await limpiar();
  await prisma.liquidacion.create({
    data: {
      id: `${P}liq`,
      inmobiliariaId,
      contratoId: 'cnt_001',
      periodo: '2026-09',
      montoAlquiler: 100_000,
      montoTotal: 100_000,
      fechaVencimiento: new Date('2026-09-10T00:00:00.000Z'),
      estado: 'PENDIENTE',
      moneda: 'ARS',
    },
  });
  // El inquilino avisó que transfirió: queda esperando validación.
  await prisma.pago.create({
    data: {
      id: `${P}informado`,
      inmobiliariaId,
      contratoId: 'cnt_001',
      liquidacionId: `${P}liq`,
      periodo: '2026-09',
      tipo: 'TOTAL',
      monto: 100_000,
      montoLiqTotal: 100_000,
      metodo: 'TRANSFERENCIA',
      fechaTransferencia: new Date('2026-09-05T00:00:00.000Z'),
      estado: 'INFORMADO',
    },
  });
  await prisma.resumenBancario.create({
    data: {
      id: `${P}res`,
      inmobiliariaId,
      fileName: `${P}extracto.csv`,
      fileSize: 1024,
      subidoPor: 'test',
    },
  });
  await prisma.creditoDetectado.create({
    data: {
      id: `${P}credito`,
      inmobiliariaId,
      resumenBancarioId: `${P}res`,
      fecha: new Date('2026-09-06T00:00:00.000Z'),
      monto: montoCredito,
      concepto: 'TRANSFERENCIA RECIBIDA',
      titularOrigen: 'Juan Pérez',
      nroOperacion: '999888',
      bancoOrigen: 'Test',
    },
  });
}

const conciliar = () =>
  app.inject({
    method: 'POST',
    url: `/resumenes-bancarios/${P}res/creditos/${P}credito/conciliar`,
    headers: auth(),
    payload: { liquidacionId: `${P}liq` },
  });

describe('Conciliar por extracto no deja huérfano el aviso del inquilino', () => {
  it('el crédito CUBRE la liquidación: se cierra el INFORMADO que el banco ya confirmó', async () => {
    await armarEscenario(100_000);
    const res = await conciliar();
    expect([200, 201]).toContain(res.statusCode);

    const liq = await prisma.liquidacion.findUniqueOrThrow({ where: { id: `${P}liq` } });
    expect(liq.estado).toBe('PAGADO');

    // EL BUG: el aviso quedaba en INFORMADO para siempre, y alguien tenía que
    // rechazarlo a mano desde "Pagos a validar" — un pago que el banco ya confirmó.
    const informado = await prisma.pago.findUniqueOrThrow({ where: { id: `${P}informado` } });
    expect(informado.estado).not.toBe('INFORMADO');
  });

  it('el aviso cerrado queda trazable: se ve por qué, y no cuenta como cobro', async () => {
    const informado = await prisma.pago.findUniqueOrThrow({ where: { id: `${P}informado` } });
    // No puede quedar CONCILIADO: sumaría al cobrado y contaría la plata dos veces.
    expect(informado.estado).toBe('RECHAZADO');
    // El rastro tiene que decir POR QUÉ se cerró y contra qué operación bancaria:
    // sin eso, el inquilino ve un pago "rechazado" sin explicación.
    expect(informado.observacion ?? '').toMatch(/extracto bancario/i);
    expect(informado.observacion ?? '').toContain('999888'); // la operación del crédito

    // El cobrado real de la liquidación sigue siendo UNA sola vez el monto.
    const agg = await prisma.pago.aggregate({
      where: { liquidacionId: `${P}liq`, estado: 'CONCILIADO' },
      _sum: { monto: true },
    });
    expect(Number(agg._sum.monto ?? 0)).toBe(100_000);
  });

  it('el crédito NO cubre el total: el aviso sigue pendiente (todavía hay algo que decidir)', async () => {
    await armarEscenario(40_000); // parcial
    const res = await conciliar();
    expect([200, 201]).toContain(res.statusCode);

    const liq = await prisma.liquidacion.findUniqueOrThrow({ where: { id: `${P}liq` } });
    expect(liq.estado).toBe('PARCIAL');

    // Acá cerrar el aviso sería un error: queda saldo y ese comprobante puede
    // corresponder a otra parte del pago. La decisión sigue siendo del operador.
    const informado = await prisma.pago.findUniqueOrThrow({ where: { id: `${P}informado` } });
    expect(informado.estado).toBe('INFORMADO');
  });
});
