import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Hoy, rechazar un contrato cargado por una empleada BORRA al inquilino (y sus
 * hijos: OTP, acuses, documentos, certificados). El contrato queda un cascarón:
 * para corregirlo hay que cargar todo de cero. La razón que lo justificaba
 * (el email quedaba tomado por el @@unique de Inquilino) murió con
 * multi-alquiler: ese unique se mudó a Persona, el rechazo no toca Persona, y
 * buscarOCrearPersona es find-or-create. Este test prueba que el rechazo
 * conserva el inquilino — y que, mientras el contrato siga en BORRADOR, ese
 * inquilino no aparece en los listados (nunca llegó a ser inquilino de verdad).
 */

let app: FastifyInstance;
let tokenCarga: string;
let tokenAdmin: string;

const authCarga = () => ({ authorization: `Bearer ${tokenCarga}` });
const authAdmin = () => ({ authorization: `Bearer ${tokenAdmin}` });

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

// El seed no deja NINGUNA propiedad en estado DISPONIBLE y GET /propiedades no
// filtra por query string (ignora ?estado=...) — devuelve todo el listado del
// tenant. Por eso, en vez de depender del seed, creamos una propiedad libre por test
// (mismo patrón que revision-aprobacion.test.ts).
let contador = 0;
async function propiedadNueva(): Promise<string> {
  contador += 1;
  const res = await app.inject({
    method: 'POST',
    url: '/propiedades',
    headers: authAdmin(),
    payload: {
      direccion: `Test corregir-rechazado ${contador}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
    },
  });
  expect(res.statusCode, `crear propiedad ${contador}: ${res.body}`).toBeLessThan(300);
  return res.json().id;
}

function periodoDe(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function cargarContratoPendiente(opts: {
  inquilino: { nombre: string; apellido: string; email?: string; dni?: string };
  monto?: number;
}): Promise<{ contratoId: string; aprobacionId: string }> {
  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
  const fin = new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1));
  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: authCarga(), // CARGA => queda BORRADOR + pendienteAprobacion
    payload: {
      propiedadId: await propiedadNueva(),
      inquilino: opts.inquilino,
      monto: opts.monto ?? 100000,
      fechaInicio: inicio.toISOString(),
      fechaFin: fin.toISOString(),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      periodosAnteriores: [{ periodo: periodoDe(inicio), estado: 'ADEUDA' }],
    },
  });
  expect(alta.statusCode, `crear contrato: ${alta.body}`).toBeLessThan(300);
  const contratoId = alta.json().id as string;
  const det = await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authAdmin() });
  return { contratoId, aprobacionId: det.json().revisionAprobacion.aprobacionId };
}

describe('corregir contrato rechazado — el rechazo ya no vacía el contrato', () => {
  it('rechazar conserva el inquilino y sus datos', async () => {
    const { contratoId, aprobacionId } = await cargarContratoPendiente({
      // DNI/email propios de este archivo: '31222333' colisiona con DNI_MARTINA de
      // import-persona-dni-tardio.test.ts (DB de test compartida entre archivos,
      // fileParallelism:false) — buscarOCrearPersona busca por DNI primero y
      // reusaría la Persona equivocada entre tests.
      inquilino: { nombre: 'Sofia', apellido: 'Rechazada', email: 'sofia.rechazada@mail.com', dni: '39900011' },
    });

    const rech = await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: authAdmin(),
      payload: { comentario: 'El monto no coincide con el contrato firmado' },
    });
    expect(rech.statusCode).toBe(200);

    const prisma = new PrismaClient();
    const contrato = await prisma.contrato.findUniqueOrThrow({
      where: { id: contratoId },
      include: { inquilinoTitular: true },
    });
    const inqs = await prisma.inquilino.count({ where: { contratoId } });
    await prisma.$disconnect();

    // Lo nuevo: el inquilino sobrevive
    expect(inqs).toBe(1);
    expect(contrato.inquilinoTitular).not.toBeNull();
    expect(contrato.inquilinoTitular?.nombre).toBe('Sofia');
    // Y lo que ya andaba, sin regresión
    expect(contrato.estado).toBe('BORRADOR');
    expect(contrato.pendienteAprobacion).toBe(false);
    expect(contrato.periodosAnterioresPendientes).not.toBeNull();
  });

  it('el inquilino de un contrato en borrador NO figura en los listados', async () => {
    const { aprobacionId } = await cargarContratoPendiente({
      inquilino: { nombre: 'Tomas', apellido: 'Borrador', email: 'tomas.borrador@mail.com', dni: '39900022' },
    });
    await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: authAdmin(),
      payload: { comentario: 'Faltan los documentos del garante' },
    });

    const lista = await app.inject({ method: 'GET', url: '/inquilinos', headers: authAdmin() });
    const nombres = (lista.json() as Array<{ nombre: string }>).map((i) => i.nombre);
    expect(nombres).not.toContain('Tomas');

    const personas = await app.inject({ method: 'GET', url: '/personas', headers: authAdmin() });
    const nomPersonas = (personas.json() as Array<{ nombre: string }>).map((p) => p.nombre);
    expect(nomPersonas).not.toContain('Tomas');
  });

  it('el contrato rechazado expone la decisión con su motivo', async () => {
    const { contratoId, aprobacionId } = await cargarContratoPendiente({
      inquilino: { nombre: 'Ivan', apellido: 'Motivo', email: 'ivan.motivo@mail.com', dni: '39900033' },
    });
    await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: authAdmin(),
      payload: { comentario: 'Las expensas no coinciden con la liquidación del consorcio' },
    });

    const det = await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authAdmin() });
    const d = det.json().decisionAprobacion;
    expect(d).toBeTruthy();
    expect(d.estado).toBe('RECHAZADA');
    expect(d.comentario).toContain('consorcio');
    expect(d.decididoPor).toContain('Roberto'); // el NOMBRE, no el user id
    expect(d.decididoAt).toEqual(expect.any(String));
    // Y ya no está pendiente, así que no viaja la revisión
    expect(det.json().revisionAprobacion).toBeUndefined();
  });
});
