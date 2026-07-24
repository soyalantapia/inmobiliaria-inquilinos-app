import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { enumerarPeriodosContrato } from '@llave/shared/periodos';

/**
 * Regresión del bug i36 (alta de contrato falla con inicio a mitad de mes).
 * Ejercita el CIRCUITO COMPLETO POST /contratos → devengo → aplicarEstadoInicial
 * (lo que NINGÚN test cubría). Repro: contrato EN CURSO cuyo inicio cae a mitad
 * de mes (día 15) con diaPago temprano (5) → el mes de inicio vence ANTES del
 * inicio y el back lo saltea. El front VIEJO igual lo ofrecía en periodosAnteriores
 * → período huérfano → 400 + rollback. Con la enumeración compartida el front ya
 * no lo ofrece (caso A: 2xx); y si alguien lo manda igual, el back lo rechaza
 * claro (caso B: 400) — la defensa sigue viva.
 */

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
});

afterAll(async () => {
  await app.close();
});

const auth = () => ({ authorization: `Bearer ${token}` });

// Crea una propiedad LIBRE y devuelve su id (cada test usa la suya: el alta la ocupa).
async function crearPropiedadLibre(nombre: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/propiedades',
    headers: auth(),
    payload: {
      direccion: `Test i36 ${nombre}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
    },
  });
  expect(res.statusCode, `crear propiedad ${nombre}: ${res.body}`).toBeLessThan(300);
  return res.json().id;
}

// Contrato que empezó hace 2 meses, día 15, con diaPago 5 → dispara el skip del
// primer mes (venc día 5 < inicio día 15). Fechas relativas a hoy porque el
// devengo del back usa new Date() real (no inyectable por HTTP).
function fechasAltaMitadDeMes() {
  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 15));
  const fin = new Date(Date.UTC(inicio.getUTCFullYear() + 2, inicio.getUTCMonth(), 15));
  return {
    fechaInicio: inicio.toISOString().slice(0, 10),
    fechaFin: fin.toISOString().slice(0, 10),
    diaPago: 5,
    periodoMesInicio: inicio.toISOString().slice(0, 7), // 'YYYY-MM' que el back saltea
  };
}

describe('POST /contratos — alta con inicio a mitad de mes (regresión i36)', () => {
  it('A) alta con el payload que arma el WIZARD (períodos de la fuente compartida) → 2xx, sin período huérfano', async () => {
    const propiedadId = await crearPropiedadLibre('A');
    const { fechaInicio, fechaFin, diaPago, periodoMesInicio } = fechasAltaMitadDeMes();

    // Igual que page.tsx: los "períodos anteriores" salen de enumerarPeriodosContrato.
    const periodosAnteriores = enumerarPeriodosContrato({ fechaInicio, fechaFin, diaPago }, new Date())
      .filter((p) => p.vencido)
      .map((p) => ({ periodo: p.periodo, estado: 'ADEUDA' as const }));

    // El wizard NO ofrece el mes de inicio (huérfano): es justo lo que fallaba.
    expect(periodosAnteriores.map((p) => p.periodo)).not.toContain(periodoMesInicio);
    expect(periodosAnteriores.length).toBeGreaterThan(0); // hay meses vencidos que declarar

    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: {
        propiedadId,
        inquilino: { nombre: 'Test i36 A' },
        monto: 100_000,
        fechaInicio,
        fechaFin,
        diaPago,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        periodosAnteriores,
      },
    });
    expect(res.statusCode, `alta i36: ${res.body}`).toBeLessThan(300);

    // El contrato quedó con liquidaciones y NINGUNA para el mes de inicio saltado.
    const prisma = new PrismaClient();
    const contratoId = res.json().id;
    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId },
      select: { periodo: true },
    });
    await prisma.$disconnect();
    const periodos = liqs.map((l) => l.periodo);
    expect(periodos.length).toBeGreaterThan(0);
    expect(periodos).not.toContain(periodoMesInicio);
  });

  it('B) si se manda el período del mes de inicio (huérfano) a mano → 400 claro (defensa del back viva)', async () => {
    const propiedadId = await crearPropiedadLibre('B');
    const { fechaInicio, fechaFin, diaPago, periodoMesInicio } = fechasAltaMitadDeMes();

    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: {
        propiedadId,
        inquilino: { nombre: 'Test i36 B' },
        monto: 100_000,
        fechaInicio,
        fechaFin,
        diaPago,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        // El período del mes de inicio NO lo devenga el back → debe rechazarse.
        periodosAnteriores: [{ periodo: periodoMesInicio, estado: 'ADEUDA' as const }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('no corresponde');
  });
});
