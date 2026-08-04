import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * `fechaInicio` no tenía NINGÚN camino de escritura después del alta, y no es un
 * dato cosmético: es el arranque del devengo. Cargada de más, el contrato nace
 * con cuotas VENCIDAS que el inquilino nunca debió y figura moroso; cargada de
 * menos, esos meses no se facturan nunca y el propietario cobra de menos.
 *
 * Este endpoint cubre SÓLO el contrato en BORRADOR, que todavía no devengó nada.
 * El contrato ACTIVO es otro problema: `generarLiquidacionesContrato` usa
 * createMany({ skipDuplicates: true }), o sea es ADITIVO — mover el inicio no
 * borra las cuotas sobrantes, que siguen generando mora y pueden tener pagos
 * CONCILIADO que ya movieron caja. El test del 409 es el que fija esa frontera:
 * si algún día alguien la corre "para que sea más útil", esto se pone rojo.
 */
let app: FastifyInstance;
let prisma: PrismaClient;
let tokenOperador: string;
let tokenAdmin: string;
let inmobiliariaId: string;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({
    where: { nombre: 'Inmobiliaria del Sol' },
  });
  inmobiliariaId = inmo.id;
  await prisma.inmobiliaria.update({
    where: { id: inmobiliariaId },
    data: { contratosRequierenAprobacion: true },
  });
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
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

/** Alta con el token que se le pase: OPERADOR deja BORRADOR, ADMIN deja ACTIVO. */
async function alta(direccion: string, token: string) {
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
  const r = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      propiedadId: propiedad.id,
      inquilino: { nombre: 'Fecha', apellido: 'Mal' },
      monto: 300_000,
      fechaInicio: inicio.toISOString().slice(0, 10),
      fechaFin: new Date(Date.UTC(inicio.getUTCFullYear() + 2, inicio.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
    },
  });
  expect(r.statusCode, r.body).toBeLessThan(300);
  return r.json().id as string;
}

const corregir = (id: string, payload: Record<string, unknown>, token = tokenAdmin) =>
  app.inject({
    method: 'PUT',
    url: `/contratos/${id}/borrador`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });

describe('corregir un contrato antes de aprobarlo', () => {
  it('cambia la vigencia de un BORRADOR y deja rastro en el historial', async () => {
    const id = await alta('Corregir borrador 100', tokenOperador);
    const antes = await prisma.contrato.findUniqueOrThrow({ where: { id } });
    expect(antes.estado).toBe('BORRADOR');

    const r = await corregir(id, { fechaInicio: '2026-03-01', fechaFin: '2028-03-01', monto: 355_000 });
    expect(r.statusCode, r.body).toBe(200);

    const c = await prisma.contrato.findUniqueOrThrow({ where: { id } });
    expect(c.fechaInicio.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(c.fechaFin.toISOString().slice(0, 10)).toBe('2028-03-01');
    expect(Number(c.monto)).toBe(355_000);
    expect(c.estado).toBe('BORRADOR'); // corregir NO aprueba

    const ev = await prisma.eventoContrato.findFirst({
      where: { contratoId: id, titulo: { contains: 'Corrección del borrador' } },
    });
    expect(ev, 'la corrección no dejó rastro').toBeTruthy();
  });

  it('🔴 un contrato ACTIVO da 409: sus cuotas ya se generaron', async () => {
    // Ésta es la frontera del endpoint. Si algún día alguien la corre "para que
    // sirva también en activos", este test se pone rojo — que es el punto.
    const id = await alta('Corregir borrador activo 200', tokenAdmin);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id } });
    expect(c.estado).toBe('ACTIVO');

    const r = await corregir(id, { fechaInicio: '2020-01-01' });
    expect(r.statusCode, r.body).toBe(409);
    expect(r.json().message).toMatch(/ya está activo/i);

    // Y no tocó nada.
    const despues = await prisma.contrato.findUniqueOrThrow({ where: { id } });
    expect(despues.fechaInicio.toISOString()).toBe(c.fechaInicio.toISOString());
  });

  it('un borrador con cuotas colgadas también da 409, no las deja huérfanas', async () => {
    const id = await alta('Corregir borrador con liq 300', tokenOperador);
    // Estado imposible por diseño, pero si pasara, cambiar las fechas dejaría la
    // cuota colgada de un período que ya no existe.
    await prisma.liquidacion.create({
      data: {
        inmobiliariaId,
        contratoId: id,
        periodo: '2026-01',
        montoAlquiler: 300_000,
        montoTotal: 300_000,
        fechaVencimiento: new Date('2026-01-10'),
        estado: 'PENDIENTE',
      },
    });

    const r = await corregir(id, { fechaInicio: '2026-06-01' });
    expect(r.statusCode, r.body).toBe(409);
    expect(r.json().message).toMatch(/cuotas generadas/i);
  });

  it('rechaza un fin anterior al inicio, incluso combinando el valor nuevo con el viejo', async () => {
    const id = await alta('Corregir borrador fechas 400', tokenOperador);
    // Sólo manda fechaInicio: el fin queda el que ya tenía. La validación tiene
    // que comparar contra el valor EFECTIVO, no sólo entre los campos enviados.
    const r = await corregir(id, { fechaInicio: '2099-01-01' });
    expect(r.statusCode, r.body).toBe(400);
    expect(r.json().message).toMatch(/posterior/i);
  });

  it('no toca el contrato de otra inmobiliaria', async () => {
    const otra = await prisma.inmobiliaria.create({
      data: {
        nombre: 'Ajena Borrador',
        cuit: `30${Date.now().toString().slice(-9)}`,
        email: `ajena-borr-${Date.now()}@test.local`,
        telefono: '1100000000',
        matricula: 'M-AJ',
        direccionCalle: 'Ajena',
        direccionAltura: '1',
        direccionCiudad: 'CABA',
        direccionProvincia: 'Buenos Aires',
        direccionCp: '1000',
        codigoReferido: `AJB-${Date.now()}`,
      },
    });
    const propAjena = await prisma.propiedad.create({
      data: {
        inmobiliariaId: otra.id,
        direccion: 'Secreta 999',
        ciudad: 'CABA',
        provincia: 'Buenos Aires',
        tipo: 'DEPARTAMENTO',
        estado: 'DISPONIBLE',
      },
    });
    const ajeno = await prisma.contrato.create({
      data: {
        inmobiliariaId: otra.id,
        propiedadId: propAjena.id,
        estado: 'BORRADOR',
        monto: 111_111,
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2028-01-01'),
        diaPago: 1,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
      },
    });

    const r = await corregir(ajeno.id, { monto: 1 });
    expect(r.statusCode).toBe(404);
    expect(Number((await prisma.contrato.findUniqueOrThrow({ where: { id: ajeno.id } })).monto)).toBe(111_111);
  });
});
