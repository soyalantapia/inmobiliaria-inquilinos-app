/**
 * T-19 · El alquiler y las expensas son UNA sola deuda, y se pagan en UNA sola operación.
 *
 * POR QUÉ ESTE TEST. No es un pedido de feature: es el miedo más grande de Camila sobre la parte
 * de consorcio — *"si yo te lo separo, que tengas que hacer dos transferencias o entrar a dos
 * lugares distintos para pagarme el alquiler y las expensas, no cobro más, la gente no la paga"*.
 * El backlog decía "ya está como ella quiere". Esto lo demuestra de punta a punta, para poder
 * mostrárselo en vez de afirmárselo.
 *
 * Y hasta acá NINGÚN test cubría el camino completo de un contrato `ALQUILER_Y_EXPENSAS`: el
 * devengo mixto estaba probado como función pura, y el informar/validar estaba probado sobre
 * contratos de sólo alquiler. El cruce de los dos —que es justo lo que Camila pregunta— no
 * estaba.
 *
 * EL CASO QUE LO PRUEBA DE VERDAD es el tercero: pagar EXACTAMENTE el alquiler **no salda la
 * cuota**, quedan debiendo las expensas. Si fueran dos deudas, ahí habría una en cero y otra
 * entera. Y el cuarto: esa misma plata, al rendirse, llega al dueño **prorrateada** y no como
 * "el alquiler completo", porque no existe "la plata del alquiler" separada de "la de las
 * expensas": hay un solo cobro contra un solo total.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 't19-';
const EMAIL = 't19.inquilino@example.com';
const ALQUILER = 500_000;
const EXPENSAS = 100_000;
const TOTAL = ALQUILER + EXPENSAS;

let app: FastifyInstance;
let prisma: PrismaClient;
let tokenAdmin = '';
let tokenInquilino = '';
let contratoId = '';
let liqId = '';
let periodo = '';
let inmobiliariaId = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const hoy = () => new Date().toISOString().slice(0, 10);

/** Lee la cuota bajo prueba tal como la ve el inquilino en la PWA. */
async function miCuota(): Promise<Record<string, unknown>> {
  const r = await app.inject({ method: 'GET', url: '/mis-liquidaciones', headers: auth(tokenInquilino) });
  expect(r.statusCode).toBe(200);
  const fila = (r.json() as Array<Record<string, unknown>>).find((l) => l.id === liqId);
  expect(fila, `la cuota ${liqId} no aparece en /mis-liquidaciones`).toBeTruthy();
  return fila as Record<string, unknown>;
}

/** El inquilino informa un pago y la inmobiliaria lo concilia: un solo movimiento de plata. */
async function pagarYConciliar(monto: number, nro: string): Promise<void> {
  const inf = await app.inject({
    method: 'POST',
    url: '/pagos/informar',
    headers: auth(tokenInquilino),
    payload: {
      liquidacionId: liqId,
      monto,
      metodo: 'TRANSFERENCIA',
      nroOperacion: nro,
      fechaTransferencia: hoy(),
    },
  });
  expect(inf.statusCode, `informar ${monto} devolvió ${inf.statusCode}: ${inf.body.slice(0, 250)}`).toBe(200);
  const cuerpo = inf.json() as { id?: string; pago?: { id?: string } };
  const pagoId = cuerpo.id ?? cuerpo.pago?.id;
  expect(pagoId, `informar no devolvió un id de pago: ${inf.body.slice(0, 250)}`).toBeTruthy();
  const val = await app.inject({ method: 'POST', url: `/pagos/${pagoId}/validar`, headers: auth(tokenAdmin) });
  expect(val.statusCode, `validar devolvió ${val.statusCode}: ${val.body.slice(0, 250)}`).toBe(200);
}

