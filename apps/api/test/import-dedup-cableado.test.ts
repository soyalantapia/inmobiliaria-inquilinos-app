import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG — el dedup por dirección se había cableado en la ruta, pero un refactor posterior
// se llevó ese cableado y quedó APAGADO: la función seguía existiendo y su test unitario
// seguía verde, porque probaba la función pura y no el call site. Este test ejercita el
// ENDPOINT: la validación tiene que marcar DUPLICADO una fila cuya dirección ya existe en la
// cartera del tenant. Es el test que faltaba para que la regresión no pase inadvertida.

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let impId = '';
let direccionExistente = '';

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  const prop = await prisma.propiedad.findFirstOrThrow({ where: { inmobiliariaId: inmo.id }, select: { direccion: true } });
  direccionExistente = prop.direccion;

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tADMIN = login.json().token;

  // Planilla con 2 filas: una repite una dirección YA cargada (escrita distinto, para
  // ejercitar la normalización) y la otra es nueva.
  const imp = await prisma.importacionCartera.create({
    data: {
      inmobiliariaId: inmo.id, archivoUrl: '', nombreArchivo: 'zz-cazabug.csv',
      columnas: ['direccion', 'inquilino', 'monto', 'inicio'],
      filas: [
        [direccionExistente.toUpperCase() + '  ', 'Juan Perez', '150000', '01/01/2026'],
        ['ZZ Calle Inexistente 9999', 'Ana Gomez', '150000', '01/01/2026'],
      ],
      mapeoColumnas: {}, totalFilas: 2, estado: 'SUBIDO', creadoPor: 'test',
    },
  });
  impId = imp.id;
});

afterAll(async () => {
  if (impId) await prisma.importacionCartera.deleteMany({ where: { id: impId } });
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — el dedup por dirección está CABLEADO en la ruta', () => {
  it('la validación marca DUPLICADO la fila cuya dirección ya está en la cartera', async () => {
    const r = await app.inject({
      method: 'PUT',
      url: `/importaciones-cartera/${impId}/mapeo`,
      headers: { authorization: `Bearer ${tADMIN}` },
      payload: { mapeo: { direccion: 0, inquilinoNombre: 1, monto: 2, fechaInicio: 3 } },
    });
    expect(r.statusCode).toBe(200);
    const filas = r.json().filas as { fila: number; estado: string; motivo: string | null }[];

    const repetida = filas.find((f) => f.fila === 0);
    expect(repetida?.estado, 'la dirección ya existe en la cartera').toBe('DUPLICADO');
    expect(repetida?.motivo ?? '').toMatch(/dirección/i);

    // La fila nueva NO se marca duplicada: no rompimos la importación legítima.
    const nueva = filas.find((f) => f.fila === 1);
    expect(nueva?.estado).not.toBe('DUPLICADO');
  });
});
