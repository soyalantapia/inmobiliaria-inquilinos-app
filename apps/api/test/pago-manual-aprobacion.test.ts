import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * El catálogo declara `pago.manual.cargar` con rolesAprobacion: ['OPERADOR'] —
 * o sea, el cobro manual que carga un OPERADOR DEBE quedar pendiente de que lo
 * autorice otra persona. Pero `requiereAprobacion()` no la llamaba NADIE: el
 * único camino cableado era contratoQuedaPendiente (contratos). El endpoint
 * pedía 'pago.conciliar' y el pago nacía CONCILIADO con decididoPorId = quien
 * lo cargaba, así que cargar y autorizar eran la misma acción de la misma
 * persona en el mismo instante.
 *
 * Resultado en la oficina de Camila (reunión 03/08): "vi 850k cobrados
 * habiendo autorizado 550k".
 *
 * Estos tests fijan el circuito y, sobre todo, los modos en que podría volver a
 * ser teatro: que el pendiente igual mueva la liquidación, o que quien lo cargó
 * pueda darse el visto a sí misma.
 */
let app: FastifyInstance;
let prisma: PrismaClient;
let tokenOperador: string;
let tokenAdmin: string;
let inmobiliariaId: string;
let operadorId: string;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({
    where: { nombre: 'Inmobiliaria del Sol' },
  });
  inmobiliariaId = inmo.id;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tokenOperador = (
    await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'luciana@delsol.com', password: 'delsol123' },
    })
  ).json().token;
  tokenAdmin = (
    await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'roberto@delsol.com', password: 'delsol123' },
    })
  ).json().token;
  operadorId = (
    await prisma.usuario.findFirstOrThrow({ where: { email: 'luciana@delsol.com' } })
  ).id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

/** Crea un contrato ACTIVO propio con una liquidación devengada e impaga. */
async function liquidacionImpaga(direccion: string, monto = 200_000) {
  const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId } });
  const propiedad = await prisma.propiedad.create({
    data: {
      inmobiliariaId,
      direccion,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      estado: 'DISPONIBLE',
    },
  });
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 },
  });
  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: { authorization: `Bearer ${tokenAdmin}` }, // ADMIN: nace ACTIVO
    payload: {
      propiedadId: propiedad.id,
      inquilino: { nombre: 'Pago', apellido: 'Manual' },
      monto,
      fechaInicio: inicio.toISOString().slice(0, 10),
      fechaFin: new Date(Date.UTC(inicio.getUTCFullYear() + 2, inicio.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
    },
  });
  expect(alta.statusCode, alta.body).toBeLessThan(300);
  const contratoId = alta.json().id as string;
  const liq = await prisma.liquidacion.findFirstOrThrow({
    where: { contratoId, estado: { not: 'PAGADO' } },
    orderBy: { periodo: 'asc' },
  });
  return { contratoId, liquidacionId: liq.id, montoTotal: Number(liq.montoTotal) };
}

const cobrarManual = (token: string, liquidacionId: string, monto: number) =>
  app.inject({
    method: 'POST',
    url: '/pagos/manual',
    headers: { authorization: `Bearer ${token}` },
    payload: { liquidacionId, monto, metodo: 'EFECTIVO', fecha: new Date().toISOString(), pin: '1234' },
  });

describe('el cobro manual de un OPERADOR no se contabiliza solo', () => {
  it('queda INFORMADO, sin decisor, y NO mueve la liquidación', async () => {
    const { liquidacionId } = await liquidacionImpaga('Pago manual operador 100');

    const res = await cobrarManual(tokenOperador, liquidacionId, 50_000);
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().pendienteValidacion).toBe(true);

    const pago = await prisma.pago.findFirstOrThrow({ where: { liquidacionId } });
    expect(pago.estado).toBe('INFORMADO');
    expect(pago.decididoPorId).toBeNull(); // nadie lo autorizó todavía
    expect(pago.registradoPorId).toBe(operadorId); // pero sabemos de quién es

    // LO CENTRAL: la plata NO se contabilizó. Si esto se rompe, volvimos al bug.
    const liq = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liquidacionId } });
    expect(liq.estado).not.toBe('PAGADO');
    expect(liq.estado).not.toBe('PARCIAL');
    expect(liq.fechaPago).toBeNull();
  });

  it('quien lo cargó NO puede validarlo: hacen falta cuatro ojos', async () => {
    const { liquidacionId } = await liquidacionImpaga('Pago manual cuatro ojos 200');
    const creado = await cobrarManual(tokenOperador, liquidacionId, 50_000);
    const pagoId = creado.json().id as string;

    // El mismo OPERADOR intenta darse el visto.
    const propio = await app.inject({
      method: 'POST',
      url: `/pagos/${pagoId}/validar`,
      headers: { authorization: `Bearer ${tokenOperador}` },
      payload: { pin: '1234' },
    });
    expect(propio.statusCode, propio.body).toBe(409);
    expect(propio.json().message).toMatch(/cargaste vos/i);

    // Sigue sin contabilizarse.
    expect(
      (await prisma.pago.findUniqueOrThrow({ where: { id: pagoId } })).estado,
    ).toBe('INFORMADO');
  });

  it('otra persona SÍ lo valida, y recién ahí la plata entra', async () => {
    const { liquidacionId, montoTotal } = await liquidacionImpaga('Pago manual validado 300');
    const creado = await cobrarManual(tokenOperador, liquidacionId, montoTotal);
    const pagoId = creado.json().id as string;

    const ok = await app.inject({
      method: 'POST',
      url: `/pagos/${pagoId}/validar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { pin: '1234' },
    });
    expect(ok.statusCode, ok.body).toBe(200);

    const pago = await prisma.pago.findUniqueOrThrow({ where: { id: pagoId } });
    expect(pago.estado).toBe('CONCILIADO');
    expect(pago.decididoPorId).not.toBeNull();
    expect(pago.decididoPorId).not.toBe(pago.registradoPorId); // el que autorizó es OTRO

    const liq = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liquidacionId } });
    expect(liq.estado).toBe('PAGADO');
  });

  it('dos cobros pendientes sobre el mismo período dan 409, no un error de constraint', async () => {
    // Sobre `pagos` hay un índice único parcial (liquidacionId) WHERE
    // estado='INFORMADO'. Sin el pre-check, el segundo create explotaría con un
    // error crudo de Postgres en plena caja.
    const { liquidacionId } = await liquidacionImpaga('Pago manual doble pendiente 400');
    expect((await cobrarManual(tokenOperador, liquidacionId, 10_000)).statusCode).toBe(201);

    const segundo = await cobrarManual(tokenOperador, liquidacionId, 10_000);
    expect(segundo.statusCode, segundo.body).toBe(409);
    expect(segundo.json().message).toMatch(/esperando validación/i);
  });
});

describe('el ADMIN sigue cobrando en un paso', () => {
  it('nace CONCILIADO y contabiliza en el acto, pero deja registrado quién lo cargó', async () => {
    const { liquidacionId, montoTotal } = await liquidacionImpaga('Pago manual admin 500');

    const res = await cobrarManual(tokenAdmin, liquidacionId, montoTotal);
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().pendienteValidacion).toBe(false);

    const pago = await prisma.pago.findFirstOrThrow({ where: { liquidacionId } });
    expect(pago.estado).toBe('CONCILIADO');
    expect(pago.registradoPorId).not.toBeNull(); // la trazabilidad vale para todos
    expect(pago.decididoPorId).toBe(pago.registradoPorId); // el ADMIN es ambas cosas, y queda dicho

    const liq = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liquidacionId } });
    expect(liq.estado).toBe('PAGADO');
  });
});
