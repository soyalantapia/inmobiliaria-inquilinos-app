/**
 * El cobro DOBLE de un período rendido antes de que existiera el ledger.
 *
 * `alquileres_rendidos` nació el 01/07/2026 y su migración la creó VACÍA, sin backfill —no se
 * puede backfillear: `Rendicion` guarda un total por (dueño, período), no el desglose por
 * liquidación—. En la misma migración se soltó el `@@unique(propietarioId, periodo)`, porque
 * desde entonces un período se rinde en varias tandas a medida que entran los parciales.
 *
 * Resultado: para todo período rendido antes de esa fecha, el anti-doble de `POST /rendiciones`
 * —que se apoya entero en las líneas de ese ledger— leía cero y daba vía libre. El selector de
 * "Mes que rendís" ofrece los últimos seis meses, así que alcanzaba con elegir uno viejo y
 * confirmar: la inmobiliaria transfería de nuevo plata que ya había depositado, y ni la
 * pantalla ni el server decían una palabra.
 *
 * La regla existía SÓLO del lado de lectura (`lib/rendicion-pendiente.ts`), que es lo peor de
 * los dos mundos: el portal del dueño y el "por rendir" del panel tapaban el período, así que
 * el cobro doble no aparecía en ninguna pantalla.
 *
 * El caso simétrico —una rendición ANULADA, que también queda sin líneas— tiene que seguir
 * dejando rendir: ahí volver a rendir es exactamente lo que corresponde.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 'pl_'; // prefijo de los fixtures, para limpiar al final
let app: FastifyInstance;
let token: string;
let inmobiliariaId: string;

const prisma = new PrismaClient();

async function limpiar() {
  await prisma.alquilerRendido.deleteMany({ where: { rendicion: { propietarioId: `${P}own` } } });
  await prisma.gastoRendido.deleteMany({ where: { rendicion: { propietarioId: `${P}own` } } });
  await prisma.ingresoRendido.deleteMany({ where: { rendicion: { propietarioId: `${P}own` } } });
  await prisma.rendicion.deleteMany({ where: { propietarioId: `${P}own` } });
  await prisma.pago.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.liquidacion.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.propiedad.updateMany({ where: { id: { startsWith: P } }, data: { contratoActualId: null } });
  await prisma.eventoContrato.deleteMany({ where: { contrato: { id: { startsWith: P } } } });
  await prisma.contrato.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: { startsWith: P } } });
  await prisma.propietario.deleteMany({ where: { id: `${P}own` } });
  await prisma.propiedad.deleteMany({ where: { id: { startsWith: P } } });
}

/** Un período cobrado entero: liquidación PAGADO + pago CONCILIADO. */
async function periodoCobrado(sufijo: string, periodo: string, monto: number) {
  await prisma.liquidacion.create({
    data: {
      id: `${P}liq${sufijo}`,
      inmobiliariaId,
      contratoId: `${P}cnt`,
      periodo,
      montoAlquiler: monto,
      montoTotal: monto,
      fechaVencimiento: new Date(`${periodo}-10T00:00:00.000Z`),
      estado: 'PAGADO',
    },
  });
  await prisma.pago.create({
    data: {
      id: `${P}pago${sufijo}`,
      inmobiliariaId,
      tipo: 'TOTAL',
      contratoId: `${P}cnt`,
      liquidacionId: `${P}liq${sufijo}`,
      periodo,
      monto,
      montoLiqTotal: monto,
      metodo: 'TRANSFERENCIA',
      fechaTransferencia: new Date(`${periodo}-10T00:00:00.000Z`),
      estado: 'CONCILIADO',
      decididoAt: new Date(`${periodo}-10T00:00:00.000Z`),
    },
  });
}

/**
 * Una rendición como las de antes del 01/07/2026: cabecera con monto y CERO líneas.
 * Es exactamente lo que dejó la migración que creó el ledger vacío.
 */
