import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * La bandeja de aprobación mostraba SÓLO el `titulo`/`descripcion` congelados al
 * cargar el contrato ("Juan · Artigas 1744" + "Contrato cargado para revisión"), y
 * para CONTRATO_CARGADO el `monto` de la Aprobacion ni siquiera se setea. Con eso
 * alcanzaba para activar el contrato, reclamar la propiedad, devengar todas las
 * liquidaciones y aplicar la deuda histórica declarada.
 *
 * Estos tests cubren que GET /aprobaciones adjunte el contrato REAL (`contexto`) y,
 * sobre todo, los modos en que ese contexto podría mentir: quedarse pegado al
 * snapshot, filtrar contratos de otro tenant, o tumbar la bandeja entera por una
 * columna Json corrupta.
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

/** Alta de un contrato pendiente de aprobación; devuelve su id y el de la propiedad. */
async function altaPendiente(opts: {
  direccion: string;
  mesesAtras: number;
  periodosAnteriores?: { periodo: string; estado: 'PAGADO' | 'PARCIAL' | 'ADEUDA' }[];
  monto?: number;
}) {
  const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId } });
  const propiedad = await prisma.propiedad.create({
    data: {
      inmobiliariaId,
      direccion: opts.direccion,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      estado: 'DISPONIBLE',
    },
  });
  await prisma.participacionPropietario.create({
    data: {
      inmobiliariaId,
      propiedadId: propiedad.id,
      propietarioId: propietario.id,
      porcentaje: 100,
    },
  });

  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - opts.mesesAtras, 1));
  const alta = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: { authorization: `Bearer ${tokenOperador}` },
    payload: {
      propiedadId: propiedad.id,
      inquilino: { nombre: 'Ana', apellido: 'Contexto' },
      monto: opts.monto ?? 250_000,
      fechaInicio: inicio.toISOString().slice(0, 10),
      fechaFin: new Date(
        Date.UTC(inicio.getUTCFullYear() + 2, inicio.getUTCMonth(), 1),
      )
        .toISOString()
        .slice(0, 10),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      ...(opts.periodosAnteriores ? { periodosAnteriores: opts.periodosAnteriores } : {}),
    },
  });
  expect(alta.statusCode, alta.body).toBeLessThan(300);
  return { contratoId: alta.json().id as string, propiedadId: propiedad.id, inicio };
}

