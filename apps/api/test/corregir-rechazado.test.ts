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

  it('PUT /contratos/:id/borrador SIN mandar periodosAnteriores preserva la deuda declarada en el alta', async () => {
    // El bug: el endpoint recibe el body COMPLETO, y si el caller no manda
    // periodosAnteriores el server no puede tratar esa AUSENCIA como si fuera un
    // array vacío ("no hay deuda"). Acá el caller solo quiere corregir el monto —
    // no dice nada sobre la deuda — y aun así antes se borraba en silencio.
    const { contratoId, aprobacionId } = await cargarContratoPendiente({
      inquilino: { nombre: 'Pedro', apellido: 'SinCampo', email: 'pedro.sincampo@mail.com', dni: '39900066' },
      monto: 90000,
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
        inquilino: { nombre: 'Pedro', apellido: 'SinCampo' },
        monto: 95000, // <-- solo corrige el monto
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        diaPago: c.diaPago,
        indiceAjuste: c.indiceAjuste,
        frecuenciaAjusteMeses: c.frecuenciaAjusteMeses,
        // periodosAnteriores NO viaja — este es el caso peligroso.
      },
    });
    expect(put.statusCode, `PUT borrador: ${put.body}`).toBe(200);

    const prisma = new PrismaClient();
    const ct = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    await prisma.$disconnect();
    expect(Number(ct.monto)).toBe(95000);
    // La deuda declarada en el alta sigue ahí: ausencia del campo no es una
    // instrucción de borrar.
    expect(ct.periodosAnterioresPendientes).toBeTruthy();
    expect(Array.isArray(ct.periodosAnterioresPendientes) ? ct.periodosAnterioresPendientes.length : 0).toBe(1);
  });

  it('PUT /contratos/:id/borrador con periodosAnteriores: [] explícito SÍ limpia la deuda declarada', async () => {
    const { contratoId, aprobacionId } = await cargarContratoPendiente({
      inquilino: { nombre: 'Rosa', apellido: 'ArrayVacio', email: 'rosa.arrayvacio@mail.com', dni: '39900077' },
      monto: 70000,
    });
    await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: authAdmin(),
      payload: { comentario: 'Ya no hay deuda histórica que declarar' },
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
        inquilino: { nombre: 'Rosa', apellido: 'ArrayVacio' },
        monto: 70000,
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        diaPago: c.diaPago,
        indiceAjuste: c.indiceAjuste,
        frecuenciaAjusteMeses: c.frecuenciaAjusteMeses,
        periodosAnteriores: [], // <-- explícito: "no hay períodos"
      },
    });
    expect(put.statusCode, `PUT borrador: ${put.body}`).toBe(200);

    const prisma = new PrismaClient();
    const ct = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    await prisma.$disconnect();
    expect(ct.periodosAnterioresPendientes).toBeNull();
  });

  it('PUT /contratos/:id/borrador sobre un contrato de OTRA inmobiliaria da 404 y no lo toca', async () => {
    const { contratoId } = await cargarContratoPendiente({
      inquilino: { nombre: 'Carla', apellido: 'OtroTenant', email: 'carla.otrotenant@mail.com', dni: '39900088' },
      monto: 60000,
    });

    // Inmobiliaria + usuario AJENOS, filas reales (requireUsuario revalida contra
    // la DB) — mismo patrón que soporte.test.ts para probar la frontera de tenant.
    const idAjena = 'ZZcorregir-ajena';
    const uidAjeno = 'ZZcorregir-u-ajena';
    const prisma = new PrismaClient();
    await prisma.usuario.deleteMany({ where: { id: uidAjeno } });
    await prisma.inmobiliaria.deleteMany({ where: { id: idAjena } });
    await prisma.inmobiliaria.create({
      data: {
        id: idAjena,
        nombre: 'Inmobiliaria Ajena (test)',
        cuit: '30-99999999-9',
        email: 'contacto@ajena.test.local',
        telefono: '1100000000',
        matricula: 'M-9999',
        direccionCalle: 'Calle Ajena',
        direccionAltura: '1',
        direccionCiudad: 'CABA',
        direccionProvincia: 'Buenos Aires',
        direccionCp: '1000',
        codigoReferido: `REF-${idAjena}`,
      },
    });
    await prisma.usuario.create({
      data: {
        id: uidAjeno,
        inmobiliariaId: idAjena,
        nombre: 'Intruso',
        apellido: 'Ajeno',
        email: 'intruso@ajena.test.local',
        rol: 'ADMIN',
        activo: true,
      },
    });
    const tokenAjeno = app.jwt.sign({ kind: 'usuario', userId: uidAjeno, inmobiliariaId: idAjena, rol: 'ADMIN' });

    const put = await app.inject({
      method: 'PUT',
      url: `/contratos/${contratoId}/borrador`,
      headers: { authorization: `Bearer ${tokenAjeno}` },
      payload: {
        propiedadId: 'no-existe',
        inquilino: { nombre: 'Hackeado', apellido: 'Ajeno' },
        monto: 1,
        fechaInicio: new Date().toISOString(),
        fechaFin: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
      },
    });
    expect(put.statusCode).toBe(404);

    const ct = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    await prisma.usuario.deleteMany({ where: { id: uidAjeno } });
    await prisma.inmobiliaria.deleteMany({ where: { id: idAjena } });
    await prisma.$disconnect();
    expect(Number(ct.monto)).toBe(60000); // no se tocó
  });

  it('PUT /contratos/:id/borrador con una propiedadId que ya tiene contrato activo da 409 y no mueve el contrato', async () => {
    const { contratoId, aprobacionId } = await cargarContratoPendiente({
      inquilino: { nombre: 'Diego', apellido: 'Colisiona', email: 'diego.colisiona@mail.com', dni: '39900099' },
      monto: 50000,
    });
    await app.inject({
      method: 'POST',
      url: `/aprobaciones/${aprobacionId}/rechazar`,
      headers: authAdmin(),
      payload: { comentario: 'Revisar la propiedad' },
    });

    const antes = await app.inject({ method: 'GET', url: `/contratos/${contratoId}`, headers: authCarga() });
    const c = antes.json();

    // Otra propiedad, con un contrato ACTIVO de verdad (alta directa como ADMIN).
    const hoy = new Date();
    const altaActivo = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: authAdmin(),
      payload: {
        propiedadId: await propiedadNueva(),
        inquilino: { nombre: 'Otro', apellido: 'Activo' },
        monto: 200000,
        fechaInicio: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString(),
        fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
      },
    });
    expect(altaActivo.statusCode, `alta activo: ${altaActivo.body}`).toBeLessThan(300);
    const propiedadOcupada = altaActivo.json().propiedadId as string;

    const put = await app.inject({
      method: 'PUT',
      url: `/contratos/${contratoId}/borrador`,
      headers: authCarga(),
      payload: {
        propiedadId: propiedadOcupada, // <-- ya tiene un contrato activo
        inquilino: { nombre: 'Diego', apellido: 'Colisiona' },
        monto: 55000,
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        diaPago: c.diaPago,
        indiceAjuste: c.indiceAjuste,
        frecuenciaAjusteMeses: c.frecuenciaAjusteMeses,
      },
    });
    expect(put.statusCode).toBe(409);

    const prisma = new PrismaClient();
    const ct = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    await prisma.$disconnect();
    expect(ct.propiedadId).toBe(c.propiedadId); // sigue en su propiedad original
    expect(Number(ct.monto)).toBe(50000); // no se tocó nada
  });
});
