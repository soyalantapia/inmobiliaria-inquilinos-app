import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * CAZABUG — la deuda de una persona sumaba pesos con dólares.
 *
 * `GET /personas/:id` acumulaba `deudaVigente` recorriendo TODOS los contratos
 * de la persona sin mirar `moneda`. Con multi-alquiler (una persona puede tener
 * varios contratos en la misma inmobiliaria) eso ya no es teórico: un contrato
 * en pesos y otro en dólares daban un número que no es plata de ninguna moneda.
 * Y el panel lo mostraba con `formatMonto(...)` sin moneda → signo de PESOS.
 *
 * Se cambió por un desglose `deudaVigentePorMoneda`. `deudaVigente` sigue
 * existiendo pero ahora es SÓLO la deuda en pesos: un panel viejo contra un
 * backend nuevo muestra de menos, nunca un total inventado.
 */

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
const P = 'ZZmon-';
const auth = () => ({ authorization: `Bearer ${token}` });

async function limpiar() {
  await prisma.pago.deleteMany({ where: { contratoId: { startsWith: P } } });
  await prisma.liquidacion.deleteMany({ where: { contratoId: { startsWith: P } } });
  await prisma.inquilino.deleteMany({ where: { contratoId: { startsWith: P } } });
  await prisma.contrato.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.propiedad.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.persona.deleteMany({ where: { id: { startsWith: P } } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  const tid = inmo.id;
  await limpiar();

  await prisma.persona.create({
    data: { id: `${P}per`, inmobiliariaId: tid, nombre: 'Mono', apellido: 'Moneda', dni: '99887766', email: 'mono.moneda@test.local' },
  });

  // Dos alquileres de la MISMA persona: uno en pesos, otro en dólares, los dos
  // con una cuota vencida impaga. Sin mora, para comparar montos exactos.
  for (const [i, moneda, monto] of [[1, 'ARS', 500000], [2, 'USD', 800]] as const) {
    await prisma.propiedad.create({
      data: {
        id: `${P}prop${i}`, inmobiliariaId: tid, direccion: `Calle Moneda ${i}`,
        ciudad: 'Córdoba', provincia: 'Córdoba',
        tipo: 'DEPARTAMENTO',
      },
    });
    await prisma.contrato.create({
      data: {
        id: `${P}cnt${i}`, inmobiliariaId: tid, propiedadId: `${P}prop${i}`,
        monto, moneda, diaPago: 5, estado: 'ACTIVO',
        indiceAjuste: 'ICL', frecuenciaAjusteMeses: 12, modoCobranza: 'INMOBILIARIA',
        fechaInicio: new Date('2026-01-01T00:00:00Z'), fechaFin: new Date('2028-01-01T00:00:00Z'),
        moraTipo: 'SIN_MORA', moraValor: null, tasaPunitorioDiaria: null,
      },
    });
    await prisma.inquilino.create({
      data: {
        id: `${P}inq${i}`, inmobiliariaId: tid, contratoId: `${P}cnt${i}`, personaId: `${P}per`,
        nombre: 'Mono', apellido: 'Moneda', dni: '99887766', email: 'mono.moneda@test.local',
      },
    });
    await prisma.liquidacion.create({
      data: {
        id: `${P}liq${i}`, inmobiliariaId: tid, contratoId: `${P}cnt${i}`, periodo: '2026-02',
        montoAlquiler: monto, montoExpensas: null, montoTotal: monto,
        fechaVencimiento: new Date('2026-02-05T00:00:00Z'), estado: 'VENCIDO', moneda,
      },
    });
  }

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
}, 420_000);

afterAll(async () => {
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('la deuda de una persona no mezcla monedas', () => {
  it('devuelve el desglose: $500.000 y US$800, cada uno en lo suyo', async () => {
    const r = await app.inject({ method: 'GET', url: `/personas/${P}per`, headers: auth() });
    expect(r.statusCode).toBe(200);
    const { resumen } = r.json();
    // Con el bug: un único deudaVigente = 500800, que no es plata de ninguna moneda.
    expect(resumen.deudaVigentePorMoneda).toEqual([
      { moneda: 'ARS', monto: 500000 },
      { moneda: 'USD', monto: 800 },
    ]);
  });

  it('`deudaVigente` es SÓLO la parte en pesos (nunca la suma de las dos)', async () => {
    const r = await app.inject({ method: 'GET', url: `/personas/${P}per`, headers: auth() });
    expect(r.json().resumen.deudaVigente).toBe(500000);
  });

  it('los dos contratos siguen colgando de la misma persona', async () => {
    const r = await app.inject({ method: 'GET', url: `/personas/${P}per`, headers: auth() });
    expect(r.json().resumen.totalContratos).toBe(2);
  });
});
