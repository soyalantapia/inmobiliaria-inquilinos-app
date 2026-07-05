import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// Ecosistema de profesionales:
//  - Fase 0: /visitas-publicas/listo cierra el reclamo (RESUELTO), imputa el costo
//    y suma al track record (cantTrabajos/ultimoTrabajo), idempotente.
//  - Fase 1: publicar a la red (dedup por teléfono), directorio, ficha técnica
//    reputacional cross-tenant, contratar de la red.
//  - PRIVACIDAD (crítico): la ficha pública NO filtra dirección, comentarios de
//    rating ni datos del inquilino, aunque el reclamo sí los tenga.

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let tid = '';
const TEL = '+54 9 11 9988 7766'; // pA y pB comparten teléfono → misma identidad de red
const TEL_NORM = '5491199887766';
let pAId = ''; // "Sergio" en la inmo (públco)
let pBId = ''; // "Sergio" otra vez (simula otra inmo) → misma red
let pCId = ''; // para Fase 0 (aislado)
let redId = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const post = (url: string, t: string, payload?: unknown) =>
  app.inject({ method: 'POST', url, headers: auth(t), payload: (payload ?? {}) as object });
const get = (url: string, t: string) => app.inject({ method: 'GET', url, headers: auth(t) });

async function limpiar() {
  const profs = await prisma.profesional.findMany({ where: { inmobiliariaId: tid, nombre: { startsWith: 'ZZ' } }, select: { id: true } });
  const ids = profs.map((p) => p.id);
  if (ids.length) {
    const recs = await prisma.reclamo.findMany({ where: { profesionalId: { in: ids } }, select: { id: true } });
    const recIds = recs.map((r) => r.id);
    await prisma.ratingReclamo.deleteMany({ where: { reclamoId: { in: recIds } } });
    await prisma.reclamoEvento.deleteMany({ where: { reclamoId: { in: recIds } } });
    await prisma.visitaProfesional.deleteMany({ where: { reclamoId: { in: recIds } } });
    await prisma.reclamo.deleteMany({ where: { id: { in: recIds } } });
    await prisma.profesional.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.profesionalRed.deleteMany({ where: { telefono: TEL_NORM } });
}

// Crea un trabajo COMPLETO (reclamo resuelto + visita LISTO + rating con PII).
async function trabajoConPii(profId: string, contratoId: string, propiedadId: string, monto: number, estrellas: number, pii: string) {
  const rec = await prisma.reclamo.create({
    data: {
      inmobiliariaId: tid, contratoId, propiedadId, profesionalId: profId,
      categoria: 'PLOMERIA', descripcion: `Fuga · ${pii}`, urgencia: 'MEDIA', estado: 'RESUELTO', resueltoAt: new Date(),
    },
  });
  await prisma.visitaProfesional.create({
    data: {
      inmobiliariaId: tid, reclamoId: rec.id, profesionalId: profId, token: `zz-${rec.id}`,
      estado: 'LISTO', confirmadaAt: new Date(Date.now() - 7200_000), enCaminoAt: new Date(Date.now() - 5400_000),
      listoAt: new Date(Date.now() - 3600_000), montoCobrado: monto, notaFinal: `Resuelto en ${pii}`,
    },
  });
  await prisma.ratingReclamo.create({
    data: { inmobiliariaId: tid, reclamoId: rec.id, estrellas, comentario: `Excelente. ${pii}` },
  });
  return rec.id;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  await limpiar();

  const pA = await prisma.profesional.create({ data: { inmobiliariaId: tid, nombre: 'ZZ Sergio Red', categoria: 'PLOMERO', zona: 'CABA', telefono: TEL } });
  const pB = await prisma.profesional.create({ data: { inmobiliariaId: tid, nombre: 'ZZ Sergio RedB', categoria: 'PLOMERO', zona: 'Rosario', telefono: TEL } });
  const pC = await prisma.profesional.create({ data: { inmobiliariaId: tid, nombre: 'ZZ Fase0', categoria: 'ELECTRICISTA', zona: 'CABA', telefono: '+54 9 11 5000 0000' } });
  pAId = pA.id; pBId = pB.id; pCId = pC.id;

  // Trabajos con PII para pA y pB (misma identidad de red) — direcciones/comentarios
  // que NO deben salir a la ficha pública.
  await trabajoConPii(pAId, 'cnt_001', 'prp_001', 5000, 5, 'GORRITI-4521-SECRETO-JUAN');
  await trabajoConPii(pBId, 'cnt_002', 'prp_002', 8000, 4, 'DIRECCION-B-456-SECRETO-ANA');

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tADMIN = login.json().token;
});

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

describe('Ecosistema — Fase 1: publicar, directorio, contratar', () => {
  it('publicar linkea a la red por teléfono (dedup): pA y pB → misma ProfesionalRed', async () => {
    const rA = await post(`/profesionales/${pAId}/publicar`, tADMIN);
    expect(rA.statusCode).toBe(200);
    redId = rA.json().profesionalRedId;
    const rB = await post(`/profesionales/${pBId}/publicar`, tADMIN);
    expect(rB.statusCode).toBe(200);
    expect(rB.json().profesionalRedId).toBe(redId); // misma identidad
  });
  it('directorio de la red lista la identidad con reputación agregada', async () => {
    const r = await get('/red/profesionales', tADMIN);
    expect(r.statusCode).toBe(200);
    const red = (r.json() as { id: string; trabajos: number; reseñas: number; enMiCartera: boolean }[]).find((x) => x.id === redId);
    expect(red).toBeTruthy();
    expect(red!.trabajos).toBe(2); // suma pA + pB (cross-tenant a nivel agregación)
    expect(red!.reseñas).toBe(2);
    expect(red!.enMiCartera).toBe(true);
  });
  it('despublicar y republicar togglea la visibilidad', async () => {
    expect((await post(`/profesionales/${pAId}/despublicar`, tADMIN)).statusCode).toBe(200);
    expect((await post(`/profesionales/${pAId}/publicar`, tADMIN)).statusCode).toBe(200);
  });
});

