/**
 * T-28 · `POST /contratos/:id/renovar` no tenía UN SOLO test.
 *
 * Es el tercer camino que cambia el canon —los otros dos son `POST /contratos/:id/ajustar` y
 * `PATCH /contratos/:id/monto`, los dos cubiertos— y el que más escribe de los tres: pisa
 * `contrato.monto`, extiende `fechaFin`, **re-precia las cuotas futuras impagas**, devenga los
 * períodos del plazo nuevo, crea la fila `RenovacionContrato` que después alimenta el timeline,
 * y le manda al inquilino el aviso de aumento.
 *
 * Grepeando: **ningún `inject` a `/contratos/:id/renovar`** en `apps/api/test/` ni en los
 * `*.test.ts` de los fronts. Las únicas menciones de "renovar" en `test/` son comentarios.
 *
 * LO QUE MÁS IMPORTA FIJAR, porque es la sutileza que el propio handler documenta: la cuota se
 * re-precia con **las expensas de CADA CUOTA**, no con las del contrato. Desde que existe
 * `PATCH /contratos/:id/expensas`, una cuota puede tener las suyas propias, y usar las del
 * contrato dejaba la fila sin cuadrar consigo misma.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): cambiando `expensasDeLaCuota` por las
 * del contrato, el caso de las expensas propias da `expected 520000 to be 577000`. Sacando el
 * filtro `pagos: { none: … }`, el de la cuota con un pago en vuelo da
 * `expected 500000 to be 400000`.
 *
 * ⚠️ Y UNA TRAMPA DEL PROPIO CONTROL, que casi me hace firmar un verde falso: **este bloque
 * está DUPLICADO** — el mismo `expensasDeLaCuota` y el mismo filtro de pago vivo existen en
 * `POST /contratos/:id/ajustar` (core.ts:2509-2514) y en `renovar` (core.ts:2615-2620). La
 * primera vez neutralicé por texto y el reemplazo pegó en la copia de `ajustar`: **el test
 * siguió en verde**, y eso se lee como "el control no detecta nada" cuando en realidad el
 * control nunca se aplicó. Cuando un control negativo NO se pone rojo, lo primero es
 * verificar que se haya neutralizado la copia correcta.
 *
 * (Que estén duplicados es, además, una invitación a la corrección parcial: el día que alguien
 * arregle uno de los dos, el otro se queda como estaba.)
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

const CANON_VIEJO = 400_000;
const CANON_NUEVO = 500_000;
/** Expensas PROPIAS de una cuota, distintas de las del contrato. */
const EXPENSAS_PROPIAS = 77_000;
const EXPENSAS_CONTRATO = 20_000;

const FIN_VIEJO = new Date('2026-12-31T00:00:00.000Z');
const FIN_NUEVO = '2027-12-31';
const DESDE = '2026-11';

let contratoId = '';
let cSoloExpensas = '';
let cTerminado = '';

/**
 * `devengarDesde` en 2027-01 para que la generación de la renovación arranque justo en el
 * plazo nuevo: así las cuotas que este test crea a mano (2026-11 y 2026-12) no las pisa el
 * devengo, y lo que se afirma sobre ellas es el efecto del RE-PRECIO y nada más.
 */
async function contratoRenovable(opts: { tipo: 'ALQUILER' | 'SOLO_EXPENSAS'; estado: 'ACTIVO' | 'FINALIZADO' }) {
  const c = await prisma.contrato.create({
    data: {
      inmobiliariaId,
      propiedadId,
      monto: opts.tipo === 'SOLO_EXPENSAS' ? 0 : CANON_VIEJO,
      montoExpensas: EXPENSAS_CONTRATO,
      tipoContrato: opts.tipo,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: FIN_VIEJO,
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      estado: opts.estado,
      moneda: 'ARS',
      moraTipo: 'SIN_MORA',
      devengarDesde: new Date('2027-01-01'),
    },
  });
  return c.id;
}

async function cuota(
  contratoIdArg: string,
  periodo: string,
  opts: { expensas?: number; conPagoEnVuelo?: boolean } = {},
) {
  const expensas = opts.expensas ?? 0;
  const l = await prisma.liquidacion.create({
    data: {
      inmobiliariaId,
      contratoId: contratoIdArg,
      periodo,
      montoAlquiler: CANON_VIEJO,
      montoExpensas: expensas,
      montoTotal: CANON_VIEJO + expensas,
      fechaVencimiento: new Date(`${periodo}-10T00:00:00.000Z`),
      estado: 'PENDIENTE',
      moneda: 'ARS',
    },
  });
  if (opts.conPagoEnVuelo) {
    await prisma.pago.create({
      data: {
        inmobiliariaId,
        contratoId: contratoIdArg,
        liquidacionId: l.id,
        periodo,
        tipo: 'TOTAL',
        monto: CANON_VIEJO + expensas,
        montoLiqTotal: CANON_VIEJO + expensas,
        metodo: 'TRANSFERENCIA',
        fechaTransferencia: new Date(`${periodo}-08T15:00:00.000Z`),
        // INFORMADO: el inquilino avisó y todavía nadie lo validó. Es "pago vivo".
        estado: 'INFORMADO',
      },
    });
  }
  return l.id;
}

