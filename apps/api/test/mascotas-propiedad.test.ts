/**
 * "¿Se permiten mascotas?" pasó a ser un atributo de la PROPIEDAD (no del
 * contrato) — feedback 03/08. Cubre el circuito NUEVO end-to-end:
 *   - POST /propiedades acepta el campo → GET lo devuelve.
 *   - PUT /propiedades/:id lo edita, con el tri-estado undefined/null/valor.
 *   - POST /contratos ya NO lo acepta (lo ignora en silencio, no rompe 400).
 * El test del BACKFILL de la migración vive en backfill-mascotas-propiedad.test.ts
 * (necesita reproducir el estado de la DB ANTES de esta migración, así que
 * corre su propia DB efímera aparte).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
});

afterAll(async () => {
  await app.close();
});

const auth = () => ({ authorization: `Bearer ${token}` });

describe('Mascotas: atributo de la propiedad (feedback 03/08)', () => {
  it('POST /propiedades con mascotasPermitidas:true → el GET la devuelve', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/propiedades',
      headers: auth(),
      payload: {
        direccion: 'Test Mascotas 123',
        ciudad: 'CABA',
        provincia: 'Buenos Aires',
        tipo: 'DEPARTAMENTO',
        mascotasPermitidas: true,
        propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
      },
    });
    expect(res.statusCode).toBe(200);
    const creada = res.json();
    expect(creada.mascotasPermitidas).toBe(true);

    const detalle = await app.inject({ method: 'GET', url: `/propiedades/${creada.id}`, headers: auth() });
    expect(detalle.statusCode).toBe(200);
    expect(detalle.json().mascotasPermitidas).toBe(true);
  });

  it('POST /propiedades sin el campo → queda no especificado (null)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/propiedades',
      headers: auth(),
      payload: {
        direccion: 'Test Mascotas Sin Especificar 456',
        ciudad: 'CABA',
        provincia: 'Buenos Aires',
        tipo: 'CASA',
        propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().mascotasPermitidas).toBe(null);
  });

  it('PUT /propiedades/:id edita el valor (true → false → null → sin tocar)', async () => {
    const alta = await app.inject({
      method: 'POST',
      url: '/propiedades',
      headers: auth(),
      payload: {
        direccion: 'Test Mascotas Editar 789',
        ciudad: 'CABA',
        provincia: 'Buenos Aires',
        tipo: 'DEPARTAMENTO',
        mascotasPermitidas: true,
        propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
      },
    });
    const id = alta.json().id;
    const base = {
      direccion: 'Test Mascotas Editar 789',
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
    };

    // true → false
    const r1 = await app.inject({
      method: 'PUT',
      url: `/propiedades/${id}`,
      headers: auth(),
      payload: { ...base, mascotasPermitidas: false },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().mascotasPermitidas).toBe(false);

    // false → null ("volver a no especificado", explícito)
    const r2 = await app.inject({
      method: 'PUT',
      url: `/propiedades/${id}`,
      headers: auth(),
      payload: { ...base, mascotasPermitidas: null },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().mascotasPermitidas).toBe(null);

    // Puesta explícita en true de nuevo…
    await app.inject({
      method: 'PUT',
      url: `/propiedades/${id}`,
      headers: auth(),
      payload: { ...base, mascotasPermitidas: true },
    });

    // …y un PUT que OMITE el campo (undefined) no lo toca: sigue en true.
    const r3 = await app.inject({
      method: 'PUT',
      url: `/propiedades/${id}`,
      headers: auth(),
      payload: { ...base },
    });
    expect(r3.statusCode).toBe(200);
    expect(r3.json().mascotasPermitidas).toBe(true);
  });

  it('POST /contratos ya NO acepta mascotasPermitidas: si un cliente viejo lo manda, se ignora sin 400', async () => {
    // Propiedad PROPIA, creada acá: usar una del seed (prp_006) hacía que el
    // test pasara sólo la primera vez — en la segunda corrida contra la misma
    // DB la propiedad ya tenía contrato y el POST devolvía 409.
    const prop = await app.inject({
      method: 'POST',
      url: '/propiedades',
      headers: auth(),
      payload: {
        direccion: `Test Contrato Legacy ${Date.now()}`,
        ciudad: 'CABA',
        provincia: 'Buenos Aires',
        tipo: 'DEPARTAMENTO',
        propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
      },
    });
    expect(prop.statusCode).toBe(200);

    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: {
        propiedadId: prop.json().id,
        inquilino: { nombre: 'Cliente', apellido: 'Viejo' },
        monto: 100000,
        moneda: 'ARS',
        fechaInicio: '2026-08-01',
        fechaFin: '2027-08-01',
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        tipoContrato: 'ALQUILER',
        // Campo legacy que un cliente viejo todavía podría mandar: debe ignorarse,
        // NO debe tirar 400 ni escribirse en ningún lado.
        mascotasPermitidas: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const contrato = res.json();
    // La columna vieja del contrato queda deprecada: nunca se escribe desde acá.
    expect(contrato.mascotasPermitidas ?? null).toBe(null);
  });

  // El circuito sólo sirve si el dato LLEGA al inquilino: /mi-contrato es la
  // única pantalla donde lo ve. Cargarlo bien en la propiedad y que la app no
  // lo muestre sería mover el campo de lugar y romper la función.
  describe('GET /mi-contrato (lo que ve el inquilino)', () => {
    const prisma = new PrismaClient();
    let tokenInq: string;
    let propiedadId: string;
    // Valores originales del seed: los restauramos para no dejarle el estado
    // cambiado a los otros archivos de test (comparten la misma DB).
    let propOriginal: boolean | null = null;
    let contratoOriginal: boolean | null = null;

    beforeAll(async () => {
      const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
      tokenInq = demo.json().token;
      const contrato = await prisma.contrato.findUniqueOrThrow({
        where: { id: 'cnt_001' },
        select: { propiedadId: true, mascotasPermitidas: true },
      });
      propiedadId = contrato.propiedadId;
      contratoOriginal = contrato.mascotasPermitidas;
      const prop = await prisma.propiedad.findUniqueOrThrow({
        where: { id: propiedadId },
        select: { mascotasPermitidas: true },
      });
      propOriginal = prop.mascotasPermitidas;
    });

    afterAll(async () => {
      await prisma.propiedad.update({
        where: { id: propiedadId },
        data: { mascotasPermitidas: propOriginal },
      });
      await prisma.contrato.update({
        where: { id: 'cnt_001' },
        data: { mascotasPermitidas: contratoOriginal },
      });
      await prisma.$disconnect();
    });

    it('devuelve el valor de la PROPIEDAD, aunque el contrato legacy diga lo contrario', async () => {
      await prisma.propiedad.update({
        where: { id: propiedadId },
        data: { mascotasPermitidas: true },
      });
      // El valor viejo del contrato dice lo OPUESTO: si ganara, el inquilino
      // vería lo que se cargó hace un año en vez de lo que dice la propiedad hoy.
      await prisma.contrato.update({
        where: { id: 'cnt_001' },
        data: { mascotasPermitidas: false },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/mi-contrato',
        headers: { authorization: `Bearer ${tokenInq}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().mascotasPermitidas).toBe(true);
    });

    it('si la propiedad no lo tiene cargado, cae al valor legacy del contrato', async () => {
      // Red de seguridad del backfill: una propiedad que quedó sin el dato no
      // debe DEJAR DE MOSTRAR lo que el inquilino ya veía antes del cambio.
      await prisma.propiedad.update({
        where: { id: propiedadId },
        data: { mascotasPermitidas: null },
      });
      await prisma.contrato.update({
        where: { id: 'cnt_001' },
        data: { mascotasPermitidas: true },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/mi-contrato',
        headers: { authorization: `Bearer ${tokenInq}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().mascotasPermitidas).toBe(true);
    });
  });
});
