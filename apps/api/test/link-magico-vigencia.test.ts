import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P2 — el link mágico del profesional (token opaco, @unique) NO vencía ni se
// consumía: cualquiera que tuviera el link —reenviado por WhatsApp, o en el teléfono de un
// profesional que ya no trabaja con la inmobiliaria— lo canjeaba por sesiones de 14 días
// PARA SIEMPRE. Y la respuesta trae la dirección de la propiedad y el nombre y teléfono del
// inquilino. Ahora el link muere: al terminar el trabajo (con gracia), al cerrarse el
// reclamo, y por antigüedad.

let app: FastifyInstance;
let prisma: PrismaClient;
let tid = '';
const IDS: string[] = [];

async function crearVisita(opts: { estadoReclamo?: 'ABIERTO' | 'CERRADO'; listoHace?: number; reclamoHace?: number }) {
  const rec = await prisma.reclamo.create({
    data: {
      inmobiliariaId: tid, contratoId: 'cnt_001', propiedadId: 'prp_001',
      categoria: 'PLOMERIA', urgencia: 'MEDIA', descripcion: 'Visita (cazabug link mágico)',
      estado: opts.estadoReclamo ?? 'ABIERTO',
      ...(opts.reclamoHace ? { createdAt: new Date(Date.now() - opts.reclamoHace) } : {}),
    },
  });
  const prof = await prisma.profesional.findFirstOrThrow({ where: { inmobiliariaId: tid } });
  const token = `ZZ-cazabug-${rec.id}`;
  const v = await prisma.visitaProfesional.create({
    data: {
      inmobiliariaId: tid, reclamoId: rec.id, profesionalId: prof.id, token,
      estado: opts.listoHace ? 'LISTO' : 'ASIGNADO',
      ...(opts.listoHace ? { listoAt: new Date(Date.now() - opts.listoHace) } : {}),
    },
  });
  IDS.push(rec.id);
  return { token, visitaId: v.id };
}

const abrir = (token: string) => app.inject({ method: 'GET', url: `/visitas-publicas/${token}` });
const DIA = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
});

afterAll(async () => {
  if (IDS.length) {
    await prisma.visitaProfesional.deleteMany({ where: { reclamoId: { in: IDS } } });
    await prisma.reclamo.deleteMany({ where: { id: { in: IDS } } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — el link mágico del profesional vence', () => {
  it('una visita en curso ABRE normal (no rompimos el caso real)', async () => {
    const { token } = await crearVisita({});
    const r = await abrir(token);
    expect(r.statusCode).toBe(200);
    expect(r.json().sesion).toBeTruthy();
  });

  it('recién terminada sigue abriendo: hay gracia para ver la confirmación', async () => {
    const { token } = await crearVisita({ listoHace: 2 * 60 * 60 * 1000 }); // 2 h
    expect((await abrir(token)).statusCode).toBe(200);
  });

  it('terminada hace 5 días → 410 (antes: sesión nueva de 14 días, para siempre)', async () => {
    const { token } = await crearVisita({ listoHace: 5 * DIA });
    const r = await abrir(token);
    expect(r.statusCode).toBe(410);
  });

  it('reclamo CERRADO → 410 (no hay trabajo que hacer)', async () => {
    const { token } = await crearVisita({ estadoReclamo: 'CERRADO' });
    expect((await abrir(token)).statusCode).toBe(410);
  });

  it('reclamo de hace 90 días sin terminar → 410 (tope duro de antigüedad)', async () => {
    const { token } = await crearVisita({ reclamoHace: 90 * DIA });
    expect((await abrir(token)).statusCode).toBe(410);
  });

  it('un token inexistente sigue dando 404', async () => {
    expect((await abrir('ZZ-no-existe')).statusCode).toBe(404);
  });
});
