/**
 * T-28 · La rendición excluye del bruto los pagos CONDONADOS y los MIGRADOS de cartera — con
 * una query propia que ningún test ejercitaba.
 *
 * `POST /rendiciones` calcula `montoBruto` con su **propio** `tx.pago.groupBy`
 * (`plata.ts:2270`), que filtra `condonado: false` y `migradoDeCartera: false`. De ese bruto
 * salen `comisionMonto` y `montoNeto`: lo que la inmobiliaria efectivamente le transfiere al
 * propietario.
 *
 * LOS TRES TESTS QUE HABLAN DE ESOS FILTROS MIRAN OTRO CÓDIGO:
 *
 *  · `saldos.test.ts` lee el TEXTO FUENTE de `src/lib/saldos.ts` con `readFileSync`;
 *  · `rendicion-pendiente-solo-rendible.test.ts` espía el `where` de `src/lib/rendicion-pendiente.ts`;
 *  · `cierre-caja-filtros.test.ts` afirma sobre `whereCierreDelDia` de `src/lib/cierre-caja.ts`.
 *
 * Ninguno alcanza `routes/plata.ts`, que tiene su **copia duplicada** de la cuenta. Y del lado
 * del comportamiento: ningún test de la suite crea un `Pago` con `condonado: true`, y el único
 * con `migradoDeCartera: true` lo lee por el portal del propietario y nunca rinde.
 * **Borrar cualquiera de las dos líneas dejaba la suite entera en verde.**
 *
 * QUÉ CUESTA:
 *  · un **condonado** de $100.000 colado en el bruto → la comisión cobra 7% sobre plata que no
 *    entró, y al dueño se le transfiere el neto de un cobro imaginario;
 *  · un **migrado de cartera** → se le vuelve a pagar algo que ya cobró por fuera del sistema.
 *    Y el alta de un contrato en curso registra hasta 120 períodos pasados como pagados, así
 *    que no es una fila suelta: es toda la historia previa del contrato.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): sacando `condonado: false` del groupBy,
 * el bruto pasa de $500.000 a $600.000 y la comisión de $35.000 a $42.000. Sacando
 * `migradoDeCartera: false`, lo mismo en el segundo caso.
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
const prisma = new PrismaClient();

const P = 'rnd_';
const auth = () => ({ authorization: `Bearer ${token}` });

/** Silvana: 100% de prp_002 (contrato cnt_002), comisión 7%. */
const OWNER = 'own_002';
const CONTRATO = 'cnt_002';
/** Período de 2098: nadie más lo devenga, así que el `@@unique([contratoId, periodo])` no choca. */
const PERIODO = '2098-11';

const ALQUILER = 600_000;
const REAL = 500_000; // el pago que sí entró
const FANTASMA = 100_000; // el que no

async function limpiar() {
  const liqs = await prisma.liquidacion.findMany({
    where: { contratoId: CONTRATO, periodo: PERIODO },
    select: { id: true },
  });
  const ids = liqs.map((l) => l.id);
  if (ids.length) {
    await prisma.alquilerRendido.deleteMany({ where: { liquidacionId: { in: ids } } });
    await prisma.pago.deleteMany({ where: { liquidacionId: { in: ids } } });
    await prisma.liquidacion.deleteMany({ where: { id: { in: ids } } });
  }
  // Todo lo que apunta a la Rendición antes que la Rendición: las cuatro FKs son RESTRICT.
  // Los gastos y los movimientos de caja son del seed y NO se borran — se les suelta el
  // vínculo y se les devuelve el `descontadoEnRendicion` para que el archivo quede
  // idempotente y no le arruine el arqueo a los otros 140.
  const rends = await prisma.rendicion.findMany({
    where: { propietarioId: OWNER, periodo: PERIODO },
    select: { id: true },
  });
  const rIds = rends.map((r) => r.id);
  if (rIds.length) {
    await prisma.movimientoCaja.updateMany({
      where: { rendicionId: { in: rIds } },
      data: { rendicionId: null, descontadoEnRendicion: false },
    });
    await prisma.gastoRendido.deleteMany({ where: { rendicionId: { in: rIds } } });
    await prisma.ingresoRendido.deleteMany({ where: { rendicionId: { in: rIds } } });
    await prisma.alquilerRendido.deleteMany({ where: { rendicionId: { in: rIds } } });
    await prisma.rendicion.deleteMany({ where: { id: { in: rIds } } });
  }
}

/**
 * Una cuota de $600.000 con DOS pagos conciliados: uno real de $500.000 y uno de $100.000
 * marcado con la bandera que se le pase. Los dos son CONCILIADO — ésa es la trampa: el
 * `estado` no los distingue, sólo la bandera.
 */
