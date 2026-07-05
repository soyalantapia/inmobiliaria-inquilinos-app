import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { seedOperacion } from '../prisma/seeds/operacion.js';

let app: FastifyInstance;
let tokenAdmin: string;
let tokenCarga: string;
let tokenInquilino: string; // Mariela (cnt_001), vía /auth/demo

const SEED_RECLAMOS = ['rec_001', 'rec_002', 'rec_003', 'rec_004', 'rec_005', 'rec_006'];
const SEED_EVENTOS = [
  'ev_001_1',
  'ev_002_1', 'ev_002_2', 'ev_002_3', 'ev_002_4', 'ev_002_5',
  'ev_003_1',
  'ev_004_1', 'ev_004_2',
  'ev_005_1', 'ev_005_2', 'ev_005_3',
  'ev_006_1', 'ev_006_2', 'ev_006_3', 'ev_006_4',
];

/** Devuelve el estado seed mutado por corridas anteriores a su origen. */
async function resetOperacion(prisma: PrismaClient, tid: string) {
  // La suite de plata aprueba apr_seed_1 → cnt_006 queda ACTIVO; acá lo necesitamos BORRADOR
  await prisma.contrato.update({
    where: { id: 'cnt_006' },
    data: { estado: 'BORRADOR', pendienteAprobacion: true, aprobadoAt: null },
  });
  // La suite de plata (P10) FINALIZA cnt_001 y el seed no lo revierte
  // (upsert update:{}): los tests de Mariela necesitan su contrato ACTIVO.
  await prisma.contrato.update({ where: { id: 'cnt_001' }, data: { estado: 'ACTIVO' } });
  await prisma.reclamoEvento.deleteMany({ where: { id: { notIn: SEED_EVENTOS } } });
  await prisma.reclamo.deleteMany({ where: { id: { notIn: SEED_RECLAMOS } } });
  await prisma.reclamo.update({
    where: { id: 'rec_001' },
    data: { estado: 'ABIERTO', resolucion: null, resueltoAt: null, profesionalId: null, asignadoA: null },
  });
  await prisma.reclamo.update({
    where: { id: 'rec_003' },
    data: { estado: 'ABIERTO', resolucion: null, resueltoAt: null, profesionalId: null },
  });
  await prisma.reclamo.update({
    where: { id: 'rec_004' },
    data: { estado: 'EN_CURSO', resolucion: null, resueltoAt: null, profesionalId: null },
  });
  await prisma.intencionRenovacion.upsert({
    where: { contratoId: 'cnt_001' },
    update: { decision: 'SIN_RESPUESTA', comentario: null, decididoAt: null },
    create: { inmobiliariaId: tid, contratoId: 'cnt_001', decision: 'SIN_RESPUESTA', comentario: null, decididoAt: null },
  });
}

beforeAll(async () => {
  const prisma = new PrismaClient();
  const { inmobiliariaId } = await seedBase(prisma);
  await seedOperacion(prisma, inmobiliariaId);
  await resetOperacion(prisma, inmobiliariaId);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const admin = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tokenAdmin = admin.json().token;
  const carga = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'camila@delsol.com', password: 'delsol123' } });
  tokenCarga = carga.json().token;
  const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
  tokenInquilino = demo.json().token;
});