describe('Ecosistema — ficha técnica + PRIVACIDAD', () => {
  it('la ficha agrega cross-tenant (2 trabajos, rating 4.5) y trae contacto si es mío', async () => {
    const r = await get(`/red/profesionales/${redId}`, tADMIN);
    expect(r.statusCode).toBe(200);
    const f = r.json();
    expect(f.trabajos).toBe(2);
    expect(f.reseñas).toBe(2);
    expect(f.ratingPromedio).toBe(4.5); // (5+4)/2
    expect(f.categorias).toContain('PLOMERIA');
    expect(f.trabajosRecientes.length).toBe(2);
    expect(f.enMiCartera).toBe(true);
    expect(f.contacto?.telefono).toBeTruthy();
  });
  it('la ficha NO filtra PII: ni dirección, ni comentarios, ni inquilino', async () => {
    const r = await get(`/red/profesionales/${redId}`, tADMIN);
    const raw = r.body; // el JSON crudo
    expect(raw).not.toContain('GORRITI'); // dirección de un reclamo
    expect(raw).not.toContain('SECRETO'); // comentario/nota con PII
    expect(raw).not.toContain('DIRECCION-B');
    // Cada trabajo reciente solo expone categoría/ciudad/estrellas/fecha
    const f = r.json();
    for (const t of f.trabajosRecientes) {
      expect(Object.keys(t).sort()).toEqual(['categoria', 'ciudad', 'estrellas', 'fecha']);
    }
  });
  it('contratar de la red crea mi ficha privada linkeada (idempotente)', async () => {
    // Segundo tenant simulado: borro el vínculo de pA para simular "no lo tengo" y contrato.
    // (En esta suite pA ya es mío; validamos el idempotente: contratar devuelve mi ficha.)
    const r = await post(`/red/profesionales/${redId}/contratar`, tADMIN);
    expect([200, 201]).toContain(r.statusCode);
    expect(r.json().profesionalRedId).toBe(redId);
    expect(r.json().inmobiliariaId).toBe(tid);
  });
});

describe('Ecosistema — Fase 0: /listo cierra el reclamo y cuenta el trabajo', () => {
  it('marcar LISTO resuelve el reclamo, imputa costo y suma cantTrabajos (idempotente)', async () => {
    const rec = await prisma.reclamo.create({
      data: { inmobiliariaId: tid, contratoId: 'cnt_003', propiedadId: 'prp_003', profesionalId: pCId, categoria: 'ELECTRICIDAD', descripcion: 'ZZ Fase0', urgencia: 'ALTA', estado: 'EN_CURSO' },
    });
    const visita = await prisma.visitaProfesional.create({
      data: { inmobiliariaId: tid, reclamoId: rec.id, profesionalId: pCId, token: `zz-fase0-${rec.id}`, estado: 'EN_CAMINO', confirmadaAt: new Date(Date.now() - 3600_000), enCaminoAt: new Date(Date.now() - 1800_000) },
    });
    const jwt = app.jwt.sign({ kind: 'profesional', visitaId: visita.id, inmobiliariaId: tid, profesionalId: pCId }, { expiresIn: '1h' });

    const before = await prisma.profesional.findUniqueOrThrow({ where: { id: pCId }, select: { cantTrabajos: true } });
    const r = await app.inject({ method: 'POST', url: '/visitas-publicas/listo', headers: { authorization: `Bearer ${jwt}` }, payload: { notaFinal: 'Cambié el térmico', montoCobrado: 12000 } });
    expect(r.statusCode).toBe(200);

    const recAfter = await prisma.reclamo.findUniqueOrThrow({ where: { id: rec.id }, select: { estado: true, resueltoAt: true, costoTrabajo: true } });
    expect(recAfter.estado).toBe('RESUELTO');
    expect(recAfter.resueltoAt).not.toBeNull();
    expect(Number(recAfter.costoTrabajo)).toBe(12000);
    const after = await prisma.profesional.findUniqueOrThrow({ where: { id: pCId }, select: { cantTrabajos: true, ultimoTrabajo: true } });
    expect(after.cantTrabajos).toBe(before.cantTrabajos + 1);
    expect(after.ultimoTrabajo).not.toBeNull();

    // Idempotente: re-marcar LISTO no re-cuenta ni re-cierra.
    const r2 = await app.inject({ method: 'POST', url: '/visitas-publicas/listo', headers: { authorization: `Bearer ${jwt}` }, payload: { notaFinal: 'otra vez' } });
    expect(r2.statusCode).toBe(200);
    const after2 = await prisma.profesional.findUniqueOrThrow({ where: { id: pCId }, select: { cantTrabajos: true } });
    expect(after2.cantTrabajos).toBe(after.cantTrabajos); // no incrementó de nuevo
  });
});
