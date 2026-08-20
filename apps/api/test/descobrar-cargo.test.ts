/**
 * `POST /cargos/:id/descobrar` — deshacer el "Marcar cobrado" de un cargo del inquilino.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. `saldar` tiene tests desde que se arregló su bug —"cobrabas
 * una reparación, al inquilino se le borraba la deuda y en la caja no figuraba un peso"—.
 * Su inverso no tenía ninguno. Y ahí estaba el agujero: `descobrar` limpiaba `saldadoAt` y
 * **no tocaba el `INGRESO_EXTRA` que `saldar` había dejado en la caja**.
 *
 * QUÉ COSTABA, EN PLATA. El comentario que justificaba la asimetría (`plata.ts`, en `saldar`)
 * decía que *"la rendición al propietario filtra `tipo: 'GASTO'`, así que un INGRESO_EXTRA no
 * le altera la liquidación al dueño"*. Eso fue cierto y **dejó de serlo**: hoy la rendición
 * levanta explícitamente `tipo: 'INGRESO_EXTRA'` con `descontadoEnRendicion: false` y se lo
 * **acredita** al propietario. Entonces:
 *
 *   Cobrado ($180.000 entran a caja) → Deshacer (el cargo vuelve a ser deuda, el ingreso
 *   QUEDA) → Cobrado otra vez (segundo ingreso de $180.000).
 *
 * Resultado: dos ingresos por una sola cobranza, los dos rendibles al dueño. Y con un solo
 * Deshacer, sin recobrar, ya alcanza para lo peor: el inquilino vuelve a deber la plata **y**
 * al propietario se le acredita igual. El botón Deshacer está a un click del botón Cobrado.
 *
 * QUÉ FIJA CADA TEST. El caso 1 es el bug puro. El 2 es la consecuencia cara. El 5 es el borde
 * que impide "arreglarlo" de la forma ingenua: si el ingreso YA se le rindió al propietario,
 * borrarlo en silencio deja la rendición apuntando a un movimiento que no existe — ahí hay que
 * frenar, no deshacer.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let tokenAdmin: string;
const prismaTest = new PrismaClient();

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

/** Todo lo que crea este archivo arranca con esto, para poder barrerlo sin tocar el seed. */
const PREFIJO = 'QA descobrar';

/** Datos del contrato del seed sobre el que se cuelgan los cargos de prueba. */
let contrato: { id: string; inmobiliariaId: string; propiedadId: string };

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const admin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  tokenAdmin = admin.json().token;

  const c = await prismaTest.contrato.findFirst({
    where: { id: 'cnt_001' },
    select: { id: true, inmobiliariaId: true, propiedadId: true },
  });
  expect(c).toBeTruthy();
  contrato = c!;
});

beforeEach(limpiarResiduo);

afterAll(async () => {
  await limpiarResiduo();
  await app.close();
  await prismaTest.$disconnect();
});

/**
 * Crea un cargo propio del test.
 *
 * El concepto arranca con `PREFIJO` para que `limpiarResiduo` lo barra: la base de test es
 * efímera pero la comparten los archivos de una misma corrida, y un cargo colgado le cambia
 * el total adeudado a los tests del inquilino.
 */
async function crearCargo(concepto: string, monto = 180000) {
  return prismaTest.cargoContrato.create({
    data: {
      inmobiliariaId: contrato.inmobiliariaId,
      contratoId: contrato.id,
      tipo: 'REPARACION',
      concepto,
      monto,
      contraDeposito: false,
    },
  });
}

function ingresosDe(concepto: string) {
  return prismaTest.movimientoCaja.findMany({
    where: {
      contratoId: contrato.id,
      tipo: 'INGRESO_EXTRA',
      descripcion: { contains: concepto },
    },
  });
}

/**
 * Borra TODO lo que dejó este archivo, y corre ANTES de cada caso.
 *
 * Va antes y no después a propósito: un test que falla no llega a su limpieza, así que con
 * limpieza al final la primera corrida en rojo envenena a todas las siguientes —los ingresos
 * se acumulan y los casos empiezan a fallar por residuo y no por el código—. Pasó exactamente
 * eso al escribir este archivo: la segunda corrida veía 3 ingresos donde debía haber 1.
 */
