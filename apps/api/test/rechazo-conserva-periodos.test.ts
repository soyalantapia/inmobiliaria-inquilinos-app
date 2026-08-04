import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Hoy el rechazo de un contrato cargado borra `periodosAnterioresPendientes`
 * (Prisma.DbNull) junto con el resto de la limpieza. Eso deja el contrato
 * muerto: para corregir y reenviar (fase 2) hay que volver a tipear toda la
 * deuda histórica período por período. Este test fija que el rechazo CONSERVA
 * ese dato — y, al mismo tiempo, que conservarlo no lo vuelve aplicable por
 * ningún camino (ni liquidaciones ni pagos conciliados de esa deuda).
 */

let app: FastifyInstance;
let tokenCarga: string;
let tokenAdmin: string;

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const loginCarga = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'camila@delsol.com', password: 'delsol123' },
  });
  tokenCarga = loginCarga.json().token;
  const loginAdmin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  tokenAdmin = loginAdmin.json().token;
});

afterAll(async () => {
  await app.close();
});

// El seed (prisma/seed.ts) no deja NINGUNA propiedad en estado DISPONIBLE y
// GET /propiedades ignora ?estado=... (devuelve todo el listado del tenant).
// Por eso creamos una propiedad libre por test, igual que revision-aprobacion.test.ts.
let contador = 0;
async function propiedadDisponible(): Promise<string> {
  contador += 1;
  const res = await app.inject({
    method: 'POST',
    url: '/propiedades',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {
      direccion: `Test rechazo-conserva-periodos ${contador}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
    },
  });
  expect(res.statusCode, `crear propiedad ${contador}: ${res.body}`).toBeLessThan(300);
  return res.json().id;
}

describe('rechazar conserva la deuda declarada sin dejarla aplicable', () => {
  it('rechazar conserva los períodos declarados y no los aplica', async () => {
    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
    const p = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
    const periodo = `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, '0')}`;

    const alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: { authorization: `Bearer ${tokenCarga}` },
      payload: {
        propiedadId: await propiedadDisponible(),
        inquilino: { nombre: 'Rechazo', apellido: 'Conserva' },
        monto: 100000,
        fechaInicio: inicio.toISOString(),
        fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        periodosAnteriores: [{ periodo, estado: 'ADEUDA' }],
      },
    });
    // POST /contratos no setea 201 explícito (default de Fastify = 200).
    expect(alta.statusCode, alta.body).toBeLessThan(300);
    const contratoId = alta.json().id as string;

    const det = await app.inject({
      method: 'GET',
      url: `/contratos/${contratoId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    const aprobacionId = det.json().revisionAprobacion.aprobacionId as string;

    // Sin comentario sigue siendo 400 (no regresión)
    const sinMotivo = await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: {},
    });
    expect(sinMotivo.statusCode).toBe(400);

    const rech = await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { comentario: 'El monto no coincide con el contrato firmado' },
    });
    expect(rech.statusCode).toBe(200);

    const prisma = new PrismaClient();
    const contrato = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    const liqs = await prisma.liquidacion.count({ where: { contratoId } });
    const aprobacion = await prisma.aprobacion.findUniqueOrThrow({ where: { id: aprobacionId } });
    await prisma.$disconnect();

    expect(contrato.estado).toBe('BORRADOR');
    expect(contrato.pendienteAprobacion).toBe(false);
    expect(contrato.periodosAnterioresPendientes).not.toBeNull(); // <-- lo nuevo
    expect(aprobacion.estado).toBe('RECHAZADA');
    expect(aprobacion.comentarioAprobador).toContain('no coincide');
    expect(liqs).toBe(0);
  });

  it('aprobar una aprobación ya rechazada no genera nada', async () => {
    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
    const p = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
    const periodo = `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, '0')}`;

    const alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: { authorization: `Bearer ${tokenCarga}` },
      payload: {
        propiedadId: await propiedadDisponible(),
        inquilino: { nombre: 'Doble', apellido: 'Decision' },
        monto: 100000,
        fechaInicio: inicio.toISOString(),
        fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        periodosAnteriores: [{ periodo, estado: 'ADEUDA' }],
      },
    });
    expect(alta.statusCode, alta.body).toBeLessThan(300);
    const contratoId = alta.json().id as string;
    const det = await app.inject({
      method: 'GET',
      url: `/contratos/${contratoId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    const aprobacionId = det.json().revisionAprobacion.aprobacionId as string;

    await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { comentario: 'Rechazado por error de carga' },
    });

    // Segundo intento: aprobar la MISMA aprobación ya rechazada
    const ap = await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/aprobar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { comentario: 'ok' },
    });

    const prisma = new PrismaClient();
    const liqs = await prisma.liquidacion.count({ where: { contratoId } });
    const contrato = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    await prisma.$disconnect();

    expect(ap.statusCode).not.toBe(200);
    expect(liqs).toBe(0);
    expect(contrato.estado).toBe('BORRADOR');
  });
});
