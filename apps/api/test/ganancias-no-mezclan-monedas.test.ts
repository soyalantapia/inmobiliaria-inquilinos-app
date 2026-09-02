/**
 * Las ganancias de una propiedad no mezclan monedas — y ahora el test puede fallar.
 *
 * DE DÓNDE SALIÓ. De la auditoría del 31/08 (`work-agent/AUDITORIA-2026-08-31.md`), clase
 * "un test que pasaría igual aunque el producto estuviera roto".
 *
 * EL TEST VIEJO (`expediente-permisos.test.ts`) TENÍA DOS PROBLEMAS ENCIMADOS:
 *
 *   1. corría sobre `prp_001`, que en el seed tiene UN solo contrato, en ARS: el escenario de
 *      mezcla **no se ejercitaba**;
 *   2. la aserción se comparaba contra sí misma. `body.moneda` y `body.total` salen los dos de
 *      `totales[0]`, así que `principal` era siempre `totales[0]` y
 *      `expect(body.total.ganado).toBe(principal.ganado)` era una tautología de la FORMA de la
 *      respuesta. Y estaba envuelta en un `if (principal)`, así que ante un `undefined` se
 *      salteaba en vez de fallar.
 *
 * Lo único que verificaba de verdad era que `totalesPorMoneda` fuera un array.
 *
 * Y NO ALCANZABA CON CAMBIAR LA PROPIEDAD DEL SEED: `prp_006` sí tiene dos monedas, pero sus dos
 * contratos son BORRADOR y sin liquidaciones, así que `armarGanancia` devolvería 0 en las dos y
 * el test seguiría sin poder distinguir "la suma" de "la principal". Hace falta un fixture
 * propio, y por eso este archivo existe aparte.
 *
 * LA ASERCIÓN QUE IMPORTA es la que el test viejo no podía hacer: que `total.ganado` **no sea la
 * suma** de las dos monedas.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 'gmm-';
/** Tasa del propietario: 10% al 100% de participación → `tasa` = 0,10. */
const COMISION = 10;
/** Alquiler devengado de cada contrato, del que sale la PROYECCIÓN (alquiler × tasa). */
const ALQ_ARS = 1_000_000;
const ALQ_USD = 2_000;
/** Alquiler RENDIDO al dueño, del que sale lo GANADO (rendido × comisión de la rendición). */
const REND_ARS = 500_000;
const REND_USD = 1_000;

const ESPERADO = {
  ars: { proyeccion: (ALQ_ARS * COMISION) / 100, ganado: (REND_ARS * COMISION) / 100 }, // 100.000 / 50.000
  usd: { proyeccion: (ALQ_USD * COMISION) / 100, ganado: (REND_USD * COMISION) / 100 }, //     200 /    100
};

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
let inmobiliariaId = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar(): Promise<void> {
  await prisma.alquilerRendido.deleteMany({ where: { propiedadId: `${P}prop` } });
  await prisma.rendicion.deleteMany({ where: { propietarioId: `${P}own` } });
  await prisma.liquidacion.deleteMany({ where: { contratoId: { in: [`${P}ars`, `${P}usd`] } } });
  await prisma.eventoContrato.deleteMany({ where: { contratoId: { in: [`${P}ars`, `${P}usd`] } } });
  await prisma.propiedad.updateMany({ where: { id: `${P}prop` }, data: { contratoActualId: null } });
  await prisma.contrato.deleteMany({ where: { id: { in: [`${P}ars`, `${P}usd`] } } });
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: `${P}prop` } });
  await prisma.propiedad.deleteMany({ where: { id: `${P}prop` } });
  await prisma.propietario.deleteMany({ where: { id: `${P}own` } });
}

/** Un contrato con su cuota devengada y su alquiler ya rendido, en la moneda que se le pida. */
async function contratoConPlata(id: string, moneda: 'ARS' | 'USD', alquiler: number, rendido: number, periodo: string) {
  await prisma.contrato.create({
    data: {
      id,
      inmobiliariaId,
      propiedadId: `${P}prop`,
      estado: 'ACTIVO',
      // INMOBILIARIA y no PROPIETARIO_DIRECTO: `armarGanancia` devuelve 0 en el modo directo
      // —esa plata no la cobra la inmo— y el fixture no probaría nada.
      modoCobranza: 'INMOBILIARIA',
      monto: alquiler,
      moneda,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2027-12-31'),
      diaPago: 5,
      indiceAjuste: 'FIJO',
      frecuenciaAjusteMeses: 12,
      tipoContrato: 'ALQUILER',
    },
  });
  const liq = await prisma.liquidacion.create({
    data: {
      inmobiliariaId,
      contratoId: id,
      periodo,
      montoAlquiler: alquiler,
      montoTotal: alquiler,
      moneda,
      fechaVencimiento: new Date(`${periodo}-05`),
      estado: 'PAGADO',
    },
  });
  const rend = await prisma.rendicion.create({
    data: {
      inmobiliariaId,
      propietarioId: `${P}own`,
      periodo,
      montoBruto: rendido,
      comisionPct: COMISION,
      comisionMonto: (rendido * COMISION) / 100,
      montoNeto: rendido - (rendido * COMISION) / 100,
      moneda,
      metodo: 'TRANSFERENCIA',
    },
  });
  await prisma.alquilerRendido.create({
    data: {
      inmobiliariaId,
      rendicionId: rend.id,
      liquidacionId: liq.id,
      periodo,
      monto: rendido,
      participacion: 100,
      propiedadId: `${P}prop`,
      direccion: 'Dos Monedas 100',
    },
  });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  inmobiliariaId = (await seedBase(prisma)).inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');

  await prisma.propiedad.create({
    data: {
      id: `${P}prop`,
      inmobiliariaId,
      direccion: 'Dos Monedas 100',
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
      apellido: 'DosMonedas',
      cuit: '20-00000024-8',
      email: `${P}duenio@example.com`,
      telefono: '+54 9 11 9000 0000',
      comisionPct: COMISION,
    },
  });
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: `${P}prop`, propietarioId: `${P}own`, porcentaje: 100 },
  });

  // Dos contratos ACTIVOS sobre la MISMA propiedad, en monedas distintas. Se crean por Prisma y
  // no por el alta: `POST /contratos` rechaza el segundo con 409 ("la propiedad ya tiene un
  // contrato activo"). El seed hace lo mismo con prp_002 (cnt_002 + cnt_007).
  await contratoConPlata(`${P}ars`, 'ARS', ALQ_ARS, REND_ARS, '2026-06');
  await contratoConPlata(`${P}usd`, 'USD', ALQ_USD, REND_USD, '2026-07');
});