async function limpiarResiduo() {
  const movs = await prismaTest.movimientoCaja.findMany({
    where: { tipo: 'INGRESO_EXTRA', descripcion: { contains: PREFIJO } },
    select: { id: true },
  });
  if (movs.length) {
    const ids = movs.map((m) => m.id);
    await prismaTest.ingresoRendido.deleteMany({ where: { refId: { in: ids } } });
    await prismaTest.movimientoCaja.deleteMany({ where: { id: { in: ids } } });
  }
  await prismaTest.cargoContrato.deleteMany({ where: { concepto: { startsWith: PREFIJO } } });
}

describe('Deshacer el cobro de un cargo', () => {
  it('descobrar saca de la caja el ingreso que había dejado saldar', async () => {
    // EL BUG. Sin el fix, el ingreso sobrevive al Deshacer: el inquilino vuelve a deber la
    // plata y la caja sigue diciendo que entró. Las dos afirmaciones no pueden ser ciertas
    // a la vez.
    const concepto = 'QA descobrar simple';
    const cargo = await crearCargo(concepto);

    await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tokenAdmin) });
    expect(await ingresosDe(concepto)).toHaveLength(1);

    const res = await app.inject({
      method: 'POST',
      url: `/cargos/${cargo.id}/descobrar`,
      headers: auth(tokenAdmin),
    });
    expect(res.statusCode).toBe(200);

    expect(await ingresosDe(concepto)).toHaveLength(0);

    // Y el cargo volvió a ser deuda: es la mitad que ya funcionaba, y tiene que seguir así.
    const despues = await prismaTest.cargoContrato.findUnique({ where: { id: cargo.id } });
    expect(despues!.saldadoAt).toBeNull();
    expect(despues!.saldadoPorId).toBeNull();

  });

  it('cobrar → deshacer → cobrar deja UN ingreso, no dos', async () => {
    // LA CONSECUENCIA CARA. Es el camino que el propio producto le pide al operador: el corte
    // anti-doble-cobro de imputarCostoReclamo lo manda a deshacer para poder reimputar. Sin el
    // fix, cada vuelta por ese camino deja otro ingreso rendible al dueño por la MISMA
    // reparación.
    const concepto = 'QA descobrar y recobrar';
    const cargo = await crearCargo(concepto);

    await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tokenAdmin) });
    await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/descobrar`, headers: auth(tokenAdmin) });
    await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tokenAdmin) });

    const movs = await ingresosDe(concepto);
    expect(movs).toHaveLength(1);
    // Y por el monto real, una sola vez. Si alguna vez se "arregla" sumando en vez de
    // reemplazando, esto lo agarra.
    expect(Number(movs[0]!.monto)).toBe(180000);

  });

  it('descobrar dos veces es idempotente y no revive el ingreso', async () => {
    const concepto = 'QA descobrar idempotente';
    const cargo = await crearCargo(concepto);

    await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tokenAdmin) });
    const a = await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/descobrar`, headers: auth(tokenAdmin) });
    const b = await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/descobrar`, headers: auth(tokenAdmin) });

    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(await ingresosDe(concepto)).toHaveLength(0);

  });

  it('descobrar un cargo que nunca se cobró no crea ni borra nada', async () => {
    const concepto = 'QA descobrar nunca cobrado';
    const cargo = await crearCargo(concepto);

    const res = await app.inject({
      method: 'POST',
      url: `/cargos/${cargo.id}/descobrar`,
      headers: auth(tokenAdmin),
    });
    expect(res.statusCode).toBe(200);
    expect(await ingresosDe(concepto)).toHaveLength(0);

  });

  it('si el ingreso YA se le rindió al propietario, descobrar frena con 409', async () => {
    // EL BORDE QUE IMPIDE EL ARREGLO INGENUO. Una vez que el ingreso entró en una rendición,
    // el propietario ya vio esa plata. Borrar el movimiento acá dejaría a la rendición
    // apuntando (por `IngresoRendido.refId`) a una fila que no existe, y el neto que se le
    // rindió dejaría de poder reconstruirse. Frenar es lo correcto: primero se deshace la
    // rendición, después el cobro.
    const concepto = 'QA descobrar ya rendido';
    const cargo = await crearCargo(concepto);

    await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tokenAdmin) });
    const [mov] = await ingresosDe(concepto);
    expect(mov).toBeTruthy();

    // Se marca como rendido igual que lo hace la rendición real.
    await prismaTest.movimientoCaja.update({
      where: { id: mov!.id },
      data: { descontadoEnRendicion: true },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/cargos/${cargo.id}/descobrar`,
      headers: auth(tokenAdmin),
    });
    expect(res.statusCode).toBe(409);

    // Y no tocó nada: ni el ingreso ni el cargo.
    expect(await ingresosDe(concepto)).toHaveLength(1);
    const despues = await prismaTest.cargoContrato.findUnique({ where: { id: cargo.id } });
    expect(despues!.saldadoAt).not.toBeNull();

  });
});

