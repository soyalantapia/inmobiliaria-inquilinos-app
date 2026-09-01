/**
 * T-28 · El tope GLOBAL del ingreso extra: la aritmética estaba cubierta, el CABLEADO no.
 *
 * Un `MovimientoCaja` de tipo `INGRESO_EXTRA` sobre una propiedad se le acredita al dueño en la
 * rendición: es plata que **sale de la caja de la inmobiliaria** hacia el propietario, no plata
 * del inquilino.
 *
 * Con multi-dueño se rinde por partes (× %) y hay DOS topes: el de cada dueño (`míoIngresoMap`)
 * y el **global** sobre el movimiento (`rendidoIngresoMap`). El comentario del handler describe
 * el caso exacto que este archivo reproduce:
 *
 *   «con sólo el cap por dueño, un ingreso de $100 en una propiedad de A(50%) y B(50%) se
 *   acreditaba $50 a A y —si después se re-arma la participación y B pasa a 100%— $100 más a B.
 *   $150 acreditados sobre $100 que entraron. Y peor: el movimiento queda marcado como cubierto
 *   (50+100 >= 100), así que **el caso se cierra solo y no vuelve a aparecer** para auditarlo.»
 *
 * LA ARITMÉTICA DE LOS DOS TOPES SÍ ESTÁ CUBIERTA, y bien, por `parte-rendible.test.ts` —
 * incluido "el tope GLOBAL frena el doble pago cuando cambian las participaciones". Lo que no
 * estaba cubierto es que el handler **le pase el argumento**: si alguien manda
 * `yaRendidoGlobal: 0`, `parte-rendible.test.ts` sigue verde y el bug vuelve intacto.
 *
 * Y el espejo existe para los GASTOS: `rendicion-multiowner.test.ts` hace exactamente esta
 * secuencia. El de ingresos no existía.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): pasando `yaRendidoGlobal: 0` en la
 * llamada a `parteRendible` de los ingresos, la segunda rendición devuelve $100 en vez de $50
 * y el ledger suma $150 sobre un movimiento de $100.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 'ing_';
let app: FastifyInstance;
let token = '';
let inmobiliariaId = '';
const prisma = new PrismaClient();

const auth = () => ({ authorization: `Bearer ${token}` });
const PERIODO = '2097-05';
const INGRESO = 100;
const ALQUILER = 1000;
const OWN_A = `${P}ownA`;
const OWN_B = `${P}ownB`;

async function limpiar() {
  await prisma.ingresoRendido.deleteMany({ where: { refId: { startsWith: P } } });
  await prisma.gastoRendido.deleteMany({ where: { refId: { startsWith: P } } });
  // AlquilerRendido cuelga de Rendicion con FK RESTRICT → antes que la rendición.
  await prisma.alquilerRendido.deleteMany({ where: { rendicion: { propietarioId: { in: [OWN_A, OWN_B] } } } });
  await prisma.ingresoRendido.deleteMany({ where: { rendicion: { propietarioId: { in: [OWN_A, OWN_B] } } } });
  await prisma.gastoRendido.deleteMany({ where: { rendicion: { propietarioId: { in: [OWN_A, OWN_B] } } } });
  await prisma.movimientoCaja.updateMany({ where: { id: { startsWith: P } }, data: { rendicionId: null } });
  await prisma.rendicion.deleteMany({ where: { propietarioId: { in: [OWN_A, OWN_B] } } });
  await prisma.movimientoCaja.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.pago.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.liquidacion.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.propiedad.updateMany({ where: { id: { startsWith: P } }, data: { contratoActualId: null } });
  await prisma.eventoContrato.deleteMany({ where: { contrato: { id: { startsWith: P } } } });
  await prisma.contrato.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: { startsWith: P } } });
  await prisma.propietario.deleteMany({ where: { id: { in: [OWN_A, OWN_B] } } });
  await prisma.propiedad.deleteMany({ where: { id: { startsWith: P } } });
}

const rendir = (propietarioId: string) =>
  app.inject({
    method: 'POST',
    url: '/rendiciones',
    headers: auth(),
    payload: { propietarioId, periodo: PERIODO, metodo: 'TRANSFERENCIA' },
  });

const ledgerDelIngreso = () =>
  prisma.ingresoRendido.aggregate({ where: { refId: `${P}ingreso` }, _sum: { monto: true } });

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');

  await prisma.propiedad.create({
    data: {
      id: `${P}prop`,
      inmobiliariaId,
      direccion: 'Ingreso Extra 456',
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
    },
  });
  for (const s of ['A', 'B'] as const) {
    await prisma.propietario.create({
      data: {
        id: s === 'A' ? OWN_A : OWN_B,
        inmobiliariaId,
        nombre: `Ingreso${s}`,
        apellido: 'Test',
        cuit: `20-1111111${s === 'A' ? 1 : 2}-9`,
        email: `ingreso${s.toLowerCase()}@ingtest.com`,
        telefono: '1100000000',
        // Sin comisión: el neto es bruto − gastos + ingresos, sin ruido.
        comisionPct: 0,
        cbuAlias: `ing.alias.${s.toLowerCase()}`,
      },
    });
    await prisma.participacionPropietario.create({
      data: { inmobiliariaId, propiedadId: `${P}prop`, propietarioId: s === 'A' ? OWN_A : OWN_B, porcentaje: 50 },
    });
  }
  await prisma.contrato.create({
    data: {
      id: `${P}cnt`,
      inmobiliariaId,
      propiedadId: `${P}prop`,
      monto: ALQUILER,
      fechaInicio: new Date('2097-01-01T00:00:00.000Z'),
      fechaFin: new Date('2098-01-01T00:00:00.000Z'),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      estado: 'ACTIVO',
      modoCobranza: 'INMOBILIARIA',
      moraTipo: 'SIN_MORA',
      devengarDesde: new Date('2098-01-01T00:00:00.000Z'),
    },
  });
  await prisma.liquidacion.create({
    data: {
      id: `${P}liq`,
      inmobiliariaId,
      contratoId: `${P}cnt`,
      periodo: PERIODO,
      montoAlquiler: ALQUILER,
      montoTotal: ALQUILER,
      fechaVencimiento: new Date(`${PERIODO}-10T00:00:00.000Z`),
      estado: 'PAGADO',
      moneda: 'ARS',
    },
  });
  // La rendición es INCREMENTAL desde los pagos CONCILIADO: una liq PAGADO sin fila Pago
  // no tiene nada que rendir (409 "no hay cobros nuevos").
  await prisma.pago.create({
    data: {
      id: `${P}pago`,
      inmobiliariaId,
      contratoId: `${P}cnt`,
      liquidacionId: `${P}liq`,
      periodo: PERIODO,
      tipo: 'TOTAL',
      monto: ALQUILER,
      montoLiqTotal: ALQUILER,
      metodo: 'TRANSFERENCIA',
      fechaTransferencia: new Date(`${PERIODO}-08T15:00:00.000Z`),
      estado: 'CONCILIADO',
    },
  });
  // El ingreso extra: $100 que la inmobiliaria le tiene que acreditar al dueño.
  await prisma.movimientoCaja.create({
    data: {
      id: `${P}ingreso`,
      inmobiliariaId,
      propiedadId: `${P}prop`,
      tipo: 'INGRESO_EXTRA',
      categoria: 'OTRO',
      monto: INGRESO,
      moneda: 'ARS',
      descripcion: 'Ingreso extra multi-dueño (T-28)',
      fecha: new Date(`${PERIODO}-03T00:00:00.000Z`),
      cargadoPor: 'test',
      descontadoEnRendicion: false,
    },
  });
}, 420_000);

afterAll(async () => {
  // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('el ingreso extra se acredita por partes', () => {
  it('A cobra su 50%: $50 de $100', async () => {
    const r = await rendir(OWN_A);
    expect(r.statusCode).toBe(201);
    expect(Number(r.json().totalIngresos)).toBe(INGRESO / 2);
  });

  it('y queda anotado en el ledger', async () => {
    expect(Number((await ledgerDelIngreso())._sum.monto ?? 0)).toBe(INGRESO / 2);
    // Todavía no está cubierto: falta la parte de B.
    const mov = await prisma.movimientoCaja.findUniqueOrThrow({ where: { id: `${P}ingreso` } });
    expect(mov.descontadoEnRendicion).toBe(false);
  });
});

describe('🔴 y si se re-arma la participación, el tope GLOBAL frena el doble pago', () => {
  it('B pasa a 100% y cobra sólo lo que QUEDA: $50, no $100', async () => {
    // El escenario del comentario del handler: A vendió su parte después de que se le
    // rindiera. Sin el tope global, B cobra el ingreso entero.
    await prisma.participacionPropietario.deleteMany({
      where: { propiedadId: `${P}prop`, propietarioId: OWN_A },
    });
    await prisma.participacionPropietario.updateMany({
      where: { propiedadId: `${P}prop`, propietarioId: OWN_B },
      data: { porcentaje: 100 },
    });

    const r = await rendir(OWN_B);
    expect(r.statusCode).toBe(201);
    // Con el bug: 100. Y $150 acreditados sobre $100 que entraron.
    expect(Number(r.json().totalIngresos)).toBe(INGRESO / 2);
  });

  it('el ledger nunca supera lo que entró', async () => {
    // La invariante que importa, escrita como invariante y no como número suelto.
    expect(Number((await ledgerDelIngreso())._sum.monto ?? 0)).toBeLessThanOrEqual(INGRESO);
    expect(Number((await ledgerDelIngreso())._sum.monto ?? 0)).toBe(INGRESO);
  });

  it('y recién ahí el movimiento queda cerrado', async () => {
    const mov = await prisma.movimientoCaja.findUniqueOrThrow({ where: { id: `${P}ingreso` } });
    // Con el bug también quedaba en true (50+100 >= 100), y ése es el agravante: el caso
    // se cierra solo y no vuelve a aparecer para que alguien lo audite.
    expect(mov.descontadoEnRendicion).toBe(true);
  });
});
