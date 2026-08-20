/**
 * Tres agujeros por donde se escapaba plata, encontrados mientras se buscaba
 * qué páginas borrar del panel (auditoría de simplificación, 03/08).
 *
 * Los dos que se pueden probar del lado del server:
 *
 *  1. Un contrato que termina por VENCIMIENTO DE PLAZO nunca resolvía el
 *     depósito. El bloque que escribe `estadoDeposito` vivía adentro de un
 *     `if (nuevoEstado === 'RESCINDIDO')`, y el diálogo de baja tiene
 *     FINALIZADO como default. O sea: el operador elegía "Devolver $X", la
 *     pantalla le mostraba la cuenta hecha, el front mandaba `decisionDeposito`
 *     y el server lo descartaba en silencio. La garantía quedaba RETENIDA para
 *     siempre y sólo se descubría abriendo los archivados de a uno.
 *
 *  2. La bandeja de aprobaciones marcaba APROBADA cualquier tipo, pero sólo
 *     ejecutaba `CONTRATO_CARGADO`. Aprobar una DEVOLUCION_DEPOSITO daba toast
 *     verde y no devolvía nada (en el seed hay una de $510.000). Ahora ese
 *     camino falla con 501 y la aprobación queda PENDIENTE y reintentable.
 *     Rechazar sigue andando para todos los tipos: rechazar ES la acción
 *     completa, no hay nada que ejecutar cuando la respuesta es "no".
 *
 * El tercero (doble click en "Cargar propiedad" = propiedad duplicada) es de
 * front y no tiene cómo probarse acá: apps/inmobiliaria no tiene suite.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let token: string;
let tid: string;
const prisma = new PrismaClient();
const creados: { contratos: string[]; propiedades: string[]; aprobaciones: string[] } = {
  contratos: [],
  propiedades: [],
  aprobaciones: [],
};

beforeAll(async () => {
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
  tid = (await prisma.inmobiliaria.findFirstOrThrow({ where: { email: 'contacto@inmosol.com.ar' } })).id;
});

afterAll(async () => {
  // Orden por FK. Sin esto cada corrida deja basura en la DB compartida.
  if (creados.aprobaciones.length)
    await prisma.aprobacion.deleteMany({ where: { id: { in: creados.aprobaciones } } });
  if (creados.contratos.length) {
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: creados.contratos } } });
    await prisma.propiedad.updateMany({
      where: { contratoActualId: { in: creados.contratos } },
      data: { contratoActualId: null },
    });
    await prisma.inquilino.deleteMany({ where: { contratoId: { in: creados.contratos } } });
    // El historial del contrato va ANTES que el contrato: su FK es RESTRICT y desde que el
    // alta escribe un evento CREADO (T-29) todo contrato tiene al menos una fila acá. Sin
    // esto el teardown explota con un 23001 y deja la DB compartida sucia para el resto.
    // No hay riesgo de tapar un bug de producción: la app NUNCA borra un contrato —cero
    // `contrato.delete` en apps/api/src—, los finaliza o los rescinde. El borrado duro
    // existe sólo acá, para no dejar basura entre corridas.
    await prisma.eventoContrato.deleteMany({ where: { contratoId: { in: creados.contratos } } });
    await prisma.contrato.deleteMany({ where: { id: { in: creados.contratos } } });
  }
  if (creados.propiedades.length) {
    await prisma.participacionPropietario.deleteMany({
      where: { propiedadId: { in: creados.propiedades } },
    });
    await prisma.propiedad.deleteMany({ where: { id: { in: creados.propiedades } } });
  }
  await app.close();
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${token}` });

/** Propiedad + contrato ACTIVO con depósito en custodia, listo para dar de baja. */
async function contratoConDeposito(deposito: number) {
  const prop = await app.inject({
    method: 'POST',
    url: '/propiedades',
    headers: auth(),
    payload: {
      direccion: `Baja con depósito ${Date.now()}${Math.floor(performance.now())}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
    },
  });
  expect(prop.statusCode).toBe(200);
  const propiedadId = prop.json().id;
  creados.propiedades.push(propiedadId);

  const cto = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: auth(),
    payload: {
      propiedadId,
      inquilino: { nombre: 'Inquilino', apellido: 'DeBaja' },
      monto: 100000,
      moneda: 'ARS',
      fechaInicio: '2026-01-01',
      fechaFin: '2027-01-01',
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      tipoContrato: 'ALQUILER',
      depositoGarantia: deposito,
    },
  });
  expect(cto.statusCode).toBe(200);
  const contratoId = cto.json().id;
  creados.contratos.push(contratoId);
  return contratoId;
}

describe('Bug 1 — el depósito se resuelve en cualquier baja, no sólo en la rescisión', () => {
  it('finalizar por VENCIMIENTO DE PLAZO con "Devolver" deja el depósito DEVUELTO', async () => {
    const contratoId = await contratoConDeposito(510000);

    const res = await app.inject({
      method: 'POST',
      url: `/contratos/${contratoId}/finalizar`,
      headers: auth(),
      // tipo FINALIZADO es el default del diálogo de baja: el caso NORMAL.
      payload: { tipo: 'FINALIZADO', decisionDeposito: 'DEVOLVER', montoDepositoDevuelto: 510000 },
    });
    expect(res.statusCode).toBe(200);

    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(c.estado).toBe('FINALIZADO');
    // ANTES de este fix quedaba en RETENIDO para siempre.
    expect(c.estadoDeposito).toBe('DEVUELTO');
    expect(Number(c.depositoDevueltoMonto)).toBe(510000);
    expect(c.depositoDevueltoAt).not.toBeNull();
  });

  it('finalizar con "Mantener" deja el depósito RETENIDO a propósito', async () => {
    // El fix NO tiene que resolver de más: MANTENER significa "se decide después".
    const contratoId = await contratoConDeposito(200000);
    const res = await app.inject({
      method: 'POST',
      url: `/contratos/${contratoId}/finalizar`,
      headers: auth(),
      payload: { tipo: 'FINALIZADO', decisionDeposito: 'MANTENER' },
    });
    expect(res.statusCode).toBe(200);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(c.estadoDeposito).toBe('RETENIDO');
    expect(c.depositoDevueltoAt).toBeNull();
  });

  it('la rescisión sigue escribiendo motivo y fecha efectiva (no se rompió)', async () => {
    const contratoId = await contratoConDeposito(300000);
    const res = await app.inject({
      method: 'POST',
      url: `/contratos/${contratoId}/finalizar`,
      headers: auth(),
      payload: {
        tipo: 'RESCINDIDO',
        motivoRescision: 'Se muda de ciudad',
        decisionDeposito: 'DEVOLVER',
        montoDepositoDevuelto: 300000,
      },
    });
    expect(res.statusCode).toBe(200);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(c.estado).toBe('RESCINDIDO');
    expect(c.motivoRescision).toBe('Se muda de ciudad');
    expect(c.fechaEfectivaRescision).not.toBeNull();
    expect(c.estadoDeposito).toBe('DEVUELTO');
  });

  it('finalizar SIN decisión de depósito no toca los campos de rescisión', async () => {
    const contratoId = await contratoConDeposito(150000);
    const res = await app.inject({
      method: 'POST',
      url: `/contratos/${contratoId}/finalizar`,
      headers: auth(),
      payload: { tipo: 'FINALIZADO' },
    });
    expect(res.statusCode).toBe(200);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(c.motivoRescision).toBeNull();
    expect(c.fechaEfectivaRescision).toBeNull();
  });
});

describe('Bug 2 — aprobar no puede decir que sí y no hacer nada', () => {
  async function crearAprobacion(tipo: 'DEVOLUCION_DEPOSITO' | 'GASTO_CAJA_ELIMINACION') {
    const admin = await prisma.usuario.findFirstOrThrow({ where: { inmobiliariaId: tid, rol: 'ADMIN' } });
    const apr = await prisma.aprobacion.create({
      data: {
        inmobiliariaId: tid,
        tipo,
        titulo: `Test ${tipo}`,
        descripcion: 'Creada por el test',
        entidadId: 'cnt_003',
        cargadoPorId: admin.id,
        rolAutor: 'OPERADOR',
        cargadoAt: new Date(),
      },
    });
    creados.aprobaciones.push(apr.id);
    return apr.id;
  }

  it('aprobar una DEVOLUCION_DEPOSITO devuelve 501 y la deja PENDIENTE', async () => {
    const id = await crearAprobacion('DEVOLUCION_DEPOSITO');
    const res = await app.inject({ method: 'POST', url: `/aprobaciones/${id}/aprobar`, headers: auth(), payload: {} });
    // ANTES: 200, estado APROBADA, toast verde, y el depósito seguía retenido.
    expect(res.statusCode).toBe(501);
    expect(res.json().message).toMatch(/Dep[óo]sitos de garant[íi]a|pendiente/i);
    const apr = await prisma.aprobacion.findUniqueOrThrow({ where: { id } });
    expect(apr.estado).toBe('PENDIENTE');
    expect(apr.aprobadoAt).toBeNull();
  });

  it('aprobar un GASTO_CAJA_ELIMINACION también queda pendiente', async () => {
    const id = await crearAprobacion('GASTO_CAJA_ELIMINACION');
    const res = await app.inject({ method: 'POST', url: `/aprobaciones/${id}/aprobar`, headers: auth(), payload: {} });
    expect(res.statusCode).toBe(501);
    const apr = await prisma.aprobacion.findUniqueOrThrow({ where: { id } });
    expect(apr.estado).toBe('PENDIENTE');
  });

  it('RECHAZAR sí funciona para esos tipos: rechazar es la acción completa', async () => {
    const id = await crearAprobacion('DEVOLUCION_DEPOSITO');
    const res = await app.inject({
      method: 'POST',
      url: `/aprobaciones/${id}/rechazar`,
      headers: auth(),
      payload: { comentario: 'No corresponde devolver: hay daños sin cubrir' },
    });
    expect(res.statusCode).toBe(200);
    const apr = await prisma.aprobacion.findUniqueOrThrow({ where: { id } });
    expect(apr.estado).toBe('RECHAZADA');
  });
});