const renovar = (id: string, body: Record<string, unknown> = {}) =>
  app.inject({
    method: 'POST',
    url: `/contratos/${id}/renovar`,
    headers: auth(),
    payload: {
      fechaFinNueva: FIN_NUEVO,
      montoNuevo: CANON_NUEVO,
      montoDesde: DESDE,
      motivo: 'Renovación de prueba (T-28)',
      ...body,
    },
  });

let liqPropia = '';
let liqConPago = '';
let liqVieja = '';

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  const prop = await prisma.propiedad.findFirstOrThrow({ select: { id: true } });
  propiedadId = prop.id;

  contratoId = await contratoRenovable({ tipo: 'ALQUILER', estado: 'ACTIVO' });
  // ANTERIOR a `montoDesde`: no se toca.
  liqVieja = await cuota(contratoId, '2026-10');
  // La que se re-precia, con expensas PROPIAS distintas de las del contrato.
  liqPropia = await cuota(contratoId, '2026-11', { expensas: EXPENSAS_PROPIAS });
  // Futura pero con un pago en vuelo: tampoco se toca.
  liqConPago = await cuota(contratoId, '2026-12', { conPagoEnVuelo: true });

  cSoloExpensas = await contratoRenovable({ tipo: 'SOLO_EXPENSAS', estado: 'ACTIVO' });
  cTerminado = await contratoRenovable({ tipo: 'ALQUILER', estado: 'FINALIZADO' });
}, 420_000);

afterAll(async () => {
  const ids = [contratoId, cSoloExpensas, cTerminado].filter(Boolean);
  if (ids.length) {
    // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
    await prisma.renovacionContrato.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.ajusteAlquiler.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.eventoContrato.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.pago.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.contrato.deleteMany({ where: { id: { in: ids } } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('renovar un contrato', () => {
  it('extiende el plazo y pisa el canon', async () => {
    const r = await renovar(contratoId);
    expect(r.statusCode).toBe(200);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(Number(c.monto)).toBe(CANON_NUEVO);
    expect(c.fechaFin.toISOString().slice(0, 10)).toBe(FIN_NUEVO);
  });

  it('🔴 re-precia la cuota futura con LAS EXPENSAS DE LA CUOTA, no las del contrato', async () => {
    const l = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liqPropia } });
    expect(Number(l.montoAlquiler)).toBe(CANON_NUEVO);
    // 500.000 + 77.000 (las suyas) = 577.000. Con las del contrato daría 520.000 y la fila
    // quedaría sin cuadrar consigo misma: montoTotal ≠ montoAlquiler + montoExpensas.
    expect(Number(l.montoExpensas)).toBe(EXPENSAS_PROPIAS);
    expect(Number(l.montoTotal)).toBe(CANON_NUEVO + EXPENSAS_PROPIAS);
  });

  it('no toca la cuota ANTERIOR a montoDesde', async () => {
    const l = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liqVieja } });
    expect(Number(l.montoAlquiler)).toBe(CANON_VIEJO);
  });

  it('ni la futura que ya tiene un pago en vuelo', async () => {
    // Re-preciarla le cambiaría el total por debajo a un inquilino que ya transfirió.
    const l = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liqConPago } });
    expect(Number(l.montoAlquiler)).toBe(CANON_VIEJO);
  });

  it('devenga el plazo nuevo al canon nuevo', async () => {
    const enero = await prisma.liquidacion.findFirst({
      where: { contratoId, periodo: '2027-01' },
    });
    expect(enero).toBeTruthy();
    expect(Number(enero?.montoAlquiler)).toBe(CANON_NUEVO);
  });

  it('deja la fila de renovación con el canon viejo y el nuevo', async () => {
    const renov = await prisma.renovacionContrato.findFirstOrThrow({ where: { contratoId } });
    expect(Number(renov.montoAnterior)).toBe(CANON_VIEJO);
    expect(Number(renov.montoNuevo)).toBe(CANON_NUEVO);
    expect(renov.montoDesde).toBe(DESDE);
  });

  it('y el rastro en el historial del contrato', async () => {
    const ev = await prisma.eventoContrato.findFirst({ where: { contratoId, tipo: 'RENOVACION' } });
    expect(ev).toBeTruthy();
    expect(ev?.titulo).toContain(String(CANON_NUEVO));
  });
});

describe('los guards de la renovación', () => {
  it('un contrato terminado no se renueva', async () => {
    const r = await renovar(cTerminado);
    expect(r.statusCode).toBe(409);
    expect(r.json().message).toMatch(/activo/i);
  });

  it('la fecha nueva tiene que ser posterior a la actual', async () => {
    const r = await renovar(contratoId, { fechaFinNueva: '2026-06-30' });
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toMatch(/posterior/i);
  });

  it('un SOLO_EXPENSAS se renueva por el PLAZO y su canon queda en cero', async () => {
    // Forzar 0 en vez de rechazar es deliberado: la renovación en sí es legítima. Sin esto,
    // el devengo del mes siguiente le facturaba alquiler a alguien que no paga alquiler.
    const r = await renovar(cSoloExpensas, { montoNuevo: CANON_NUEVO });
    expect(r.statusCode).toBe(200);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: cSoloExpensas } });
    expect(Number(c.monto)).toBe(0);
    // Y el historial dice CERO, no el monto que pidió el body: mostrar 500.000 sería
    // anunciar un canon que la base nunca guardó.
    const renov = await prisma.renovacionContrato.findFirstOrThrow({ where: { contratoId: cSoloExpensas } });
    expect(Number(renov.montoNuevo)).toBe(0);
  });
});
