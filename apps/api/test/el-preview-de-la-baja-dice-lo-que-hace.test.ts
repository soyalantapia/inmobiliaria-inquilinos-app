/**
 * TERCERA AUDITORÍA · El preview de la baja contaba pagos MUERTOS; el POST los suelta y anula
 * la cuota igual.
 *
 * `GET /contratos/:id/finalizar-preview` traía las liquidaciones con
 * `_count: { select: { pagos: true } }` —pagos de CUALQUIER estado— y decidía
 * `esFuturaSinPago = … && l._count.pagos === 0`.
 *
 * El `POST /finalizar`, tres párrafos más arriba en el mismo archivo, aplica la regla
 * contraria y la explica: «una cuota futura con sólo un pago rechazado es deuda fantasma
 * igual que una sin pagos», y por eso SUELTA los pagos muertos antes del `deleteMany` para
 * que esa cuota sí se anule.
 *
 * Resultado: una cuota futura con sólo un pago RECHAZADO no entraba en
 * `cuotasFuturasAAnular`, y como tampoco pasa `liqVencida` caía en el `continue` y
 * desaparecía también de `deudaVencida`. **No figuraba en ningún número del diálogo** — y el
 * POST la borraba. El operador confirmaba una baja irreversible sobre un resumen que le
 * ocultaba una cuota.
 *
 * LO QUE FIJA ESTE TEST no es que el número sea uno más: es que el preview y el POST digan
 * LO MISMO. Un preview cuya única garantía es un valor esperado se vuelve a desincronizar la
 * próxima vez que cambie el POST; uno que se compara contra la acción, no.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): volviendo el `_count` a
 * `{ pagos: true }`, el preview dice 2 y el POST anula 3.
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
let contratoId = '';
let inmobiliariaId = '';

const auth = () => ({ authorization: `Bearer ${token}` });
const CANON = 100_000;
/** Tres cuotas futuras: dos limpias y una con un pago RECHAZADO adjunto. */
const FUTURAS = ['2099-04', '2099-05', '2099-06'];

let previewAntes: { cuotasFuturasAAnular: number; deudaVencida: number; cuotasImpagas: number } | null = null;

beforeAll(async () => {
  prisma = new PrismaClient();
  const base = await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  // 🔴 SCOPEADO AL TENANT DEL SEED. Estaba SIN `where`: agarraba la primera propiedad de
  // CUALQUIER inmobiliaria. Mientras la base sólo tuvo el tenant del seed no se notó, pero
  // basta con que otro archivo cree una propiedad ajena —cosa legítima, es como se prueba el
  // aislamiento— para que este test la agarre y el endpoint conteste 404 con el token del
  // seed. El rojo aparece acá y la causa está en el archivo de al lado.
  const prop = await prisma.propiedad.findFirstOrThrow({ where: { inmobiliariaId: base.inmobiliariaId }, select: { id: true, inmobiliariaId: true } });
  inmobiliariaId = prop.inmobiliariaId;
  // Contrato PROPIO: finalizar es destructivo y esta base la comparten 140 archivos. Como no
  // es el `contratoActual` de la propiedad, el updateMany de la finalización no la toca.
  const c = await prisma.contrato.create({
    data: {
      inmobiliariaId,
      propiedadId: prop.id,
      monto: CANON,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2099-12-31'),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 6,
      estado: 'ACTIVO',
    },
  });
  contratoId = c.id;
  for (const periodo of FUTURAS) {
    const liq = await prisma.liquidacion.create({
      data: {
        inmobiliariaId,
        contratoId,
        periodo,
        montoAlquiler: CANON,
        montoTotal: CANON,
        fechaVencimiento: new Date(Date.now() + 90 * 86400000),
        estado: 'PENDIENTE',
      },
    });
    // A la última le colgamos un pago MUERTO: el caso diario de la bandeja —el inquilino
    // subió un comprobante y la operadora lo rechazó—.
    if (periodo === FUTURAS[FUTURAS.length - 1]) {
      await prisma.pago.create({
        data: {
          inmobiliariaId,
          contratoId,
          liquidacionId: liq.id,
          periodo,
          tipo: 'TOTAL',
          monto: CANON,
          metodo: 'TRANSFERENCIA',
          fechaTransferencia: new Date(),
          estado: 'RECHAZADO',
        },
      });
    }
  }
});

afterAll(async () => {
  if (contratoId) {
    // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá y no
    // reaparecer dos archivos después como un error sin relación.
    await prisma.eventoContrato.deleteMany({ where: { contratoId } });
    await prisma.cargoContrato.deleteMany({ where: { contratoId } });
    await prisma.pago.deleteMany({ where: { contratoId } });
    await prisma.liquidacion.deleteMany({ where: { contratoId } });
    await prisma.contrato.deleteMany({ where: { id: contratoId } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('el preview de la baja dice lo que hace la baja', () => {
  it('el escenario se armó: tres cuotas futuras, una con un pago rechazado', async () => {
    expect(contratoId).not.toBe('');
    expect(await prisma.liquidacion.count({ where: { contratoId } })).toBe(3);
    expect(await prisma.pago.count({ where: { contratoId, estado: 'RECHAZADO' } })).toBe(1);
  });

  it('el preview cuenta las TRES', async () => {
    const r = await app.inject({ method: 'GET', url: `/contratos/${contratoId}/finalizar-preview`, headers: auth() });
    expect(r.statusCode).toBe(200);
    previewAntes = r.json();
    // Con el bug: 2. La del pago rechazado no aparecía acá…
    expect(previewAntes?.cuotasFuturasAAnular).toBe(3);
  });

  it('…y tampoco figuraba como deuda: no estaba en NINGÚN número del diálogo', () => {
    // Es futura, así que `liqVencida` da false y nunca entra a deudaVencida ni a impagas.
    // Ese es el punto: con el bug no se la contaba en ningún lado y el POST la borraba.
    expect(previewAntes?.deudaVencida).toBe(0);
    expect(previewAntes?.cuotasImpagas).toBe(0);
  });

  it('y el POST anula EXACTAMENTE las que el preview anunció', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${contratoId}/finalizar`,
      headers: auth(),
      payload: { tipo: 'FINALIZADO' },
    });
    expect(r.statusCode).toBe(200);
    // La aserción que importa: el número que el operador confirmó y el que se ejecutó.
    expect(r.json().cuotasAnuladas).toBe(previewAntes?.cuotasFuturasAAnular);
    expect(await prisma.liquidacion.count({ where: { contratoId } })).toBe(0);
  });
});
