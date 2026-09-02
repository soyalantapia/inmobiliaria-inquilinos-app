/**
 * T-28 · Dos operaciones de plata que devuelven 200 y que nadie mira qué dejaron atrás.
 *
 * ── 1. FINALIZAR CON NETEAR / EJECUTAR ────────────────────────────────────────────────
 *
 * `POST /contratos/:id/finalizar` con `decisionDeposito` NETEAR o EJECUTAR imputa el depósito
 * de garantía entero contra las cuotas exigibles del ex-inquilino: crea Pagos CONCILIADOS y
 * marca liquidaciones PAGADO/PARCIAL.
 *
 * **Ningún test mandaba esas dos decisiones.** Grepeando `decisionDeposito` en todo el repo,
 * los únicos envíos desde un test son DEVOLVER (×3) y MANTENER (×1) — o sea, justo las dos que
 * NO imputan nada. El camino que mueve la plata se ejercitaba sólo por el endpoint dedicado
 * (`/deposito/resolver`, cubierto por `deposito-aplica-deuda.test.ts`), y ése es **otro
 * handler con otra copia de la llamada**.
 *
 * ── 2. ANULAR UN PAGO ─────────────────────────────────────────────────────────────────
 *
 * `POST /pagos/:id/anular` devuelve el pago a RECHAZADO y **recalcula la liquidación** contra
 * `base + mora`, limpiando `fechaPago` y `metodoPago`. Los dos únicos tests que ejecutan el
 * handler asertan **sólo el `statusCode`**: ninguno relee la liquidación después.
 *
 * Si ese recompute se rompe, la liq queda PAGADO con su único pago en RECHAZADO: deuda real
 * que ninguna pantalla muestra, que la rendición pendiente saltea, y sobre la que la mora
 * nunca vuelve a devengar.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): neutralizando el
 * `if (estadoDep === 'NETEADO' || estadoDep === 'EJECUTADO')` de core.ts, los tres casos del
 * primer bloque caen y el depósito se marca consumido sin saldar una cuota. Forzando
 * `nuevoEstado = 'PAGADO'` en el recompute de `anular`, caen los dos del segundo.
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
let token = '';
let inmobiliariaId = '';
let propiedadId = '';
const prisma = new PrismaClient();

const auth = () => ({ authorization: `Bearer ${token}` });

const DEPOSITO = 100_000;
const DEUDA_A = 40_000;
const DEUDA_B = 30_000;

let cNeteo = '';
let cAnular = '';
let liqAnularId = '';
let pagoAAnularId = '';

/**
 * Un contrato PROPIO, con `devengarDesde` en 2099 para que el cron de devengo —que corre solo
 * cada 6 horas contra esta misma base— no le agregue períodos y le mueva la cuenta al test.
 * Y `moraTipo: SIN_MORA`, para que la deuda exigible sea exactamente la que se creó.
 */
async function contratoLimpio(depositoGarantia: number | null) {
  const c = await prisma.contrato.create({
    data: {
      inmobiliariaId,
      propiedadId,
      monto: DEUDA_A,
      fechaInicio: new Date('2020-01-01'),
      fechaFin: new Date('2099-12-31'),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      estado: 'ACTIVO',
      moneda: 'ARS',
      moraTipo: 'SIN_MORA',
      devengarDesde: new Date('2099-01-01'),
      ...(depositoGarantia != null ? { depositoGarantia, estadoDeposito: 'RETENIDO' as const } : {}),
    },
  });
  return c.id;
}

async function cuotaVencida(contratoId: string, periodo: string, monto: number) {
  const l = await prisma.liquidacion.create({
    data: {
      inmobiliariaId,
      contratoId,
      periodo,
      montoAlquiler: monto,
      montoTotal: monto,
      fechaVencimiento: new Date(`${periodo}-10T00:00:00.000Z`),
      estado: 'VENCIDO',
      moneda: 'ARS',
    },
  });
  return l.id;
}

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  const prop = await prisma.propiedad.findFirstOrThrow({ select: { id: true } });
  propiedadId = prop.id;

  // 1 · el del neteo: $100.000 de depósito contra $70.000 de deuda exigible.
  cNeteo = await contratoLimpio(DEPOSITO);
  await cuotaVencida(cNeteo, '2020-01', DEUDA_A);
  await cuotaVencida(cNeteo, '2020-02', DEUDA_B);

  // 2 · el de anular: una cuota de $100.000 PAGADA con DOS pagos conciliados.
  cAnular = await contratoLimpio(null);
  liqAnularId = await cuotaVencida(cAnular, '2020-03', 100_000);
  await prisma.liquidacion.update({
    where: { id: liqAnularId },
    data: { estado: 'PAGADO', fechaPago: new Date('2020-03-09T15:00:00.000Z'), metodoPago: 'TRANSFERENCIA' },
  });
  const comun = {
    inmobiliariaId,
    contratoId: cAnular,
    liquidacionId: liqAnularId,
    periodo: '2020-03',
    montoLiqTotal: 100_000,
    metodo: 'TRANSFERENCIA' as const,
    fechaTransferencia: new Date('2020-03-09T15:00:00.000Z'),
    estado: 'CONCILIADO' as const,
  };
  await prisma.pago.create({ data: { ...comun, tipo: 'PARCIAL', monto: 60_000 } });
  const p2 = await prisma.pago.create({ data: { ...comun, tipo: 'PARCIAL', monto: 40_000 } });
  pagoAAnularId = p2.id;
}, 420_000);

