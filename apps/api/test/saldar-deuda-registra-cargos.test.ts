/**
 * `POST /contratos/:id/saldar-deuda` — que la plata del CARGO quede registrada.
 *
 * EL BUG, Y POR QUÉ ES EL MISMO DE ANTES. `POST /cargos/:id/saldar` ya arregló exactamente
 * esto: antes sólo marcaba `saldadoAt` y la plata no entraba a ningún lado. Su comentario lo
 * dice con la cita de la clienta — *"Cobrabas una reparación, al inquilino se le borraba la
 * deuda y en la caja no figuraba un peso"* (Camila 46:37) — y el commit que lo cerró
 * (`40625049`, "plata de cargos sin registrar") **tocó sólo ese endpoint**.
 *
 * `saldar-deuda` salda los MISMOS cargos y nunca registró nada. O sea que el mismo cobro
 * entraba a caja o no **según por qué pantalla hubiera entrado la operadora**: "Marcar
 * cobrado" lo registraba, "Saldar deuda" lo hacía desaparecer.
 *
 * Y no es sólo la caja: la rendición levanta `INGRESO_EXTRA` con `descontadoEnRendicion:
 * false` y se lo acredita al propietario. Sin el movimiento, al dueño tampoco le llega.
 *
 * CONDONAR ES DISTINTO. Condonar es perdonar: no entró plata, así que no hay ingreso que
 * registrar. El test 3 fija eso, porque "arreglarlo" creando el ingreso siempre sería inventar
 * un cobro que nunca existió.
 *
 * CONTRATO PROPIO Y NO UNO DEL SEED: `saldar-deuda` concilia TODAS las cuotas exigibles del
 * contrato, así que usar uno del seed le cambiaría los conteos a los otros archivos de la
 * corrida. Éste nace sin liquidaciones: lo único que tiene para saldar son sus cargos.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';
import { borrarContratosDeTest } from '../prisma/borrar-contratos-de-test.js';

let app: FastifyInstance;
let token: string;
const prismaTest = new PrismaClient();
const auth = () => ({ authorization: `Bearer ${token}` });

const P = 'ZZsdc-';
const CNT = `${P}cnt`;
const PRP = `${P}prp`;
let inmobiliariaId = '';

async function limpiar() {
  await prismaTest.movimientoCaja.deleteMany({ where: { contratoId: CNT } });
  await borrarContratosDeTest(prismaTest, [CNT]);
  await prismaTest.propiedad.deleteMany({ where: { id: PRP } });
}

beforeAll(async () => {
  const base = await seedBase(prismaTest);
  inmobiliariaId = base.inmobiliariaId;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
});

beforeEach(async () => {
  await limpiar();
  await prismaTest.propiedad.create({
    data: { id: PRP, inmobiliariaId, direccion: `${P}Local`, ciudad: 'X', provincia: 'X', tipo: 'LOCAL' },
  });
  await prismaTest.contrato.create({
    data: {
      id: CNT,
      inmobiliariaId,
      propiedadId: PRP,
      estado: 'ACTIVO',
      monto: 100_000,
      moneda: 'ARS',
      // Arranca en el futuro a propósito: sin cuotas exigibles, lo único que `saldar-deuda`
      // tiene para hacer son los cargos. Es lo que este archivo mide.
      fechaInicio: new Date(Date.UTC(2027, 0, 1)),
      fechaFin: new Date(Date.UTC(2028, 0, 1)),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 6,
      devengarDesde: null,
      tipoContrato: 'ALQUILER',
    },
  });
});

afterAll(async () => {
  await limpiar();
  await app.close();
  await prismaTest.$disconnect();
});

const crearCargo = (concepto: string, monto = 80_000, moneda: 'ARS' | 'USD' = 'ARS') =>
  prismaTest.cargoContrato.create({
    data: { inmobiliariaId, contratoId: CNT, tipo: 'REPARACION', concepto, monto, moneda, contraDeposito: false },
  });

const ingresos = () =>
  prismaTest.movimientoCaja.findMany({ where: { contratoId: CNT, tipo: 'INGRESO_EXTRA' } });

const saldar = (payload: object = {}) =>
  app.inject({ method: 'POST', url: `/contratos/${CNT}/saldar-deuda`, headers: auth(), payload });

describe('saldar-deuda registra la plata de los cargos', () => {
  it('el cargo queda saldado Y su plata entra a la caja', async () => {
    const cargo = await crearCargo('Cambio de termotanque');
    const r = await saldar({ metodo: 'EFECTIVO' });
    expect(r.statusCode).toBe(200);

    const despues = await prismaTest.cargoContrato.findUniqueOrThrow({ where: { id: cargo.id } });
    expect(despues.saldadoAt).not.toBeNull();

    const movs = await ingresos();
    expect(movs).toHaveLength(1); // con el bug: 0 — la deuda desaparecía y la plata no entraba
    expect(Number(movs[0]!.monto)).toBe(80_000);
    expect(movs[0]!.descripcion).toContain('Cambio de termotanque');
  });

  it('un cargo en dólares NO se registra como pesos', async () => {
    // `MovimientoCaja.moneda` es @default(ARS): omitirla no falla, deja US$800 anotados como
    // $800 —el monto correcto en la unidad equivocada— y la fila ya no dice de dónde vino.
    await crearCargo('Reparación en USD', 800, 'USD');
    expect((await saldar()).statusCode).toBe(200);
    const movs = await ingresos();
    expect(movs).toHaveLength(1);
    expect(movs[0]!.moneda).toBe('USD');
  });

  it('condonar NO inventa un ingreso: perdonar no es cobrar', async () => {
    const cargo = await crearCargo('Reparación perdonada');
    expect((await saldar({ condonar: true })).statusCode).toBe(200);

    const despues = await prismaTest.cargoContrato.findUniqueOrThrow({ where: { id: cargo.id } });
    expect(despues.saldadoAt).not.toBeNull(); // la deuda se limpia igual
    expect(await ingresos()).toHaveLength(0); // pero no entró un peso
  });

  it('saldar dos veces no duplica el ingreso', async () => {
    await crearCargo('Cargo de una sola vez');
    expect((await saldar()).statusCode).toBe(200);
    expect((await saldar()).statusCode).toBe(200);
    // El `updateMany` condicionado a `saldadoAt: null` es el lock: la segunda pasada no
    // matchea ninguna fila y no llega a crear el movimiento. Es la lección de T-55.
    expect(await ingresos()).toHaveLength(1);
  });

  it('🔴 el ingreso dice de QUÉ cargo salió, no sólo su texto', async () => {
    // T-28-N1-N1. `POST /cargos/:id/saldar` escribe `cargoId` desde el 31/08; este hermano
    // —que salda los MISMOS cargos— no lo hacía. Es la misma asimetría que ya pasó una vez
    // con el registro del ingreso: el arreglo llegó a una pantalla y no a la otra.
    //
    // Con dos cargos gemelos —igual concepto, igual monto, igual moneda— el único vínculo
    // que quedaba era la descripción, y `descobrar` desempataba por el más reciente. Si el
    // ingreso del primero ya se le rindió al propietario, deshacer ese primero le borraba el
    // movimiento del SEGUNDO: el inquilino vuelve a deber la plata y al dueño se le acredita
    // igual. Ese 409 que protege el caso sólo puede existir si la fila sabe de quién es.
    const a = await crearCargo('Cargo gemelo');
    const b = await crearCargo('Cargo gemelo');
    expect((await saldar()).statusCode).toBe(200);

    const movs = await ingresos();
    expect(movs).toHaveLength(2);
    // Con el bug: dos filas con `cargoId: null`, indistinguibles entre sí.
    expect(new Set(movs.map((m) => m.cargoId))).toEqual(new Set([a.id, b.id]));
  });

  it('y por eso deshacer borra el movimiento del cargo correcto', async () => {
    const a = await crearCargo('Gemelo con historia');
    const b = await crearCargo('Gemelo con historia');
    expect((await saldar()).statusCode).toBe(200);

    // Al ingreso de `a` ya se le rindió al propietario: a partir de acá los dos movimientos
    // dejan de ser fungibles.
    const movA = (await ingresos()).find((m) => m.cargoId === a.id);
    expect(movA, 'sin cargoId no se puede ni armar el escenario').toBeTruthy();
    await prismaTest.movimientoCaja.update({
      where: { id: movA!.id },
      data: { descontadoEnRendicion: true },
    });

    const r = await app.inject({
      method: 'POST',
      url: `/cargos/${a.id}/descobrar`,
      headers: auth(),
    });
    // Frena, no deshace: el ingreso de ESE cargo ya se rindió. Con el vínculo por texto,
    // `descobrar` encontraba el de `b` —sin rendir— y lo borraba con un 200 tranquilo.
    expect(r.statusCode).toBe(409);
    const quedan = await ingresos();
    expect(quedan).toHaveLength(2);
    expect(quedan.some((m) => m.cargoId === b.id)).toBe(true);
  });

  it('los cargos CONTRA DEPÓSITO no se tocan (se netean del depósito, no se cobran)', async () => {
    const contra = await prismaTest.cargoContrato.create({
      data: { inmobiliariaId, contratoId: CNT, tipo: 'REPARACION', concepto: 'Contra depósito', monto: 50_000, contraDeposito: true },
    });
    expect((await saldar()).statusCode).toBe(200);
    const despues = await prismaTest.cargoContrato.findUniqueOrThrow({ where: { id: contra.id } });
    expect(despues.saldadoAt).toBeNull();
    expect(await ingresos()).toHaveLength(0);
  });
});
