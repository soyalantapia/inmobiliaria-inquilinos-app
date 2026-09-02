/**
 * T-20 · Un consorcio con unidades de régimen distinto: una alquilada y otra de sólo expensas.
 *
 * QUÉ SE VERIFICA. El modelo ya lo soporta —`tipoContrato` vive en el CONTRATO, no en el
 * consorcio, así que dos unidades del mismo edificio pueden tener regímenes distintos sin hacer
 * nada especial—. Lo que faltaba era el caso de punta a punta, y sobre todo la pregunta que el
 * propio ticket dejó anotada: *`montoAlquilerSegunTipo` devuelve 0 para SOLO_EXPENSAS, que es
 * correcto, pero **conviene ver qué hace la rendición con eso***.
 *
 * LA RESPUESTA, Y ES EL CASO IMPORTANTE DE ESTE ARCHIVO: la rendición del dueño de la unidad de
 * sólo expensas devuelve **409 "No hay cobros nuevos"**, aunque el inquilino haya pagado la
 * expensa COMPLETA. Y está bien: esa plata es del consorcio, no del propietario — comisionarla o
 * rendirla sería darle al dueño plata que no le toca. Lo que confunde es el mensaje, que dice
 * "no hay cobros" cuando sí los hubo. Está anotado en `work-agent/T-20-REGIMEN-MIXTO.md`.
 *
 * El contraste que le da sentido está en el mismo archivo: la unidad ALQUILADA del MISMO
 * consorcio sí se rinde, y con plata.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 't20-';
const ALQUILER = 400_000;
const EXPENSAS = 150_000;

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
let inmobiliariaId = '';
/** La unidad ALQUILADA y la unidad de SÓLO EXPENSAS, en el mismo consorcio. */
let contratoAlq = '';
let contratoExp = '';
let liqAlq = '';
let liqExp = '';
let periodo = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar(): Promise<void> {
  // Sin `.catch()`: un borrado bloqueado tiene que gritar acá y no aparecer dos pasos después
  // como un "Unique constraint failed" en el `create`, que no nombra la causa.
  const props = [`${P}propAlq`, `${P}propExp`];
  const owners = [`${P}ownAlq`, `${P}ownExp`];
  const ids = (
    await prisma.contrato.findMany({ where: { propiedadId: { in: props } }, select: { id: true } })
  ).map((c) => c.id);
  const deLosDuenios = { rendicion: { propietarioId: { in: owners } } };
  // Los hijos de Rendicion cuelgan con FK RESTRICT → van antes que ella.
  await prisma.alquilerRendido.deleteMany({ where: deLosDuenios });
  await prisma.ingresoRendido.deleteMany({ where: deLosDuenios });
  await prisma.gastoRendido.deleteMany({ where: deLosDuenios });
  await prisma.movimientoCaja.deleteMany({ where: { OR: [deLosDuenios, { contratoId: { in: ids } }] } });
  await prisma.rendicion.deleteMany({ where: { propietarioId: { in: owners } } });
  if (ids.length) {
    await prisma.movimientoFeed.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.pago.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.eventoContrato.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.inquilino.updateMany({ where: { contratoId: { in: ids } }, data: { contratoId: null } });
  }
  await prisma.propiedad.updateMany({ where: { id: { in: props } }, data: { contratoActualId: null } });
  if (ids.length) await prisma.contrato.deleteMany({ where: { id: { in: ids } } });
  await prisma.inquilino.deleteMany({ where: { email: { startsWith: 't20.' } } });
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: { in: props } } });
  await prisma.propiedad.deleteMany({ where: { id: { in: props } } });
  await prisma.propietario.deleteMany({ where: { id: { in: owners } } });
  await prisma.consorcio.deleteMany({ where: { id: `${P}cons` } });
}

