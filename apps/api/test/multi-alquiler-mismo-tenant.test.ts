import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Dos contratos del MISMO email en la MISMA inmobiliaria (bug histórico: el
 * @@unique([inmobiliariaId, email]) de Inquilino lo hacía imposible, y el
 * workaround era dejar el email vacío → la propiedad quedaba invisible para el
 * inquilino). Crear las dos filas ya es media prueba: con el unique vivo, el
 * segundo create tira P2002. La otra media es que /auth/otp/verify liste las dos.
 */
const EMAIL = 'dos.alquileres@test.com';

let app: FastifyInstance;
let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId: inmo.id } });

  for (const n of [1, 2]) {
    const propiedad = await prisma.propiedad.create({
      data: {
        inmobiliariaId: inmo.id,
        direccion: `Test multi ${n}`,
        ciudad: 'CABA',
        provincia: 'Buenos Aires',
        tipo: 'DEPARTAMENTO',
        estado: 'ALQUILADA',
      },
    });
    await prisma.participacionPropietario.create({
      // inmobiliariaId es requerido por el schema actual (no estaba en el snippet del
      // brief; ParticipacionPropietario lo exige desde una migración anterior a la Task 7,
      // ver test/rendicion-multiowner.test.ts:66 para el mismo patrón).
      data: { inmobiliariaId: inmo.id, propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 },
    });
    const contrato = await prisma.contrato.create({
      data: {
        inmobiliariaId: inmo.id,
        propiedadId: propiedad.id,
        estado: 'ACTIVO',
        monto: 100_000 * n,
        moneda: 'ARS',
        fechaInicio: new Date('2026-01-01T00:00:00Z'),
        fechaFin: new Date('2028-01-01T00:00:00Z'),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        tipoContrato: 'ALQUILER',
        modoCobranza: 'INMOBILIARIA',
      },
    });
    // Con el @@unique([inmobiliariaId, email]) vivo, ESTA línea tira P2002 en n=2.
    await prisma.inquilino.create({
      data: {
        inmobiliariaId: inmo.id,
        nombre: 'Dos',
        apellido: `Alquileres ${n}`,
        email: EMAIL,
        contratoId: contrato.id,
        esInvitado: false,
      },
    });
  }
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('multi-alquiler en la misma inmobiliaria', () => {
  it('el OTP lista los DOS alquileres del mismo email en el mismo tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { email: EMAIL, code: '000000' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.personaToken).toBeTruthy();
    expect(body.alquileres).toHaveLength(2);
    // Los dos son de la MISMA inmobiliaria: es exactamente el caso que antes no existía.
    const inmobiliarias = new Set(body.alquileres.map((a: { inmobiliaria: string }) => a.inmobiliaria));
    expect(inmobiliarias.size).toBe(1);
  });

  it('se puede entrar a cada uno y el token apunta a contratos distintos', async () => {
    const verify = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { email: EMAIL, code: '000000' },
    });
    const { personaToken, alquileres } = verify.json();
    const contratos = new Set<string>();
    for (const a of alquileres as Array<{ inquilinoId: string }>) {
      const elegir = await app.inject({
        method: 'POST',
        url: '/auth/inquilino/elegir',
        headers: { authorization: `Bearer ${personaToken}` },
        payload: { inquilinoId: a.inquilinoId },
      });
      expect(elegir.statusCode).toBe(200);
      contratos.add(elegir.json().contratoId);
    }
    expect(contratos.size).toBe(2);
  });
});