/**
 * T-28-N1-N1 · Dos cargos IGUALES en el mismo contrato.
 *
 * `MovimientoCaja` no tiene `cargoId`: el unico vinculo entre el cargo y el ingreso que dejo
 * `saldar` es el TEXTO de la descripcion. `descobrar` reconstruye esa cadena, acota por
 * contrato + tipo + monto + moneda, y de los que matchean borra EL MAS RECIENTE.
 *
 * Con dos cargos de igual concepto, monto y moneda los dos ingresos son indistinguibles por
 * todos esos campos. Estos dos casos contestan hasta donde eso importa de verdad.
 */
describe('T-28-N1-N1 - dos cargos identicos, y hasta donde llega el dano', () => {
  const CONCEPTO = 'QA descobrar gemelos';

  it('en el caso normal no se rompe nada: las cuentas quedan derechas', async () => {
    // Mientras ninguno se rindio los dos ingresos SON fungibles: da igual cual se borre.
    // Queda un ingreso vivo, un cargo cobrado y uno adeudado — el estado correcto, sin
    // importar cual de los dos movimientos sobrevivio.
    const a = await crearCargo(CONCEPTO);
    const b = await crearCargo(CONCEPTO);
    await app.inject({ method: 'POST', url: `/cargos/${a.id}/saldar`, headers: auth(tokenAdmin) });
    await app.inject({ method: 'POST', url: `/cargos/${b.id}/saldar`, headers: auth(tokenAdmin) });
    expect(await ingresosDe(CONCEPTO)).toHaveLength(2);

    const res = await app.inject({ method: 'POST', url: `/cargos/${a.id}/descobrar`, headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);

    expect(await ingresosDe(CONCEPTO)).toHaveLength(1);
    const despuesA = await prismaTest.cargoContrato.findUnique({ where: { id: a.id } });
    const despuesB = await prismaTest.cargoContrato.findUnique({ where: { id: b.id } });
    expect(despuesA!.saldadoAt).toBeNull();
    expect(despuesB!.saldadoAt).not.toBeNull();
  });

  /**
   * ACA SI DUELE, Y ES PLATA.
   *
   * Los dos ingresos dejan de ser fungibles apenas UNO se rinde: a partir de ahi tienen
   * historias distintas, y la descripcion no alcanza para saber cual es cual.
   *
   * Escenario: se cobran los dos, se le rinde al propietario el ingreso del PRIMERO, y
   * despues se deshace ese primer cargo. `descobrar` busca por descripcion, encuentra el mas
   * reciente —el del SEGUNDO, sin rendir— y lo borra.
   *
   * Queda el primer cargo como deuda del inquilino otra vez Y el ingreso rendido vivo,
   * acreditado al propietario: exactamente la consecuencia que el encabezado de este archivo
   * llama la cara — "el inquilino vuelve a deber la plata y al propietario se le acredita
   * igual". De yapa el segundo cargo queda cobrado sin movimiento detras, asi que deshacerlo
   * despues devuelve un 409 que miente.
   *
   * Lo correcto es 409 desde el principio: el ingreso de ESE cargo ya se rindio.
   *
   * it.fails porque hoy devuelve 200. Es el criterio de aceptacion de T-28-N1-N1, que
   * necesita `cargoId` en MovimientoCaja y por eso espera decision del dueno. EL DIA QUE SE
   * AGREGUE, ESTE TEST EMPIEZA A FALLAR: hay que sacarle el .fails.
   */
  it.fails('con uno ya rendido, deshacer el otro no deberia poder borrarle el movimiento', async () => {
    const a = await crearCargo(CONCEPTO);
    const b = await crearCargo(CONCEPTO);
    await app.inject({ method: 'POST', url: `/cargos/${a.id}/saldar`, headers: auth(tokenAdmin) });
    const [movA] = await ingresosDe(CONCEPTO);
    await prismaTest.movimientoCaja.update({ where: { id: movA!.id }, data: { descontadoEnRendicion: true } });
    await app.inject({ method: 'POST', url: `/cargos/${b.id}/saldar`, headers: auth(tokenAdmin) });

    const res = await app.inject({ method: 'POST', url: `/cargos/${a.id}/descobrar`, headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(409);
  });
});