/** Da de alta una unidad del consorcio con su dueño y su contrato, por la API de verdad. */
async function altaUnidad(opts: {
  sufijo: 'Alq' | 'Exp';
  direccion: string;
  cuit: string;
  tipoContrato: 'ALQUILER' | 'SOLO_EXPENSAS';
  monto: number;
  montoExpensas?: number;
}): Promise<string> {
  const propId = `${P}prop${opts.sufijo}`;
  const ownId = `${P}own${opts.sufijo}`;
  await prisma.propiedad.create({
    data: {
      id: propId,
      inmobiliariaId,
      consorcioId: `${P}cons`, // ← las DOS unidades cuelgan del MISMO consorcio
      direccion: opts.direccion,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
    },
  });
  await prisma.propietario.create({
    data: {
      id: ownId,
      inmobiliariaId,
      nombre: `Dueño${opts.sufijo}`,
      apellido: 'Mixto',
      cuit: opts.cuit,
      email: `t20.${opts.sufijo.toLowerCase()}.duenio@example.com`,
      telefono: '+54 9 11 6000 0000',
      cbuAlias: `t20.${opts.sufijo.toLowerCase()}.cbu`,
    },
  });
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: propId, propietarioId: ownId, porcentaje: 100 },
  });
  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: auth(token),
    payload: {
      propiedadId: propId,
      inquilino: {
        nombre: `Inq${opts.sufijo}`,
        apellido: 'Mixto',
        email: `t20.${opts.sufijo.toLowerCase()}.inquilino@example.com`,
        telefono: '+54 9 11 6000 0001',
      },
      monto: opts.monto,
      ...(opts.montoExpensas !== undefined ? { montoExpensas: opts.montoExpensas } : {}),
      tipoContrato: opts.tipoContrato,
      moneda: 'ARS',
      fechaInicio: '2026-06-01',
      fechaFin: '2028-05-31',
      diaPago: 5,
      indiceAjuste: 'FIJO',
      frecuenciaAjusteMeses: 12,
    },
  });
  expect(alta.statusCode, `alta ${opts.sufijo} devolvió ${alta.statusCode}: ${alta.body.slice(0, 300)}`).toBe(200);
  return (alta.json() as { id: string }).id;
}

/** La inmobiliaria registra el cobro. Un solo camino, el mismo para las dos unidades. */
async function cobrar(liquidacionId: string, monto: number): Promise<void> {
  const r = await app.inject({
    method: 'POST',
    url: '/pagos/manual',
    headers: auth(token),
    payload: {
      liquidacionId,
      monto,
      metodo: 'TRANSFERENCIA',
      fecha: new Date().toISOString().slice(0, 10),
      nota: 'T-20',
    },
  });
  expect(r.statusCode, `cobrar ${monto} devolvió ${r.statusCode}: ${r.body.slice(0, 250)}`).toBeLessThan(300);
}

const rendir = (propietarioId: string) =>
  app.inject({
    method: 'POST',
    url: '/rendiciones',
    headers: auth(token),
    payload: { propietarioId, periodo, metodo: 'TRANSFERENCIA' },
  });

