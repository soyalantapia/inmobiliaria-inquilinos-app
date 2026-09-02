/**
 * T-61 · Un ajuste posterior a una renovación ya cargada quedaba anulado en el devengo.
 *
 * EL CASO, tal cual la ficha. Contrato a $300.000 que termina el 30/11:
 *
 *   1. 10/08 — se renueva por adelantado (el flujo normal): $500.000 desde 2026-12.
 *      Queda `RenovacionContrato{ montoDesde: '2026-12', montoAnterior: 300.000 }`.
 *   2. 05/09 — llega el ajuste anual: $380.000 desde 2026-09.
 *   3. El cron devenga 2026-11: `canonDelPeriodo` busca la primera vigencia posterior —la
 *      renovación de diciembre— y devuelve su `montoAnterior`: **$300.000**.
 *
 * O sea: el ajuste de septiembre quedaba anulado para noviembre. Se cobraba $300.000 en vez de
 * $380.000, con la comisión —que sale del alquiler— corta en la misma proporción. El signo
 * importa: acá se cobra de MENOS, así que no hay un inquilino reclamado de más; es plata que la
 * inmobiliaria no factura.
 *
 * LO QUE ESTE ARCHIVO CUIDA. Dos cosas distintas, y las dos hacen falta:
 *
 *  - la DECISIÓN aislada: a qué vigencia hay que repararle el snapshot (tests puros);
 *  - que las TRES escrituras la ejecuten (tests contra la base). La ficha decía justamente que
 *    lo primero se podía fijar sin base y lo segundo no, y por eso la tarea se había quedado.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { primeraVigenciaDespuesDe, canonDelPeriodo } from '../src/lib/liquidaciones.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
let inmobiliariaId = '';
let contratoId = '';
let original: { monto: number; fechaFin: Date } | null = null;
const auth = () => ({ authorization: `Bearer ${token}` });

/** Períodos bien lejos del mes en curso: `vigenciasFuturas` sólo mira los estrictamente futuros. */
const AJUSTE = '2027-09';
const RENOVACION = '2027-12';
const ENTRE_MEDIO = '2027-11';

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = r.json().token;
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  inmobiliariaId = inmo.id;
  const c = await prisma.contrato.findFirstOrThrow({
    where: { inmobiliariaId, estado: 'ACTIVO', tipoContrato: { not: 'SOLO_EXPENSAS' } },
    orderBy: { id: 'asc' },
  });
  contratoId = c.id;
  original = { monto: Number(c.monto), fechaFin: c.fechaFin };
  // El contrato se deja EXACTAMENTE como el caso de la ficha: $300.000 y vencimiento antes de la
  // renovación que vamos a cargar. Sin esto el archivo no es idempotente —`seedBase` no revierte
  // `fechaFin` ni `monto`, así que la segunda corrida se encontraba el contrato ya renovado y
  // `/renovar` contestaba 400—. Un test que sólo pasa la primera vez no cuida nada.
  await prisma.contrato.update({
    where: { id: contratoId },
    data: { monto: 300_000, fechaFin: new Date('2027-11-30T00:00:00.000Z') },
  });
});