beforeAll(async () => {
  prisma = new PrismaClient();
  inmobiliariaId = (await seedBase(prisma)).inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tokenAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');

  // Escenario propio: el seed no tiene ningún ALQUILER_Y_EXPENSAS ACTIVO (el único, cnt_008,
  // es BORRADOR pendiente de aprobación, y un borrador no acepta pagos).
  await prisma.propiedad.create({
    data: {
      id: `${P}prop`,
      inmobiliariaId,
      direccion: 'Unificado 123',
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
    },
  });
  await prisma.propietario.create({
    data: {
      id: `${P}own`,
      inmobiliariaId,
      nombre: 'Dueña',
      apellido: 'Unificado',
      cuit: '27-00000019-4',
      email: 't19.duenia@example.com',
      telefono: '+54 9 11 5000 0001',
      cbuAlias: 't19.duenia.cbu',
    },
  });
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: `${P}prop`, propietarioId: `${P}own`, porcentaje: 100 },
  });

  // El alta va por la API de verdad: es el camino que usa Camila.
  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: auth(tokenAdmin),
    payload: {
      propiedadId: `${P}prop`,
      inquilino: { nombre: 'Inquilino', apellido: 'Unificado', email: EMAIL, telefono: '+54 9 11 5000 0000' },
      monto: ALQUILER,
      montoExpensas: EXPENSAS,
      tipoContrato: 'ALQUILER_Y_EXPENSAS',
      moneda: 'ARS',
      fechaInicio: '2026-06-01',
      fechaFin: '2028-05-31',
      diaPago: 5,
      indiceAjuste: 'FIJO',
      frecuenciaAjusteMeses: 12,
    },
  });
  expect(alta.statusCode, `el alta devolvió ${alta.statusCode}: ${alta.body.slice(0, 300)}`).toBe(200);
  const altaBody = alta.json() as { id?: string; contrato?: { id?: string } };
  contratoId = (altaBody.id ?? altaBody.contrato?.id) as string;
  expect(contratoId, `el alta no devolvió un id: ${alta.body.slice(0, 300)}`).toBeTruthy();

  const liqs = await prisma.liquidacion.findMany({ where: { contratoId }, orderBy: { periodo: 'asc' } });
  const primera = liqs[0];
  expect(primera, 'el alta no devengó ninguna cuota').toBeTruthy();
  liqId = primera!.id;
  periodo = primera!.periodo;

  // El OTP en test acepta el código fijo; así entra el inquilino a SU contrato.
  const verify = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email: EMAIL, code: '000000' } });
  expect(verify.statusCode, `otp/verify devolvió ${verify.statusCode}: ${verify.body.slice(0, 250)}`).toBe(200);
  const { personaToken, alquileres } = verify.json() as {
    personaToken: string;
    alquileres: Array<{ inquilinoId: string }>;
  };
  const mio = alquileres.find((a) => a.inquilinoId);
  expect(mio, `otp/verify no listó ningún alquiler para ${EMAIL}`).toBeTruthy();
  const elegir = await app.inject({
    method: 'POST',
    url: '/auth/inquilino/elegir',
    headers: auth(personaToken),
    payload: { inquilinoId: mio!.inquilinoId },
  });
  expect(elegir.statusCode, `elegir devolvió ${elegir.statusCode}: ${elegir.body.slice(0, 250)}`).toBe(200);
  tokenInquilino = (elegir.json() as { token: string }).token;
});

/**
 * Borra TODO lo que arma este archivo. Se llama dos veces: al empezar y al terminar.
 *
 * Al EMPEZAR no es paranoia: si una corrida anterior murió en el `beforeAll` —como pasó
 * mientras se escribía esto—, el `afterAll` no alcanza a limpiar y la propiedad queda en la
 * base. La segunda corrida entonces falla con "Unique constraint failed on (`id`)" y el error
 * no dice nada del defecto real. La base de test es COMPARTIDA entre archivos y persiste entre
 * corridas: un escenario que no se puede volver a armar sólo funciona una vez.
 */
