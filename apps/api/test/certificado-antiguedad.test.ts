import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import type { JwtInquilino } from '@llave/shared';

// Regresión B3 (auditoría baja-contrato): el certificado del inquilino CONGELA
// `mesesCumplidos` en la fecha de baja para un contrato dado de baja ANTICIPADAMENTE
// (fechaFin todavía futura). Antes, al no haber una fecha de baja persistida, el
// endpoint caía a `ahora` → la antigüedad seguía creciendo mes a mes como si el
// ex-inquilino nunca se hubiera ido, contradiciendo `vigente: false`. El fix usa
// `min(updatedAt, fechaFin)` como tope. Cubrimos:
//  - baja anticipada → mesesCumplidos congelado en updatedAt (no crece hasta hoy).
//  - contrato ACTIVO → sigue contando hasta hoy (no-regresión del caso vigente).

let app: FastifyInstance;
let prisma: PrismaClient;
let tid: string; // inmobiliariaId demo
let inquilinoId: string; // inquilino demo (para armar el token)
let propiedadId: string;

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const DEMO_INQ_EMAIL = 'mariela.sosa@gmail.com';

const CNT_BAJA = 'cnt_test_b3_baja'; // FINALIZADO anticipadamente
const CNT_ACTIVO = 'cnt_test_b3_activo'; // control ACTIVO

// Fechas deterministas. La baja (updatedAt) queda MUY en el pasado respecto de "hoy"
// para que la diferencia entre "congelar" y "contar hasta hoy" sea inequívoca.
const FECHA_INICIO = new Date('2020-01-15T00:00:00.000Z');
const FECHA_FIN_FUTURA = new Date('2099-12-31T00:00:00.000Z');
const FECHA_BAJA = new Date('2021-01-20T00:00:00.000Z'); // 12 meses después del inicio

// token de inquilino apuntando a un contrato arbitrario (requireInquilino lee
// contratoId del JWT; el mismo patrón que emite /auth/demo).
const tokenPara = (contratoId: string) => {
  const payload: JwtInquilino = { kind: 'inquilino', inquilinoId, inmobiliariaId: tid, contratoId };
  return app.jwt.sign(payload);
};

async function crearContrato(id: string, estado: 'FINALIZADO' | 'ACTIVO') {
  await prisma.contrato.create({
    data: {
      id,
      inmobiliariaId: tid,
      propiedadId,
      monto: 100000,
      fechaInicio: FECHA_INICIO,
      fechaFin: FECHA_FIN_FUTURA,
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      estado,
      modoCobranza: 'INMOBILIARIA',
    },
  });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);

  const inq = await prisma.inquilino.findFirstOrThrow({ where: { email: DEMO_INQ_EMAIL } });
  inquilinoId = inq.id;
  tid = inq.inmobiliariaId;
  const prop = await prisma.propiedad.findFirstOrThrow({ where: { inmobiliariaId: tid } });
  propiedadId = prop.id;

  // Limpieza idempotente de corridas previas (certificados antes por la FK).
  await prisma.certificadoInquilino.deleteMany({ where: { contratoId: { in: [CNT_BAJA, CNT_ACTIVO] } } });
  await prisma.contrato.deleteMany({ where: { id: { in: [CNT_BAJA, CNT_ACTIVO] } } });

  await crearContrato(CNT_BAJA, 'FINALIZADO');
  await crearContrato(CNT_ACTIVO, 'ACTIVO');

  // `updatedAt` es @updatedAt: Prisma lo pisa en cada .update, así que la fecha de baja
  // se fija con SQL crudo (proxy de la fecha real de baja). Sólo el contrato dado de baja.
  await prisma.$executeRawUnsafe(
    'UPDATE contratos SET "updatedAt" = $1 WHERE id = $2',
    FECHA_BAJA,
    CNT_BAJA,
  );

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
});

afterAll(async () => {
  await prisma.certificadoInquilino.deleteMany({ where: { contratoId: { in: [CNT_BAJA, CNT_ACTIVO] } } });
  await prisma.contrato.deleteMany({ where: { id: { in: [CNT_BAJA, CNT_ACTIVO] } } });
  await app.close();
  await prisma.$disconnect();
});

describe('Certificado — antigüedad congelada tras la baja [B3]', () => {
  it('baja anticipada: mesesCumplidos se congela en la fecha de baja (no crece hasta hoy)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/certificado',
      headers: auth(tokenPara(CNT_BAJA)),
    });
    expect(res.statusCode).toBe(200);
    const cert = res.json();
    expect(cert.contratoActual.vigente).toBe(false);
    // 2020-01 → 2021-01 = 12 meses exactos, congelados. Con el bug daría (hoy - inicio),
    // decenas de meses más, creciendo cada mes.
    expect(cert.contratoActual.mesesCumplidos).toBe(12);
  });

  it('contrato ACTIVO: mesesCumplidos sigue contando hasta hoy (no-regresión)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/certificado',
      headers: auth(tokenPara(CNT_ACTIVO)),
    });
    expect(res.statusCode).toBe(200);
    const cert = res.json();
    expect(cert.contratoActual.vigente).toBe(true);
    const ahora = new Date();
    const esperado =
      (ahora.getFullYear() - FECHA_INICIO.getUTCFullYear()) * 12 +
      (ahora.getMonth() - FECHA_INICIO.getUTCMonth());
    // Tolerancia ±1 por si el request cruza un borde de mes respecto de este `ahora`.
    expect(Math.abs(cert.contratoActual.mesesCumplidos - esperado)).toBeLessThanOrEqual(1);
    // Y es MUY superior al contrato congelado (prueba que no se congeló el vigente).
    expect(cert.contratoActual.mesesCumplidos).toBeGreaterThan(12 + 12);
  });
});
