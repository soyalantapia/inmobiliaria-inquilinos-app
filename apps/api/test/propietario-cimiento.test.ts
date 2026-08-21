/**
 * Cimiento del alta (auditoría de IA del panel, 03/08). Cubre lo que el
 * frontend no puede cubrir solo: `apps/inmobiliaria` no tiene NI UN test, así
 * que el contrato del server es la única red que tienen estos fixes.
 *
 *  - El CUIT se guarda SIEMPRE en dígitos, entre por la puerta que entre.
 *    Antes convivían "20301234567" y "20-30123456-7" en la misma columna y el
 *    buscador no encontraba lo recién cargado ("no se guardó").
 *  - El mínimo para dar de alta un propietario es nombre + apellido, y NADA
 *    más. Las dos puertas del panel pedían cosas distintas entre sí.
 *  - La comisión que se manda explícita es la que queda. El 8% del default
 *    seguía aplicando en silencio y es el % que después usa la rendición.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

let app: FastifyInstance;
let token: string;
const prisma = new PrismaClient();
const creados: string[] = [];

beforeAll(async () => {
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
});

afterAll(async () => {
  // Los propietarios creados acá no cuelgan de ninguna propiedad, así que se
  // borran directo. Sin esto, cada corrida deja basura en la DB compartida.
  if (creados.length) await prisma.propietario.deleteMany({ where: { id: { in: creados } } });
  await app.close();
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${token}` });

async function crearPropietario(payload: Record<string, unknown>) {
  const res = await app.inject({ method: 'POST', url: '/propietarios', headers: auth(), payload });
  if (res.statusCode === 200) creados.push(res.json().id);
  return res;
}

describe('Alta de propietario: el contrato que unifica las dos puertas', () => {
  it('guarda el CUIT en dígitos aunque venga con guiones', async () => {
    const res = await crearPropietario({
      nombre: 'Delfina',
      apellido: 'Guiones',
      cuit: '27-30123456-4',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().cuit).toBe('27301234564');
  });

  it('el mismo CUIT por las dos puertas queda IDÉNTICO en la base', async () => {
    // Es el bug de fondo: dos formatos del mismo número en la misma columna.
    const conGuiones = await crearPropietario({ nombre: 'Puerta', apellido: 'Uno', cuit: '20-30123456-7' });
    const pelado = await crearPropietario({ nombre: 'Puerta', apellido: 'Dos', cuit: '20301234567' });
    expect(conGuiones.statusCode).toBe(200);
    expect(pelado.statusCode).toBe(200);
    expect(conGuiones.json().cuit).toBe(pelado.json().cuit);
  });

  it('acepta el alta con SÓLO nombre y apellido', async () => {
    // La puerta de /propietarios exigía además CUIT y email; el wizard exigía
    // teléfono. Ninguna de las dos coincidía con lo que pide el server.
    const res = await crearPropietario({ nombre: 'Mínimo', apellido: 'Viable' });
    expect(res.statusCode).toBe(200);
    const p = res.json();
    expect(p.cuit).toBe('');
    expect(p.email).toBe('');
    expect(p.telefono).toBe('');
  });

  it('respeta la comisión explícita en vez de aplicar el 8% por default', async () => {
    const res = await crearPropietario({ nombre: 'Comisión', apellido: 'Elegida', comisionPct: 12 });
    expect(res.statusCode).toBe(200);
    expect(res.json().comisionPct).toBe(12);
  });

  it('sin comisión explícita sigue quedando en 8 (no rompe lo ya cargado)', async () => {
    const res = await crearPropietario({ nombre: 'Comisión', apellido: 'Default' });
    expect(res.statusCode).toBe(200);
    expect(res.json().comisionPct).toBe(8);
  });

  it('editar tampoco re-ensucia el formato del CUIT', async () => {
    const alta = await crearPropietario({ nombre: 'Editado', apellido: 'Formato', cuit: '20301234567' });
    const id = alta.json().id;
    const res = await app.inject({
      method: 'PUT',
      url: `/propietarios/${id}`,
      headers: auth(),
      payload: { nombre: 'Editado', apellido: 'Formato', cuit: '20-30123456-7' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().cuit).toBe('20301234567');
  });

  it('sigue rechazando un alta sin apellido', async () => {
    // El mínimo bajó, no desapareció: un propietario sin apellido no sirve
    // para rendirle ni para identificarlo en la cartera.
    const res = await app.inject({
      method: 'POST',
      url: '/propietarios',
      headers: auth(),
      payload: { nombre: 'Solo' },
    });
    expect(res.statusCode).toBe(400);
  });
});