async function limpiar(): Promise<void> {
  // SIN `.catch()`: un borrado que falla tiene que gritar acá y no dos pasos más adelante como
  // un "Unique constraint failed" en el `create`, que es lo que pasó escribiendo esto. Tapar el
  // error convirtió una FK bloqueada en un mensaje que no nombraba la causa.
  const ids = (await prisma.contrato.findMany({ where: { propiedadId: `${P}prop` }, select: { id: true } })).map(
    (c) => c.id,
  );
  const deLaDuenia = { rendicion: { propietarioId: `${P}own` } };
  // Los tres hijos de Rendicion cuelgan con FK RESTRICT → van antes que ella.
  await prisma.alquilerRendido.deleteMany({ where: deLaDuenia });
  await prisma.ingresoRendido.deleteMany({ where: deLaDuenia });
  await prisma.gastoRendido.deleteMany({ where: deLaDuenia });
  await prisma.movimientoCaja.deleteMany({ where: { OR: [deLaDuenia, { contratoId: { in: ids } }] } });
  await prisma.rendicion.deleteMany({ where: { propietarioId: `${P}own` } });
  if (ids.length) {
    await prisma.movimientoFeed.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.pago.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.eventoContrato.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.inquilino.updateMany({ where: { contratoId: { in: ids } }, data: { contratoId: null } });
  }
  await prisma.propiedad.updateMany({ where: { id: `${P}prop` }, data: { contratoActualId: null } });
  if (ids.length) await prisma.contrato.deleteMany({ where: { id: { in: ids } } });
  await prisma.inquilino.deleteMany({ where: { email: EMAIL } });
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: `${P}prop` } });
  await prisma.propiedad.deleteMany({ where: { id: `${P}prop` } });
  await prisma.propietario.deleteMany({ where: { id: `${P}own` } });
}

afterAll(async () => {
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('T-19 — alquiler + expensas: una sola deuda, una sola operación', () => {
  it('la cuota nace con UN total: alquiler + expensas', async () => {
    const l = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liqId } });
    expect(Number(l.montoAlquiler)).toBe(ALQUILER);
    expect(Number(l.montoExpensas)).toBe(EXPENSAS);
    expect(Number(l.montoTotal)).toBe(TOTAL);
  });

  it('el inquilino ve UNA fila por período, no una de alquiler y otra de expensas', async () => {
    const r = await app.inject({ method: 'GET', url: '/mis-liquidaciones', headers: auth(tokenInquilino) });
    const delPeriodo = (r.json() as Array<{ periodo: string }>).filter((l) => l.periodo === periodo);
    expect(delPeriodo).toHaveLength(1);
    // Y lo que la PWA le ofrece pagar es el TOTAL, no el alquiler.
    expect(Number((await miCuota()).saldo)).toBe(TOTAL);
  });

  it('🔴 pagar EXACTAMENTE el alquiler NO salda la cuota: quedan debiendo las expensas', async () => {
    // Éste es el caso que prueba que es UNA deuda. Si fueran dos, acá habría una en cero.
    await pagarYConciliar(ALQUILER, 'T19-PARCIAL');
    const l = await miCuota();
    expect(Number(l.montoPagado)).toBe(ALQUILER);
    expect(Number(l.saldo)).toBe(EXPENSAS);
    const row = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liqId } });
    expect(row.estado).not.toBe('PAGADO');
  });

  it('esa plata llega al dueño PRORRATEADA, no como "el alquiler completo"', async () => {
    // No existe "la plata del alquiler" separada de "la de las expensas": hay un solo cobro
    // contra un solo total, así que lo rendible es la porción de alquiler de lo COBRADO.
    //   500.000 cobrados sobre un total de 600.000 → 500.000 × (500.000/600.000) = 416.666,67
    const esperado = Math.round(ALQUILER * (ALQUILER / TOTAL) * 100) / 100;
    const r = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(tokenAdmin),
      payload: { propietarioId: `${P}own`, periodo, metodo: 'TRANSFERENCIA' },
    });
    expect(r.statusCode, `rendir devolvió ${r.statusCode}: ${r.body.slice(0, 300)}`).toBe(201);
    const bruto = Number((r.json() as { montoBruto: unknown }).montoBruto);
    expect(bruto).toBeCloseTo(esperado, 2);
    // El control que le da sentido: NO es el alquiler entero.
    expect(bruto).toBeLessThan(ALQUILER);
  });

  it('completando el saldo con UNA segunda operación, la cuota queda saldada', async () => {
    await pagarYConciliar(EXPENSAS, 'T19-RESTO');
    const l = await miCuota();
    expect(Number(l.saldo)).toBe(0);
    expect(Number(l.montoPagado)).toBe(TOTAL);
    const row = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liqId } });
    expect(row.estado).toBe('PAGADO');
  });
});