afterAll(async () => {
  // La base es compartida entre los archivos de la suite: no dejamos vigencias inventadas.
  await prisma.ajusteAlquiler.deleteMany({ where: { contratoId, periodoDesde: { gte: '2027-01' } } }).catch(() => {});
  await prisma.renovacionContrato.deleteMany({ where: { contratoId, montoDesde: { gte: '2027-01' } } }).catch(() => {});
  if (original) {
    await prisma.contrato
      .update({ where: { id: contratoId }, data: { monto: original.monto, fechaFin: original.fechaFin } })
      .catch(() => {});
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('T-61 — a qué vigencia hay que repararle el snapshot (puro)', () => {
  const v = (desde: string) => ({ desde });

  it('elige la PRIMERA que empieza después del cambio', () => {
    expect(primeraVigenciaDespuesDe([v('2027-12'), v('2027-10'), v('2028-03')], '2027-09')?.desde).toBe('2027-10');
  });

  it('ignora las que empiezan antes', () => {
    expect(primeraVigenciaDespuesDe([v('2027-01'), v('2027-05')], '2027-09')).toBeUndefined();
  });

  it('ignora la que empieza EXACTAMENTE en el período del cambio', () => {
    // Su `montoAnterior` es el canon de ANTES de ese período: un cambio que arranca ahí no lo
    // toca. Si esto se relajara a `>=`, el propio ajuste que se acaba de crear se repararía a
    // sí mismo y borraría el canon viejo del historial.
    expect(primeraVigenciaDespuesDe([v('2027-09')], '2027-09')).toBeUndefined();
  });

  it('sin vigencias futuras no hay nada que reparar', () => {
    expect(primeraVigenciaDespuesDe([], '2027-09')).toBeUndefined();
  });

  it('la lectura y la escritura eligen la MISMA fila', () => {
    // Es el invariante que hace que el arreglo funcione: `canonDelPeriodo` lee el
    // `montoAnterior` de la misma vigencia que el reparador acaba de escribir.
    const vigencias = [{ desde: RENOVACION, montoAnterior: 380_000 }];
    expect(canonDelPeriodo(ENTRE_MEDIO, 999_999, vigencias)).toBe(380_000);
    expect(primeraVigenciaDespuesDe(vigencias, AJUSTE)?.desde).toBe(RENOVACION);
  });
});

describe('T-61 — las tres escrituras reparan el snapshot (con base)', () => {
  it('el escenario se armó', () => {
    expect(token).not.toBe('');
    expect(contratoId).not.toBe('');
  });

  it('🔴 el caso de la ficha: ajustar DESPUÉS de renovar deja el canon correcto', async () => {
    const montoOriginal = Number((await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } })).monto);

    // 1) Renovación por adelantado.
    const renov = await app.inject({
      method: 'POST',
      url: `/contratos/${contratoId}/renovar`,
      headers: auth(),
      payload: { fechaFinNueva: '2028-11-30', montoNuevo: 500_000, montoDesde: RENOVACION },
    });
    expect(renov.statusCode).toBe(200);

    const antes = await prisma.renovacionContrato.findFirstOrThrow({ where: { contratoId, montoDesde: RENOVACION } });
    // Control: el snapshot nace con el canon que regía, que es el comportamiento de siempre.
    expect(Number(antes.montoAnterior)).toBe(montoOriginal);

    // 2) El ajuste anual, con vigencia ANTERIOR a la renovación.
    const aj = await app.inject({
      method: 'POST',
      url: `/contratos/${contratoId}/ajustar`,
      headers: auth(),
      payload: { montoNuevo: 380_000, periodoDesde: AJUSTE },
    });
    expect(aj.statusCode).toBe(200);

    // 3) El snapshot de la renovación tiene que haber quedado en el canon NUEVO.
    const despues = await prisma.renovacionContrato.findFirstOrThrow({ where: { contratoId, montoDesde: RENOVACION } });
    expect(Number(despues.montoAnterior)).toBe(380_000);

    // Y lo que importa de verdad: el canon que el devengo va a usar para el mes de entre medio.
    const vigencias = [{ desde: RENOVACION, montoAnterior: Number(despues.montoAnterior) }];
    expect(canonDelPeriodo(ENTRE_MEDIO, 500_000, vigencias)).toBe(380_000);
    // Con el bug daba el monto original — el ajuste quedaba anulado para ese mes.
    expect(canonDelPeriodo(ENTRE_MEDIO, 500_000, vigencias)).not.toBe(montoOriginal);
  });

  it('un ajuste POSTERIOR a la renovación no la toca', async () => {
    const antes = Number(
      (await prisma.renovacionContrato.findFirstOrThrow({ where: { contratoId, montoDesde: RENOVACION } })).montoAnterior,
    );
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${contratoId}/ajustar`,
      headers: auth(),
      payload: { montoNuevo: 640_000, periodoDesde: '2028-06' },
    });
    expect(r.statusCode).toBe(200);
    const despues = Number(
      (await prisma.renovacionContrato.findFirstOrThrow({ where: { contratoId, montoDesde: RENOVACION } })).montoAnterior,
    );
    // El control negativo del arreglo: reparar de más sería reescribir historia real.
    expect(despues).toBe(antes);
  });

  it('el ajuste masivo (PATCH /monto) también repara — y la ficha lo daba por afuera', async () => {
    // La ficha decía que el masivo "no deja fila" y por eso no entraba al problema. Eso quedó
    // viejo: la fila se agregó después. Y de todos modos lo que ensucia el snapshot no es la
    // fila, es haber movido `contrato.monto`.
    const renovAntes = Number(
      (await prisma.renovacionContrato.findFirstOrThrow({ where: { contratoId, montoDesde: RENOVACION } })).montoAnterior,
    );
    const r = await app.inject({
      method: 'PATCH',
      url: `/contratos/${contratoId}/monto`,
      headers: auth(),
      payload: { monto: 415_000 },
    });
    expect(r.statusCode).toBe(200);

    // Repara la vigencia MÁS CERCANA, que a esta altura del archivo es el ajuste de 2027-09
    // —no la renovación—. Este assert lo escribí al revés la primera vez y el test me corrigió:
    // es justo la propiedad que hace que el arreglo no reescriba historia que sigue siendo
    // cierta.
    const ajuste = await prisma.ajusteAlquiler.findFirstOrThrow({ where: { contratoId, periodoDesde: AJUSTE } });
    expect(Number(ajuste.montoAnterior)).toBe(415_000);

    // Y la renovación, que tiene su propio predecesor, no se toca.
    const renovDespues = Number(
      (await prisma.renovacionContrato.findFirstOrThrow({ where: { contratoId, montoDesde: RENOVACION } })).montoAnterior,
    );
    expect(renovDespues).toBe(renovAntes);
  });
});