afterAll(async () => {
  const ids = [cNeteo, cAnular].filter(Boolean);
  if (ids.length) {
    // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
    await prisma.eventoAuditoria.deleteMany({ where: { entidadId: { in: ids } } });
    await prisma.eventoContrato.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.cargoContrato.deleteMany({ where: { contratoId: { in: ids } } });
    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId: { in: ids } },
      select: { id: true },
    });
    await prisma.alquilerRendido.deleteMany({ where: { liquidacionId: { in: liqs.map((l) => l.id) } } });
    await prisma.pago.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.contrato.deleteMany({ where: { id: { in: ids } } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('finalizar NETEANDO imputa el depósito contra la deuda', () => {
  it('la respuesta dice cuánto se aplicó y cuánto sobró', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${cNeteo}/finalizar`,
      headers: auth(),
      payload: { tipo: 'RESCINDIDO', decisionDeposito: 'NETEAR', montoDepositoDevuelto: 0 },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    // $100.000 de depósito contra $70.000 de deuda: se imputan 70.000 y sobran 30.000.
    // Con el bug: 0 y 0 — el depósito se marcaba consumido sin saldar una sola cuota.
    expect(Number(j.depositoAplicadoADeuda)).toBe(DEUDA_A + DEUDA_B);
    expect(Number(j.depositoSobrante)).toBe(DEPOSITO - DEUDA_A - DEUDA_B);
    expect(Number(j.cuotasSaldadasConDeposito)).toBe(2);
  });

  it('y las DOS cuotas quedaron pagas, con su pago cada una', async () => {
    // Lo que el `statusCode` no dice: que la plata efectivamente se imputó.
    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId: cNeteo },
      orderBy: { periodo: 'asc' },
      include: { _count: { select: { pagos: { where: { estado: 'CONCILIADO' } } } } },
    });
    expect(liqs).toHaveLength(2);
    expect(liqs.map((l) => l.estado)).toEqual(['PAGADO', 'PAGADO']);
    expect(liqs.map((l) => l._count.pagos)).toEqual([1, 1]);
    const montos = await prisma.pago.findMany({
      where: { contratoId: cNeteo, estado: 'CONCILIADO' },
      select: { monto: true },
      orderBy: { monto: 'asc' },
    });
    expect(montos.map((p) => Number(p.monto))).toEqual([DEUDA_B, DEUDA_A]);
  });

  it('y el depósito quedó NETEADO', async () => {
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: cNeteo } });
    expect(c.estadoDeposito).toBe('NETEADO');
    expect(c.estado).toBe('RESCINDIDO');
  });
});

describe('anular un pago recalcula la liquidación, no sólo el pago', () => {
  it('la liquidación baja de PAGADO a PARCIAL', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/pagos/${pagoAAnularId}/anular`,
      headers: auth(),
      payload: { observacion: 'La transferencia se cayó — anulada para T-28', pin: '1234' },
    });
    expect(r.statusCode).toBe(200);

    const liq = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liqAnularId } });
    // Con el bug: seguía PAGADO con $60.000 cobrados de $100.000 — deuda real que ninguna
    // pantalla muestra y sobre la que la mora nunca vuelve a devengar.
    expect(liq.estado).toBe('PARCIAL');
  });

  it('y le limpia el "pagado fantasma": ni fecha ni método', async () => {
    const liq = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liqAnularId } });
    expect(liq.fechaPago).toBeNull();
    expect(liq.metodoPago).toBeNull();
  });

  it('el pago anulado queda RECHAZADO y el otro sigue vivo', async () => {
    const pagos = await prisma.pago.findMany({
      where: { liquidacionId: liqAnularId },
      orderBy: { monto: 'asc' },
    });
    expect(pagos).toHaveLength(2);
    const anulado = pagos.find((p) => p.id === pagoAAnularId);
    expect(anulado?.estado).toBe('RECHAZADO');
    // El control: anular UNO no toca al otro. Si el recompute se llevara puesto el resto,
    // la liq caería a PENDIENTE y este caso lo diría.
    const vivo = pagos.find((p) => p.id !== pagoAAnularId);
    expect(vivo?.estado).toBe('CONCILIADO');
    expect(Number(vivo?.monto)).toBe(60_000);
  });
});
