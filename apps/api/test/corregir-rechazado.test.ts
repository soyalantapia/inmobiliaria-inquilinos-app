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

  it('PUT /contratos/:id/borrador corrige el contrato rechazado', async () => {
    const { contratoId, aprobacionId } = await cargarContratoPendiente({
      inquilino: { nombre: 'Nadia', apellido: 'Corrige' },
      monto: 100000,
    });
    await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: authAdmin(),
      payload: { comentario: 'El monto está mal, son 150.000' },
    });

    const antes = await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authCarga() });
    const c = antes.json();

    const put = await app.inject({
      method: 'PUT',
      url: `/contratos/${contratoId}/borrador`,
      headers: authCarga(),
      payload: {
        propiedadId: c.propiedadId,
        inquilino: { nombre: 'Nadia', apellido: 'Corrige' },
        monto: 150000, // <-- lo corregido
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        diaPago: c.diaPago,
        indiceAjuste: c.indiceAjuste,
        frecuenciaAjusteMeses: c.frecuenciaAjusteMeses,
      },
    });
    expect(put.statusCode, `PUT borrador: ${put.body}`).toBe(200);

    const prisma = new PrismaClient();
    const ct = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    const liqs = await prisma.liquidacion.count({ where: { contratoId } });
    await prisma.$disconnect();

    expect(Number(ct.monto)).toBe(150000);
    expect(ct.estado).toBe('BORRADOR'); // sigue siendo borrador
    expect(ct.pendienteAprobacion).toBe(false); // editar NO reenvía
    expect(liqs).toBe(0); // no devengó nada
  });

  it('PUT /contratos/:id/borrador sobre un contrato ACTIVO da 409 y no lo toca', async () => {
    // Alta directa como ADMIN => queda ACTIVO
    const hoy = new Date();
    const alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: authAdmin(),
      payload: {
        propiedadId: await propiedadNueva(),
        inquilino: { nombre: 'Activo', apellido: 'Intocable' },
        monto: 100000,
        fechaInicio: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString(),
        fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
      },
    });
    expect(alta.statusCode, `alta activo: ${alta.body}`).toBeLessThan(300);
    const contratoId = alta.json().id as string;

    const put = await app.inject({
      method: 'PUT',
      url: `/contratos/${contratoId}/borrador`,
      headers: authAdmin(),
      payload: {
        propiedadId: alta.json().propiedadId,
        inquilino: { nombre: 'Activo', apellido: 'Intocable' },
        monto: 999999,
        fechaInicio: alta.json().fechaInicio,
        fechaFin: alta.json().fechaFin,
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
      },
    });
    expect(put.statusCode).toBe(409);

    const prisma = new PrismaClient();
    const ct = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    await prisma.$disconnect();
    expect(Number(ct.monto)).toBe(100000); // no se tocó
  });

  it('PUT /contratos/:id/borrador actualiza los datos del inquilino titular', async () => {
    const { contratoId, aprobacionId } = await cargarContratoPendiente({
      inquilino: { nombre: 'Luis', apellido: 'ConTypo', email: 'luis.contypo@mail.com', dni: '39900044' },
    });
    await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: authAdmin(),
      payload: { comentario: 'El apellido está mal escrito y falta el DNI correcto' },
    });

    const antes = await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authCarga() });
    const c = antes.json();

    const put = await app.inject({
      method: 'PUT',
      url: `/contratos/${contratoId}/borrador`,
      headers: authCarga(),
      payload: {
        propiedadId: c.propiedadId,
        inquilino: {
          nombre: 'Luis',
          apellido: 'Sintypo', // <-- corregido
          email: 'luis.sintypo@mail.com', // <-- corregido
          telefono: '1122334455',
          dni: '39900144', // <-- corregido
        },
        monto: Number(c.monto),
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        diaPago: c.diaPago,
        indiceAjuste: c.indiceAjuste,
        frecuenciaAjusteMeses: c.frecuenciaAjusteMeses,
      },
    });
    expect(put.statusCode, `PUT borrador: ${put.body}`).toBe(200);

    const prisma = new PrismaClient();
    const inq = await prisma.inquilino.findFirstOrThrow({ where: { contratoId } });
    await prisma.$disconnect();
    expect(inq.apellido).toBe('Sintypo');
    expect(inq.email).toBe('luis.sintypo@mail.com');
    expect(inq.telefono).toBe('1122334455');
    expect(inq.dni).toBe('39900144');
  });

  it('PUT /contratos/:id/borrador conserva los períodos anteriores declarados en el alta', async () => {
    // cargarContratoPendiente declara un período ADEUDA en el alta (ver el helper) —
    // si el PUT no lo reenvía tal cual, el server lo limpia (Prisma.DbNull) y la
    // corrección de un simple monto borraría en silencio ese estado inicial.
    const { contratoId, aprobacionId } = await cargarContratoPendiente({
      inquilino: { nombre: 'Marta', apellido: 'ConDeuda', email: 'marta.condeuda@mail.com', dni: '39900055' },
      monto: 80000,
    });
    await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: authAdmin(),
      payload: { comentario: 'Revisar el monto' },
    });

    const antes = await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authCarga() });
    const c = antes.json();
    expect(c.periodosAnterioresPendientes).toBeTruthy();

    const put = await app.inject({
      method: 'PUT',
      url: `/contratos/${contratoId}/borrador`,
      headers: authCarga(),
      payload: {
        propiedadId: c.propiedadId,
        inquilino: { nombre: 'Marta', apellido: 'ConDeuda' },
        monto: 85000,
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        diaPago: c.diaPago,
        indiceAjuste: c.indiceAjuste,
        frecuenciaAjusteMeses: c.frecuenciaAjusteMeses,
        periodosAnteriores: c.periodosAnterioresPendientes,
      },
    });
    expect(put.statusCode, `PUT borrador: ${put.body}`).toBe(200);

    const prisma = new PrismaClient();
    const ct = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    await prisma.$disconnect();
    expect(ct.periodosAnterioresPendientes).toBeTruthy();
    expect(Array.isArray(ct.periodosAnterioresPendientes) ? ct.periodosAnterioresPendientes.length : 0).toBe(1);
  });
});