async function armar(bandera: 'condonado' | 'migradoDeCartera') {
  await limpiar();
  await prisma.liquidacion.create({
    data: {
      id: `${P}liq`,
      inmobiliariaId,
      contratoId: CONTRATO,
      periodo: PERIODO,
      montoAlquiler: ALQUILER,
      montoTotal: ALQUILER,
      fechaVencimiento: new Date('2098-11-10T00:00:00.000Z'),
      // PARCIAL: es uno de los dos estados que la rendición mira.
      estado: 'PARCIAL',
      moneda: 'ARS',
    },
  });
  const base = {
    inmobiliariaId,
    contratoId: CONTRATO,
    liquidacionId: `${P}liq`,
    periodo: PERIODO,
    montoLiqTotal: ALQUILER,
    metodo: 'TRANSFERENCIA' as const,
    fechaTransferencia: new Date('2098-11-08T15:00:00.000Z'),
    estado: 'CONCILIADO' as const,
  };
  await prisma.pago.create({
    data: { ...base, id: `${P}real`, tipo: 'PARCIAL', monto: REAL },
  });
  await prisma.pago.create({
    data: { ...base, id: `${P}fantasma`, tipo: 'PARCIAL', monto: FANTASMA, [bandera]: true },
  });
}

const rendir = () =>
  app.inject({
    method: 'POST',
    url: '/rendiciones',
    headers: auth(),
    payload: { propietarioId: OWNER, periodo: PERIODO, metodo: 'TRANSFERENCIA', pin: '1234' },
  });

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
}, 420_000);

afterAll(async () => {
  // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('la deuda CONDONADA no se le rinde al propietario', () => {
  it('el bruto es lo que entró, no lo que figura cobrado', async () => {
    await armar('condonado');
    const r = await rendir();
    expect(r.statusCode).toBe(201);
    const rend = r.json();
    // Con el bug: 600.000. El condonado es plata que la inmobiliaria PERDONÓ: nunca entró.
    expect(Number(rend.montoBruto)).toBe(REAL);
  });

  it('y la comisión no cobra 7% sobre plata que no entró', async () => {
    const rend = await prisma.rendicion.findFirstOrThrow({
      where: { propietarioId: OWNER, periodo: PERIODO },
    });
    // 7% de 500.000 = 35.000. Con el bug: 7% de 600.000 = 42.000.
    expect(Number(rend.comisionMonto)).toBeCloseTo(35_000, 0);
    // El neto se arma como bruto − comisión − gastos, y los gastos son los del seed: se
    // afirma la RELACIÓN y no un número pelado, para que este caso no se rompa el día que
    // alguien le agregue un gasto más a la demo.
    expect(Number(rend.montoNeto)).toBeCloseTo(REAL - 35_000 - Number(rend.totalGastos), 0);
  });
});

describe('ni la plata MIGRADA de cartera, que el dueño ya cobró por fuera', () => {
  it('tampoco entra al bruto', async () => {
    await armar('migradoDeCartera');
    const r = await rendir();
    expect(r.statusCode).toBe(201);
    // Con el bug: 600.000 — y no es una fila suelta. El alta de un contrato en curso
    // registra hasta 120 períodos pasados como pagados para que el saldo del inquilino
    // arranque bien; sin este filtro se le vuelve a pagar al dueño toda esa historia.
    expect(Number(r.json().montoBruto)).toBe(REAL);
  });
});

describe('CONTROL POSITIVO — dos pagos LIMPIOS sí suman los dos', () => {
  it('el filtro excluye por la bandera, no por ser el segundo pago', async () => {
    // Sin este caso, los dos de arriba pasarían igual con un groupBy que se quedara con
    // el primer pago y descartara el resto.
    await limpiar();
    await prisma.liquidacion.create({
      data: {
        id: `${P}liq`,
        inmobiliariaId,
        contratoId: CONTRATO,
        periodo: PERIODO,
        montoAlquiler: ALQUILER,
        montoTotal: ALQUILER,
        fechaVencimiento: new Date('2098-11-10T00:00:00.000Z'),
        estado: 'PAGADO',
        moneda: 'ARS',
      },
    });
    const base = {
      inmobiliariaId,
      contratoId: CONTRATO,
      liquidacionId: `${P}liq`,
      periodo: PERIODO,
      montoLiqTotal: ALQUILER,
      metodo: 'TRANSFERENCIA' as const,
      fechaTransferencia: new Date('2098-11-08T15:00:00.000Z'),
      estado: 'CONCILIADO' as const,
    };
    await prisma.pago.create({ data: { ...base, id: `${P}real`, tipo: 'PARCIAL', monto: REAL } });
    await prisma.pago.create({ data: { ...base, id: `${P}real2`, tipo: 'PARCIAL', monto: FANTASMA } });

    const r = await rendir();
    expect(r.statusCode).toBe(201);
    expect(Number(r.json().montoBruto)).toBe(ALQUILER);
    expect(Number(r.json().comisionMonto)).toBeCloseTo(42_000, 0); // 7% de 600.000
    // La diferencia con el primer caso es exactamente el pago marcado: $100.000 de bruto
    // y $7.000 de comisión. Eso es lo que la bandera decide.
    expect(ALQUILER - REAL).toBe(FANTASMA);
  });
});
