import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * El preview de "qué va a pasar al aprobar" no puede mentir: se compara contra
 * lo que efectivamente queda después de aprobar. Si divergen, la pantalla de
 * control estaría anunciando una cosa y el sistema haciendo otra — y lo que se
 * anuncia es plata que el sistema da por cobrada.
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

// El seed (prisma/seed.ts) no deja NINGUNA propiedad en estado DISPONIBLE (prp_001
// a prp_005 están ALQUILADA, prp_006 está EN_EDICION) y GET /propiedades no filtra
// por query string (ignora ?estado=...) — devuelve todo el listado del tenant. Por
// eso, en vez de depender del seed, creamos una propiedad libre por test.
let contador = 0;
async function propiedadDisponible(): Promise<string> {
  contador += 1;
  const res = await app.inject({
    method: 'POST',
    url: '/propiedades',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {
      direccion: `Test revision-aprobacion ${contador}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
    },
  });
  expect(res.statusCode, `crear propiedad ${contador}: ${res.body}`).toBeLessThan(300);
  return res.json().id;
}

describe('revisionAprobacion — preview de qué pasa al aprobar', () => {
  it('el preview coincide con lo que realmente se aplica al aprobar', async () => {
    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 4, 1));
    const fin = new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1));
    const per = (n: number) => {
      const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - n, 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    };

    // Lo carga CARGA => queda BORRADOR + pendienteAprobacion
    const alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: { authorization: `Bearer ${tokenCarga}` },
      payload: {
        propiedadId: await propiedadDisponible(),
        inquilino: { nombre: 'Revision', apellido: 'Preview' },
        monto: 100000,
        montoExpensas: 20000,
        tipoContrato: 'ALQUILER_Y_EXPENSAS',
        fechaInicio: inicio.toISOString(),
        fechaFin: fin.toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        periodosAnteriores: [
          { periodo: per(4), estado: 'PAGADO' },
          { periodo: per(3), estado: 'PARCIAL', montoPagado: 50000 },
          { periodo: per(2), estado: 'ADEUDA' },
        ],
      },
    });
    // POST /contratos no setea 201 explícito (default de Fastify = 200), igual que
    // el resto de la suite (alta-contrato-integracion.test.ts usa toBeLessThan(300)).
    expect(alta.statusCode, alta.body).toBeLessThan(300);
    const contratoId = alta.json().id as string;

    // 1) El ADMIN lee el preview
    const det = await app.inject({
      method: 'GET',
      url: `/contratos/${contratoId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    expect(det.statusCode).toBe(200);
    const rev = det.json().revisionAprobacion;
    expect(rev).toBeTruthy();
    expect(rev.aprobacionId).toEqual(expect.any(String));
    expect(rev.periodosDeclarados).toHaveLength(3);

    // 2) Se aprueba
    const ap = await app.inject({
      method: 'POST',
      url: `/aprobaciones/${rev.aprobacionId}/aprobar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { comentario: 'Revisado, va' },
    });
    expect(ap.statusCode, ap.body).toBe(200);

    // 3) Lo anunciado tiene que coincidir con lo aplicado
    const prisma = new PrismaClient();
    const liqs = await prisma.liquidacion.findMany({ where: { contratoId } });
    const pagos = await prisma.pago.findMany({ where: { contratoId } });
    await prisma.$disconnect();

    expect(liqs).toHaveLength(rev.alAprobar.cuotasAGenerar);

    const conciliadoReal = pagos.reduce((s, p) => s + Number(p.monto), 0);
    expect(conciliadoReal).toBeCloseTo(rev.alAprobar.conciliado.monto, 2);

    // El total del período PAGADO (120000) + lo pagado del PARCIAL (50000)
    expect(rev.alAprobar.conciliado.monto).toBeCloseTo(170000, 2);
    // El remanente del PARCIAL (120000-50000) + el total del ADEUDA (120000)
    expect(rev.alAprobar.deudaInicial.capital).toBeCloseTo(190000, 2);
  });

  it('un contrato ya activo no trae revisionAprobacion', async () => {
    const hoy = new Date();
    const alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: { authorization: `Bearer ${tokenAdmin}` }, // ADMIN activa directo
      payload: {
        propiedadId: await propiedadDisponible(),
        inquilino: { nombre: 'Sin', apellido: 'Revision' },
        monto: 100000,
        fechaInicio: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString(),
        fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
      },
    });
    expect(alta.statusCode, alta.body).toBeLessThan(300);
    const det = await app.inject({
      method: 'GET',
      url: `/contratos/${alta.json().id}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    expect(det.json().revisionAprobacion).toBeUndefined();
  });
});