beforeAll(async () => {
  prisma = new PrismaClient();
  inmobiliariaId = (await seedBase(prisma)).inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');

  await prisma.consorcio.create({
    data: {
      id: `${P}cons`,
      inmobiliariaId,
      nombre: 'Edificio Mixto',
      direccion: 'Mixto 1000',
      cantUf: 2,
      periodoActual: '2026-06',
      expensasPeriodoActual: EXPENSAS,
      desde: new Date('2020-01-01T00:00:00.000Z'),
    },
  });

  contratoAlq = await altaUnidad({
    sufijo: 'Alq',
    direccion: 'Mixto 1000 - 1A',
    cuit: '20-00000020-5',
    tipoContrato: 'ALQUILER',
    monto: ALQUILER,
  });
  contratoExp = await altaUnidad({
    sufijo: 'Exp',
    direccion: 'Mixto 1000 - 2B',
    cuit: '27-00000021-6',
    tipoContrato: 'SOLO_EXPENSAS',
    monto: 0,
    montoExpensas: EXPENSAS,
  });

  const cuotas = await prisma.liquidacion.findMany({
    where: { contratoId: { in: [contratoAlq, contratoExp] } },
    orderBy: { periodo: 'asc' },
  });
  const primeraAlq = cuotas.find((l) => l.contratoId === contratoAlq);
  const primeraExp = cuotas.find((l) => l.contratoId === contratoExp);
  expect(primeraAlq, 'la unidad alquilada no devengó ninguna cuota').toBeTruthy();
  expect(primeraExp, 'la unidad de sólo expensas no devengó ninguna cuota').toBeTruthy();
  liqAlq = primeraAlq!.id;
  liqExp = primeraExp!.id;
  // Las dos arrancan el mismo mes: se rinde el MISMO período en las dos puntas.
  expect(primeraAlq!.periodo).toBe(primeraExp!.periodo);
  periodo = primeraAlq!.periodo;
});

afterAll(async () => {
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('T-20 — un consorcio con unidades de regímenes distintos', () => {
  it('las dos unidades cuelgan del mismo consorcio', async () => {
    const props = await prisma.propiedad.findMany({ where: { consorcioId: `${P}cons` }, select: { id: true } });
    expect(props.map((p) => p.id).sort()).toEqual([`${P}propAlq`, `${P}propExp`]);
  });

  it('cada una devenga según SU tipo, sin pisarse', async () => {
    const a = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liqAlq } });
    expect(Number(a.montoAlquiler)).toBe(ALQUILER);
    expect(Number(a.montoTotal)).toBe(ALQUILER);

    const e = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liqExp } });
    // `montoAlquilerSegunTipo` da 0 para SOLO_EXPENSAS: la unidad no cobra alquiler.
    expect(Number(e.montoAlquiler)).toBe(0);
    expect(Number(e.montoExpensas)).toBe(EXPENSAS);
    expect(Number(e.montoTotal)).toBe(EXPENSAS);
  });

  it('la unidad ALQUILADA se rinde, y con plata', async () => {
    await cobrar(liqAlq, ALQUILER);
    const r = await rendir(`${P}ownAlq`);
    expect(r.statusCode, `rendir alquilada devolvió ${r.statusCode}: ${r.body.slice(0, 250)}`).toBe(201);
    expect(Number((r.json() as { montoBruto: unknown }).montoBruto)).toBeCloseTo(ALQUILER, 2);
  });

  it('🔴 la unidad de SÓLO EXPENSAS no se rinde, aunque el inquilino haya pagado todo', async () => {
    // El inquilino paga la expensa COMPLETA...
    await cobrar(liqExp, EXPENSAS);
    const cobrado = await prisma.pago.aggregate({
      where: { liquidacionId: liqExp, estado: 'CONCILIADO' },
      _sum: { monto: true },
    });
    expect(Number(cobrado._sum.monto), 'el cobro no quedó conciliado; el caso no probaría nada').toBe(EXPENSAS);

    // ...y aun así no hay nada que rendirle al dueño: esa plata es del CONSORCIO.
    const r = await rendir(`${P}ownExp`);
    expect(r.statusCode).toBe(409);
    // El mensaje dice "no hay cobros" y sí los hubo. Es correcto en la plata y engañoso en el
    // texto; queda anotado en el relevamiento, no se cambia acá.
    expect((r.json() as { message: string }).message).toContain('No hay cobros nuevos');
  });

  it('y no quedó ninguna rendición del dueño de sólo expensas', async () => {
    // El control de que el 409 no dejó nada a medio escribir.
    expect(await prisma.rendicion.count({ where: { propietarioId: `${P}ownExp` } })).toBe(0);
    expect(await prisma.rendicion.count({ where: { propietarioId: `${P}ownAlq` } })).toBe(1);
  });
});