afterAll(async () => {
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('ganancias de una propiedad con contratos en dos monedas', () => {
  it('el escenario se armó de verdad: dos contratos ACTIVOS, dos monedas', async () => {
    // Control del propio fixture. El test viejo corría sobre una propiedad de UNA moneda y por
    // eso no medía nada: si esto baja, este archivo tampoco mide.
    const cs = await prisma.contrato.findMany({ where: { propiedadId: `${P}prop` }, select: { moneda: true } });
    expect(cs).toHaveLength(2);
    expect(new Set(cs.map((c) => c.moneda))).toEqual(new Set(['ARS', 'USD']));
  });

  it('el desglose trae las DOS monedas, con sus números propios', async () => {
    const r = await app.inject({ method: 'GET', url: `/propiedades/${P}prop/ganancias`, headers: auth(token) });
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
    const body = r.json() as {
      moneda: string;
      total: { ganado: number; proyeccion: number };
      totalesPorMoneda: Array<{ moneda: string; ganado: number; proyeccion: number }>;
    };

    expect(body.totalesPorMoneda).toHaveLength(2);
    const ars = body.totalesPorMoneda.find((t) => t.moneda === 'ARS');
    const usd = body.totalesPorMoneda.find((t) => t.moneda === 'USD');
    // Sin `if`: si falta una, el test FALLA. El viejo se salteaba la aserción.
    expect(ars, 'falta el renglón de ARS').toBeTruthy();
    expect(usd, 'falta el renglón de USD').toBeTruthy();

    expect(ars!.proyeccion).toBeCloseTo(ESPERADO.ars.proyeccion, 2);
    expect(ars!.ganado).toBeCloseTo(ESPERADO.ars.ganado, 2);
    expect(usd!.proyeccion).toBeCloseTo(ESPERADO.usd.proyeccion, 2);
    expect(usd!.ganado).toBeCloseTo(ESPERADO.usd.ganado, 2);
  });

  it('🔴 el total de cabecera NO es la suma de las dos monedas', async () => {
    // ÉSTA es la aserción que el test viejo no podía hacer, y es todo el punto: la suma de
    // pesos con dólares es un número que no existe, y la comisión de la inmobiliaria sale de
    // ahí, así que el error se lee como plata ganada.
    const r = await app.inject({ method: 'GET', url: `/propiedades/${P}prop/ganancias`, headers: auth(token) });
    const body = r.json() as { moneda: string; total: { ganado: number; proyeccion: number } };

    const suma = ESPERADO.ars.ganado + ESPERADO.usd.ganado;
    expect(body.total.ganado).not.toBeCloseTo(suma, 2);
    // Y es exactamente el de la moneda PRINCIPAL: la de mayor proyección, que acá es ARS.
    expect(body.moneda).toBe('ARS');
    expect(body.total.ganado).toBeCloseTo(ESPERADO.ars.ganado, 2);
    expect(body.total.proyeccion).toBeCloseTo(ESPERADO.ars.proyeccion, 2);
  });

  it('cada contrato del detalle viaja con SU moneda', async () => {
    // El front necesita esto para no rotular un contrato en dólares con signo de pesos, que es
    // el mismo error una capa más abajo.
    const r = await app.inject({ method: 'GET', url: `/propiedades/${P}prop/ganancias`, headers: auth(token) });
    const body = r.json() as { contratos: Array<{ contratoId: string; moneda: string; ganado: number }> };
    const porId = new Map(body.contratos.map((c) => [c.contratoId, c]));
    expect(porId.get(`${P}ars`)?.moneda).toBe('ARS');
    expect(porId.get(`${P}usd`)?.moneda).toBe('USD');
    expect(porId.get(`${P}usd`)?.ganado).toBeCloseTo(ESPERADO.usd.ganado, 2);
  });
});