/** La aprobación de un contrato, tal como la ve la bandeja. */
async function contextoDe(contratoId: string) {
  const res = await app.inject({
    method: 'GET',
    url: '/aprobaciones',
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  expect(res.statusCode, res.body).toBe(200);
  const fila = res.json().find((a: { entidadId: string }) => a.entidadId === contratoId);
  expect(fila, 'la aprobación del contrato no apareció en la bandeja').toBeTruthy();
  return fila.contexto;
}

describe('GET /aprobaciones adjunta QUÉ se está aprobando', () => {
  it('devuelve el contrato real: monto, fechas, inquilino y propiedad', async () => {
    const { contratoId } = await altaPendiente({
      direccion: 'Contexto básico 100',
      mesesAtras: 0,
      monto: 333_000,
    });

    const ctx = await contextoDe(contratoId);
    expect(ctx).toBeTruthy();
    expect(ctx.contratoId).toBe(contratoId);
    expect(ctx.estadoContrato).toBe('BORRADOR');
    expect(ctx.inquilino).toBe('Ana Contexto');
    expect(ctx.propiedad).toContain('Contexto básico 100');
    expect(Number(ctx.monto)).toBe(333_000);
    expect(ctx.moneda).toBe('ARS');
    expect(ctx.diaPago).toBe(10);
    expect(ctx.modoCobranza).toBe('INMOBILIARIA');
    // Sin períodos declarados no inventamos una deuda.
    expect(ctx.deudaDeclarada).toBeNull();
    expect(ctx.deudaIlegible).toBe(false);
  });

  it('lee el CONTRATO, no el título congelado: si el monto cambia, el contexto cambia', async () => {
    // Éste es el punto del arreglo. El `titulo` de la Aprobacion se escribió una vez
    // al cargar el contrato y nunca más; si el contexto saliera de ahí, editar el
    // contrato dejaría a la bandeja mostrando un monto viejo y la administradora
    // aprobaría una cifra que ya no existe.
    const { contratoId } = await altaPendiente({
      direccion: 'Contexto que cambia 200',
      mesesAtras: 0,
      monto: 100_000,
    });
    expect(Number((await contextoDe(contratoId)).monto)).toBe(100_000);

    await prisma.contrato.update({
      where: { id: contratoId },
      data: { monto: 175_500 },
    });

    expect(Number((await contextoDe(contratoId)).monto)).toBe(175_500);
  });

  it('cuenta la deuda histórica declarada: cuántos períodos y cuántos adeudan', async () => {
    const hoy = new Date();
    const per = (n: number) => {
      const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - n, 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    };
    // 3 períodos declarados, de los cuales 2 adeudan (PARCIAL cuenta como deuda).
    const { contratoId } = await altaPendiente({
      direccion: 'Contexto con deuda 300',
      mesesAtras: 3,
      periodosAnteriores: [
        { periodo: per(3), estado: 'PAGADO' },
        { periodo: per(2), estado: 'ADEUDA' },
        { periodo: per(1), estado: 'PARCIAL' },
      ],
    });

    const ctx = await contextoDe(contratoId);
    expect(ctx.deudaDeclarada).toEqual({
      periodos: 3,
      adeudan: 2,
      desde: per(3),
      hasta: per(1),
    });
    expect(ctx.deudaIlegible).toBe(false);
  });

  it('una columna de períodos corrupta NO tumba la bandeja: la marca ilegible', async () => {
    const { contratoId } = await altaPendiente({
      direccion: 'Contexto corrupto 400',
      mesesAtras: 0,
    });
    await prisma.contrato.update({
      where: { id: contratoId },
      data: { periodosAnterioresPendientes: { esto: 'no es un array de períodos' } },
    });

    const ctx = await contextoDe(contratoId);
    // Lo importante: la request sigue devolviendo 200 (contextoDe lo afirma) y no
    // afirmamos "no hay deuda" cuando en realidad no la pudimos leer.
    expect(ctx.deudaIlegible).toBe(true);
    expect(ctx.deudaDeclarada).toBeNull();
  });

  it('si el contrato ya no existe, la fila sigue pero sin contexto', async () => {
    const { contratoId } = await altaPendiente({
      direccion: 'Contexto huérfano 500',
      mesesAtras: 0,
    });
    const apr = await prisma.aprobacion.findFirstOrThrow({ where: { entidadId: contratoId } });
    await prisma.aprobacion.update({
      where: { id: apr.id },
      data: { entidadId: 'cnt_no_existe' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/aprobaciones',
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    expect(res.statusCode).toBe(200);
    const fila = res.json().find((a: { id: string }) => a.id === apr.id);
    expect(fila).toBeTruthy();
    expect(fila.contexto).toBeNull();
  });

  it('no filtra el contrato de otra inmobiliaria aunque el entidadId apunte ahí', async () => {
    // entidadId es polimórfico y sin scope de tenant: un id ajeno devolvería el
    // contrato de otra inmobiliaria dentro de la bandeja propia.
    const otra = await prisma.inmobiliaria.create({
      data: {
        nombre: 'Inmobiliaria Ajena Contexto',
        cuit: `30${Date.now().toString().slice(-9)}`,
        email: `ajena-ctx-${Date.now()}@test.local`,
        telefono: '1100000000',
        matricula: 'M-AJENA',
        direccionCalle: 'Ajena',
        direccionAltura: '1',
        direccionCiudad: 'CABA',
        direccionProvincia: 'Buenos Aires',
        direccionCp: '1000',
        codigoReferido: `AJENA-${Date.now()}`,
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
    const contratoAjeno = await prisma.contrato.create({
      data: {
        inmobiliariaId: otra.id,
        propiedadId: propAjena.id,
        monto: 999_999,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 86_400_000),
        diaPago: 1,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
      },
    });

    const { contratoId } = await altaPendiente({
      direccion: 'Contexto cross tenant 600',
      mesesAtras: 0,
    });
    const apr = await prisma.aprobacion.findFirstOrThrow({ where: { entidadId: contratoId } });
    await prisma.aprobacion.update({
      where: { id: apr.id },
      data: { entidadId: contratoAjeno.id },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/aprobaciones',
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    const fila = res.json().find((a: { id: string }) => a.id === apr.id);
    expect(fila.contexto, 'se filtró el contrato de otra inmobiliaria').toBeNull();
  });
});
