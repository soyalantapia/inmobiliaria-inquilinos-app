import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

/**
 * El alta con el flag de aprobación prendido. Cubre lo que el unit puro no puede:
 * que el borrador NO reclame la propiedad, NO devengue, y que los períodos
 * anteriores queden guardados para aplicarse al aprobar.
 */
let app: FastifyInstance;
let prisma: PrismaClient;
let tokenOperador: string;
let inmobiliariaId: string;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  inmobiliariaId = inmo.id;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tokenOperador = await loginTest(app, 'luciana@delsol.com', 'delsol123');
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${tokenOperador}` });

async function propiedadLibre(nombre: string): Promise<string> {
  const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId } });
  const p = await prisma.propiedad.create({
    data: {
      inmobiliariaId,
      direccion: `Test aprobación ${nombre}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      estado: 'DISPONIBLE',
    },
  });
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: p.id, propietarioId: propietario.id, porcentaje: 100 },
  });
  return p.id;
}

function altaBase(propiedadId: string, nombre: string) {
  return {
    propiedadId,
    inquilino: { nombre },
    monto: 100_000,
    fechaInicio: '2026-01-01',
    fechaFin: '2028-01-01',
    diaPago: 10,
    indiceAjuste: 'ICL',
    frecuenciaAjusteMeses: 12,
  };
}

describe('POST /contratos con aprobación configurable', () => {
  it('flag APAGADO: el OPERADOR activa directo (comportamiento de hoy, no regresión)', async () => {
    await prisma.inmobiliaria.update({
      where: { id: inmobiliariaId },
      data: { contratosRequierenAprobacion: false },
    });
    const propiedadId = await propiedadLibre('off');
    const res = await app.inject({
      method: 'POST', url: '/contratos', headers: auth(),
      payload: altaBase(propiedadId, 'Directo'),
    });
    expect(res.statusCode).toBeLessThan(300);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: res.json().id } });
    expect(c.estado).toBe('ACTIVO');
    expect(c.pendienteAprobacion).toBe(false);
    const prop = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    expect(prop.contratoActualId).toBe(c.id); // reclamó la propiedad
  });

  it('flag PRENDIDO: el OPERADOR deja borrador, sin reclamar la propiedad ni devengar, y con Aprobación en la bandeja', async () => {
    await prisma.inmobiliaria.update({
      where: { id: inmobiliariaId },
      data: { contratosRequierenAprobacion: true },
    });
    const propiedadId = await propiedadLibre('on');
    const res = await app.inject({
      method: 'POST', url: '/contratos', headers: auth(),
      payload: altaBase(propiedadId, 'Pendiente'),
    });
    expect(res.statusCode).toBeLessThan(300);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: res.json().id } });
    expect(c.estado).toBe('BORRADOR');
    expect(c.pendienteAprobacion).toBe(true);
    const prop = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    expect(prop.contratoActualId).toBeNull(); // NO reclamó
    expect(await prisma.liquidacion.count({ where: { contratoId: c.id } })).toBe(0); // NO devengó
    const apr = await prisma.aprobacion.findFirstOrThrow({ where: { entidadId: c.id } });
    expect(apr.tipo).toBe('CONTRATO_CARGADO');
    expect(apr.rolAutor).toBe('OPERADOR'); // el rol REAL, no 'CARGA' hardcodeado
  });

  it('flag PRENDIDO con períodos anteriores: ya no da 400, quedan guardados en el borrador', async () => {
    await prisma.inmobiliaria.update({
      where: { id: inmobiliariaId },
      data: { contratosRequierenAprobacion: true },
    });
    const propiedadId = await propiedadLibre('periodos');
    const res = await app.inject({
      method: 'POST', url: '/contratos', headers: auth(),
      payload: {
        ...altaBase(propiedadId, 'EnCurso'),
        periodosAnteriores: [{ periodo: '2026-01', estado: 'ADEUDA' }],
      },
    });
    expect(res.statusCode).toBeLessThan(300);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: res.json().id } });
    expect(c.estado).toBe('BORRADOR');
    expect(c.periodosAnterioresPendientes).toEqual([{ periodo: '2026-01', estado: 'ADEUDA' }]);
  });
});