afterAll(async () => {
  await app.close();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('Reclamos del panel + SLA', () => {
  it('sin token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/reclamos' });
    expect(res.statusCode).toBe(401);
  });

  it('rol CARGA no ve reclamos → 403', async () => {
    const res = await app.inject({ method: 'GET', url: '/reclamos', headers: auth(tokenCarga) });
    expect(res.statusCode).toBe(403);
  });

  it('lista los 6 seeds con propiedad/inquilino/profesional + SLA calculado', async () => {
    const res = await app.inject({ method: 'GET', url: '/reclamos', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const lista = res.json();
    expect(lista.length).toBeGreaterThanOrEqual(6);
    for (const id of SEED_RECLAMOS) {
      expect(lista.some((r: { id: string }) => r.id === id)).toBe(true);
    }
    const rec1 = lista.find((r: { id: string }) => r.id === 'rec_001');
    expect(rec1.propiedad.direccion).toBe('Gorriti 4521, 3°B');
    expect(rec1.contrato.inquilinoTitular.nombre).toBe('Mariela');
    expect(rec1.slaEstado).toBeDefined();
    expect(rec1.slaVencimiento).toBeDefined();
  });

  it('Carlos Romero (EMERGENCIA Electricidad) sale con SLA VENCIDO a las 6h', async () => {
    const res = await app.inject({ method: 'GET', url: '/reclamos', headers: auth(tokenAdmin) });
    const rec3 = res.json().find((r: { id: string }) => r.id === 'rec_003');
    expect(rec3.urgencia).toBe('EMERGENCIA');
    expect(rec3.categoria).toBe('ELECTRICIDAD');
    expect(rec3.slaEstado).toBe('VENCIDO');
    // 2026-05-09T18:42-03:00 + 6h
    expect(rec3.slaVencimiento).toBe('2026-05-10T03:42:00.000Z');
    expect(rec3.slaHorasRestantes).toBeLessThan(0);
  });

  it('un reclamo RESUELTO sale con slaEstado RESUELTO (no alerta)', async () => {
    const res = await app.inject({ method: 'GET', url: '/reclamos', headers: auth(tokenAdmin) });
    const rec5 = res.json().find((r: { id: string }) => r.id === 'rec_005');
    expect(rec5.slaEstado).toBe('RESUELTO');
    expect(rec5.slaAlertar).toBe(false);
  });

  it('detalle trae el timeline ordenado (rec_002 con 5 eventos)', async () => {
    const res = await app.inject({ method: 'GET', url: '/reclamos/rec_002', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.eventos).toHaveLength(5);
    expect(r.eventos[0].tipo).toBe('CREADO');
    expect(r.eventos[4].tipo).toBe('EN_CURSO');
  });

  it('detalle de reclamo inexistente → 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/reclamos/rec_999', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(404);
  });
});

describe('Asignar profesional', () => {
  it('profesional inexistente → 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reclamos/rec_003/asignar',
      headers: auth(tokenAdmin),
      payload: { profesionalId: 'prof_999' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('asigna a Diego Ferrari (electricista) y deja evento PROFESIONAL_ASIGNADO', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reclamos/rec_003/asignar',
      headers: auth(tokenAdmin),
      payload: { profesionalId: 'prof_002' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profesionalId).toBe('prof_002');

    const detalle = await app.inject({ method: 'GET', url: '/reclamos/rec_003', headers: auth(tokenAdmin) });
    const r = detalle.json();
    expect(r.profesional.nombre).toBe('Diego Ferrari');
    const ev = r.eventos.find((e: { tipo: string }) => e.tipo === 'PROFESIONAL_ASIGNADO');
    expect(ev.contenido).toContain('Diego Ferrari');
  });

  it('rol CARGA no puede asignar → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reclamos/rec_001/asignar',
      headers: auth(tokenCarga),
      payload: { profesionalId: 'prof_001' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('Resolver / rechazar / responder', () => {
  it('resolver con resolución corta → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reclamos/rec_001/resolver',
      headers: auth(tokenAdmin),
      payload: { resolucion: 'ok' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('resolver ok → RESUELTO + resueltoAt + evento + SLA pasa a RESUELTO', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reclamos/rec_001/resolver',
      headers: auth(tokenAdmin),
      payload: { resolucion: 'Se cambió el cuerito de la canilla. Sin goteo.' },
    });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.estado).toBe('RESUELTO');
    expect(r.resueltoAt).not.toBeNull();
    expect(r.slaEstado).toBe('RESUELTO');

    const detalle = await app.inject({ method: 'GET', url: '/reclamos/rec_001', headers: auth(tokenAdmin) });
    const ev = detalle.json().eventos.find((e: { tipo: string }) => e.tipo === 'RESUELTO');
    expect(ev.contenido).toContain('cuerito');
  });

  it('resolver un reclamo ya decidido → 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reclamos/rec_001/resolver',
      headers: auth(tokenAdmin),
      payload: { resolucion: 'Otra resolución cualquiera' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rechazar sin motivo → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reclamos/rec_004/rechazar',
      headers: auth(tokenAdmin),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('rechazar con motivo → RECHAZADO + evento', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reclamos/rec_004/rechazar',
      headers: auth(tokenAdmin),
      payload: { motivo: 'Es mantenimiento menor a cargo del inquilino (uso y goce).' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('RECHAZADO');

    const detalle = await app.inject({ method: 'GET', url: '/reclamos/rec_004', headers: auth(tokenAdmin) });
    const ev = detalle.json().eventos.find((e: { tipo: string }) => e.tipo === 'RECHAZADO');
    expect(ev).toBeDefined();
  });

  it('responder agrega MENSAJE_INMO al timeline', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reclamos/rec_002/responder',
      headers: auth(tokenAdmin),
      payload: { mensaje: 'Laura, mañana 10hs pasa el gasista con la termocupla nueva.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tipo).toBe('MENSAJE_INMO');
    expect(res.json().autor).toBe('Roberto Tapia');
  });
});

describe('Reclamos del inquilino (Mariela, cnt_001)', () => {
  it('GET /mis-reclamos lista los de su contrato con timeline y SLA', async () => {
    const res = await app.inject({ method: 'GET', url: '/mis-reclamos', headers: auth(tokenInquilino) });
    expect(res.statusCode).toBe(200);
    const lista = res.json();
    const ids = lista.map((r: { id: string }) => r.id);
    expect(ids).toContain('rec_001');
    expect(ids).toContain('rec_006');
    expect(ids).not.toContain('rec_003'); // de Carlos, otro contrato
    expect(lista[0].slaEstado).toBeDefined();
    expect(lista[0].eventos.length).toBeGreaterThan(0);
  });

  it('el panel no puede usar /mis-reclamos → 403', async () => {
    const res = await app.inject({ method: 'GET', url: '/mis-reclamos', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(403);
  });

  it('POST con datos incompletos → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mis-reclamos',
      headers: auth(tokenInquilino),
      payload: { titulo: 'Humedad' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('crea el reclamo ABIERTO sobre su contrato + evento CREADO', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mis-reclamos',
      headers: auth(tokenInquilino),
      payload: {
        titulo: 'Humedad en dormitorio',
        descripcion: 'Apareció una mancha de humedad en la pared del dormitorio.',
        categoria: 'OTRO',
        urgencia: 'MEDIA',
      },
    });
    expect(res.statusCode).toBe(201);
    const r = res.json();
    expect(r.estado).toBe('ABIERTO');
    expect(r.contratoId).toBe('cnt_001');
    expect(r.propiedadId).toBe('prp_001');
    expect(r.descripcion).toContain('Humedad en dormitorio');
    expect(r.slaEstado).toBe('EN_TIEMPO');

    const mios = await app.inject({ method: 'GET', url: '/mis-reclamos', headers: auth(tokenInquilino) });
    const nuevo = mios.json().find((x: { id: string }) => x.id === r.id);
    expect(nuevo.eventos[0].tipo).toBe('CREADO');
    expect(nuevo.eventos[0].autor).toContain('Mariela');
  });
});

describe('Profesionales', () => {
  it('lista la red completa (7 seeds) para el ADMIN', async () => {
    const res = await app.inject({ method: 'GET', url: '/profesionales', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const lista = res.json();
    expect(lista.length).toBeGreaterThanOrEqual(7);
    expect(lista.some((p: { nombre: string }) => p.nombre === 'Diego Ferrari')).toBe(true);
    expect(lista.some((p: { nombre: string }) => p.nombre === 'Sergio Almeida')).toBe(true);
  });

  it('filtra por categoría', async () => {
    const res = await app.inject({ method: 'GET', url: '/profesionales?categoria=ELECTRICISTA', headers: auth(tokenAdmin) });
    const lista = res.json();
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe('prof_002');
  });

  it('rol CARGA no ve profesionales → 403', async () => {
    const res = await app.inject({ method: 'GET', url: '/profesionales', headers: auth(tokenCarga) });
    expect(res.statusCode).toBe(403);
  });
});

describe('Consorcios', () => {
  it('lista cnsr_001 y cnsr_002 con sus unidades', async () => {
    const res = await app.inject({ method: 'GET', url: '/consorcios', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const lista = res.json();
    const gorriti = lista.find((c: { id: string }) => c.id === 'cnsr_001');
    expect(gorriti.nombre).toBe('Consorcio Gorriti 4521');
    expect(gorriti.unidades).toHaveLength(12);
    expect(gorriti.cantUf).toBe(12);
    const cabildo = lista.find((c: { id: string }) => c.id === 'cnsr_002');
    expect(cabildo.unidades).toHaveLength(4);
  });

  it('detalle trae unidades + movimientos + asambleas', async () => {
    const res = await app.inject({ method: 'GET', url: '/consorcios/cnsr_001', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const c = res.json();
    expect(c.unidades).toHaveLength(12);
    expect(c.movimientos).toHaveLength(7);
    expect(c.asambleas).toHaveLength(2);
    const uf2 = c.unidades.find((u: { id: string }) => u.id === 'uf_002');
    expect(Number(uf2.cargoFijo)).toBe(185000);
    const uf4 = c.unidades.find((u: { id: string }) => u.id === 'uf_004');
    expect(uf4.estado).toBe('VENCIDO');
    expect(Number(uf4.saldoDeudor)).toBe(540000);
  });

  it('consorcio inexistente → 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/consorcios/cnsr_999', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(404);
  });
});

describe('Renovaciones', () => {
  it('panel: contratos ACTIVOS con fechaFin + intención si hay', async () => {
    const res = await app.inject({ method: 'GET', url: '/renovaciones', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const lista = res.json();
    // Solo ACTIVOS: cnt_006/cnt_008 (BORRADOR) no aparecen
    expect(lista.some((c: { id: string }) => c.id === 'cnt_006')).toBe(false);
    const c2 = lista.find((c: { id: string }) => c.id === 'cnt_002');
    expect(c2.intencionRenovacion.decision).toBe('RENOVAR');
    const c4 = lista.find((c: { id: string }) => c.id === 'cnt_004');
    expect(c4.intencionRenovacion.decision).toBe('NO_RENOVAR');
    expect(c4.fechaFin).toBeDefined();
    expect(typeof c4.diasParaVencimiento).toBe('number');
    // Laura (cnt_003, vence 2026-10-31) está pensándolo
    const c3 = lista.find((c: { id: string }) => c.id === 'cnt_003');
    expect(c3.intencionRenovacion.decision).toBe('PENSANDO');
  });

  it('decisión sin PIN → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/renovaciones/cnt_001/decision',
      headers: auth(tokenAdmin),
      payload: { decision: 'RENOVAR' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('decisión con PIN incorrecto → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/renovaciones/cnt_001/decision',
      headers: auth(tokenAdmin),
      payload: { decision: 'RENOVAR', pin: '9999' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rol CARGA no decide renovaciones → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/renovaciones/cnt_001/decision',
      headers: auth(tokenCarga),
      payload: { decision: 'RENOVAR', pin: '1234' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('decisión inválida → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/renovaciones/cnt_001/decision',
      headers: auth(tokenAdmin),
      payload: { decision: 'QUIZAS', pin: '1234' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('registra la decisión de Mariela (cnt_001) con PIN ok', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/renovaciones/cnt_001/decision',
      headers: auth(tokenAdmin),
      payload: { decision: 'RENOVAR', notas: 'Confirmó por teléfono que renueva.', pin: '1234' },
    });
    expect(res.statusCode).toBe(200);
    const i = res.json();
    expect(i.decision).toBe('RENOVAR');
    expect(i.comentario).toContain('teléfono');
    expect(i.decididoAt).not.toBeNull();

    const panel = await app.inject({ method: 'GET', url: '/renovaciones', headers: auth(tokenAdmin) });
    const c1 = panel.json().find((c: { id: string }) => c.id === 'cnt_001');
    expect(c1.intencionRenovacion.decision).toBe('RENOVAR');
  });

  it('contrato inexistente → 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/renovaciones/cnt_999/decision',
      headers: auth(tokenAdmin),
      payload: { decision: 'RENOVAR', pin: '1234' },
    });
    expect(res.statusCode).toBe(404);
  });
});
