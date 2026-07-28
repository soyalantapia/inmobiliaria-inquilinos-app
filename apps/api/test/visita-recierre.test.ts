import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P2 — `transicionar` devolvía true cuando la visita YA estaba en el estado destino
// (idempotencia del doble-tap), y /listo seguía adelante igual. Si el inquilino marcaba
// PERSISTE, el reclamo volvía a EN_CURSO y el guard del updateMany —que sólo mira estados
// terminales— dejaba re-cerrarlo: otro trabajo sumado al profesional y el costo imputado
// DE NUEVO. Ahora /listo sólo corre los efectos si hubo transición real.

let app: FastifyInstance;
let prisma: PrismaClient;
let tid = '';
let reclamoId = '';
let profId = '';
let sesion = '';
const TOKEN = 'ZZ-cazabug-recierre';

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  const prof = await prisma.profesional.findFirstOrThrow({ where: { inmobiliariaId: tid } });
  profId = prof.id;
  const rec = await prisma.reclamo.create({
    data: {
      inmobiliariaId: tid, contratoId: 'cnt_001', propiedadId: 'prp_001',
      categoria: 'PLOMERIA', urgencia: 'MEDIA', descripcion: 'Recierre (cazabug)',
      estado: 'EN_CURSO', pagador: 'INQUILINO', costoTrabajo: 5000,
    },
  });
  reclamoId = rec.id;
  await prisma.visitaProfesional.create({
    data: { inmobiliariaId: tid, reclamoId: rec.id, profesionalId: prof.id, token: TOKEN, estado: 'EN_CAMINO', enCaminoAt: new Date() },
  });
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const r = await app.inject({ method: 'GET', url: `/visitas-publicas/${TOKEN}` });
  sesion = r.json().sesion;
});

afterAll(async () => {
  if (reclamoId) {
    await prisma.cargoContrato.deleteMany({ where: { reclamoId } });
    await prisma.reclamoEvento.deleteMany({ where: { reclamoId } });
    await prisma.visitaProfesional.deleteMany({ where: { reclamoId } });
    await prisma.reclamo.deleteMany({ where: { id: reclamoId } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

const listo = () =>
  app.inject({ method: 'POST', url: '/visitas-publicas/listo', headers: { authorization: `Bearer ${sesion}` }, payload: { notaFinal: 'Se cambió el flexible', montoCobrado: 5000 } });

describe('CAZABUG — el link mágico no re-cierra un reclamo reabierto', () => {
  let trabajosTrasCierre = 0;

  it('el primer /listo cierra el reclamo y suma el trabajo', async () => {
    const antes = await prisma.profesional.findUniqueOrThrow({ where: { id: profId } });
    const r = await listo();
    expect(r.statusCode).toBe(200);
    const rec = await prisma.reclamo.findUniqueOrThrow({ where: { id: reclamoId } });
    expect(rec.estado).toBe('RESUELTO');
    const prof = await prisma.profesional.findUniqueOrThrow({ where: { id: profId } });
    expect(prof.cantTrabajos).toBe(antes.cantTrabajos + 1);
    trabajosTrasCierre = prof.cantTrabajos;
  });

  it('tras PERSISTE (reclamo reabierto), un segundo /listo NO lo re-cierra ni suma trabajo', async () => {
    // El inquilino marca que el problema persiste: el reclamo vuelve a EN_CURSO.
    await prisma.reclamo.update({ where: { id: reclamoId }, data: { estado: 'EN_CURSO' } });

    const r = await listo();
    expect(r.statusCode).toBe(200); // idempotente, no error

    const rec = await prisma.reclamo.findUniqueOrThrow({ where: { id: reclamoId } });
    expect(rec.estado).toBe('EN_CURSO'); // con el bug: volvía a RESUELTO
    const prof = await prisma.profesional.findUniqueOrThrow({ where: { id: profId } });
    expect(prof.cantTrabajos).toBe(trabajosTrasCierre); // con el bug: +1 otra vez
  });

  it('una visita ya cerrada no acepta cambiar las fotos', async () => {
    const r = await app.inject({
      method: 'PUT', url: '/visitas-publicas/fotos',
      headers: { authorization: `Bearer ${sesion}` },
      payload: { fotoAntes: `/uploads/${tid}/x.jpg` },
    });
    expect(r.statusCode).toBe(409);
  });
});