async function rendicionPreLedger(periodo: string, monto: number, anulada = false) {
  return prisma.rendicion.create({
    data: {
      inmobiliariaId,
      propietarioId: `${P}own`,
      periodo,
      montoBruto: monto,
      comisionPct: 0,
      comisionMonto: 0,
      totalGastos: 0,
      montoNeto: monto,
      moneda: 'ARS',
      metodo: 'TRANSFERENCIA',
      rendidoAt: new Date('2026-06-20T12:00:00.000Z'),
      ...(anulada
        ? { anuladaAt: new Date('2026-06-25T12:00:00.000Z'), motivoAnulacion: 'se rindió el mes equivocado' }
        : {}),
    },
  });
}

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  await limpiar();

  await prisma.propiedad.create({
    data: {
      id: `${P}prop`,
      inmobiliariaId,
      direccion: 'Pre-ledger 456',
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
    },
  });
  await prisma.propietario.create({
    data: {
      id: `${P}own`,
      inmobiliariaId,
      nombre: 'Dueño',
      apellido: 'PreLedger',
      cuit: '20-00000077-9',
      email: 'preledger@test.com',
      telefono: '1100000077',
      comisionPct: 0, // sin comisión: neto = bruto, la cuenta se lee de un vistazo
      cbuAlias: 'pl.alias',
    },
  });
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: `${P}prop`, propietarioId: `${P}own`, porcentaje: 100 },
  });
  await prisma.contrato.create({
    data: {
      id: `${P}cnt`,
      inmobiliariaId,
      propiedadId: `${P}prop`,
      monto: 600_000,
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2027-01-01T00:00:00.000Z'),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      estado: 'ACTIVO',
      modoCobranza: 'INMOBILIARIA',
    },
  });
  await periodoCobrado('A', '2026-05', 600_000);
  await periodoCobrado('B', '2026-04', 600_000);

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
});

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const rendir = (periodo: string) =>
  app.inject({
    method: 'POST',
    url: '/rendiciones',
    headers: auth(token),
    payload: { propietarioId: `${P}own`, periodo, metodo: 'TRANSFERENCIA', pin: '1234' },
  });

describe('Rendir de nuevo un período pre-ledger', () => {
  it('EL BUG: con una rendición vieja sin líneas, el período se frena en 409 (antes pagaba de nuevo)', async () => {
    await rendicionPreLedger('2026-05', 600_000);

    const res = await rendir('2026-05');
    expect(res.statusCode).toBe(409);
    expect(res.json().codigo).toBe('RENDICION_PRE_LEDGER');
    // El mensaje tiene que decir CUÁNDO se rindió: sin eso el operador no puede decidir si
    // fue un error suyo o si de verdad quedó plata afuera.
    expect(res.json().message).toMatch(/ya se le rindió/i);
    expect(res.json().rendidoAt).toBeTruthy();

    // Y no nació una segunda: la de antes sigue siendo la única.
    expect(await prisma.rendicion.count({ where: { propietarioId: `${P}own`, periodo: '2026-05' } })).toBe(1);
  });

  it('una rendición ANULADA no frena nada: ahí volver a rendir es lo correcto', async () => {
    // Anular también deja cabecera con cero líneas, o sea que se ve IGUAL que una pre-ledger.
    // Si el guard no filtrara `anuladaAt: null`, anular dejaría el período muerto para siempre
    // y la plata del dueño sin salida.
    await rendicionPreLedger('2026-04', 600_000, true);

    const res = await rendir('2026-04');
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().montoBruto)).toBe(600_000);

    // Y ésta sí dejó rastro por cuota: es una rendición del mundo con ledger.
    const lineas = await prisma.alquilerRendido.count({
      where: { rendicion: { propietarioId: `${P}own`, periodo: '2026-04' } },
    });
    expect(lineas).toBe(1);
  });

  it('la rendición con líneas sigue funcionando como siempre: la segunda tanda da 409 por sin cobros', async () => {
    // No-regresión del camino normal. 2026-04 ya se rindió entero en el test de arriba y ahora
    // SÍ tiene líneas, así que el que tiene que frenar es el anti-doble de siempre —el del
    // ledger— y no el guard nuevo.
    const res = await rendir('2026-04');
    expect(res.statusCode).toBe(409);
    expect(res.json().codigo).not.toBe('RENDICION_PRE_LEDGER');
    expect(res.json().message).toMatch(/no hay cobros nuevos/i);
  });
});
