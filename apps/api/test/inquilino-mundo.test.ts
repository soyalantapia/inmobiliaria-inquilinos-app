import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { seedInquilinoMundo } from '../prisma/seeds/inquilinoMundo.js';

let app: FastifyInstance;
let tokenAdmin: string;
let tokenCarga: string;
let tokenMariela: string;

/** Devuelve el estado seed mutado por corridas anteriores a su origen. */
async function resetInquilinoMundo(prisma: PrismaClient, tid: string) {
  await prisma.coInquilino.deleteMany({ where: { inmobiliariaId: tid } });
  await prisma.boletaServicio.deleteMany({
    where: { inmobiliariaId: tid, id: { notIn: ['bol-seed-1', 'bol-seed-2', 'bol-seed-3'] } },
  });
  await prisma.reportePiloto.deleteMany({ where: { inmobiliariaId: tid } });
  await prisma.screening.deleteMany({ where: { inmobiliariaId: tid, id: { not: 'scr_001' } } });
  await prisma.certificadoInquilino.deleteMany({ where: { inmobiliariaId: tid } });
  // El certificado de Mariela se calcula de liq_001: devolverla a VENCIDA
  // por si otra corrida la pagó, y limpiar rechazos espurios.
  await prisma.liquidacion.update({
    where: { id: 'liq_001' },
    data: { estado: 'VENCIDO', fechaPago: null, metodoPago: null },
  });
  await prisma.pago.deleteMany({ where: { contratoId: 'cnt_001', estado: 'RECHAZADO' } });
}

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirst({ where: { nombre: 'Inmobiliaria del Sol' } });
  if (!inmo) throw new Error('seedBase no creó el tenant');
  await seedInquilinoMundo(prisma, inmo.id);
  await resetInquilinoMundo(prisma, inmo.id);
  await prisma.$disconnect();

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  // app.ts lo cablea el orquestador — acá registramos las rutas a mano.

  const admin = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tokenAdmin = admin.json().token;
  const carga = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'camila@delsol.com', password: 'delsol123' } });
  tokenCarga = carga.json().token;
  const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
  tokenMariela = demo.json().token;
});

afterAll(async () => {
  await app.close();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('Certificado del inquilino — calculado de liquidaciones reales', () => {
  it('Mariela (1 cuota VENCIDA, 0 pagadas) sale REGULAR — honesto, sin maquillar', async () => {
    const res = await app.inject({ method: 'GET', url: '/certificado', headers: auth(tokenMariela) });
    expect(res.statusCode).toBe(200);
    const cert = res.json();
    expect(cert.hash).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(cert.nivel).toBe('REGULAR');
    expect(cert.historial.cuotasTotales).toBe(1);
    expect(cert.historial.cuotasPagadas).toBe(0);
    expect(cert.historial.pagosRechazados).toBe(0);
    expect(cert.inquilino.nombre).toBe('Mariela Sosa');
    expect(cert.contratoActual.direccion).toBe('Gorriti 4521, 3°B');
    expect(cert.contratoActual.inmobiliaria).toBe('Inmobiliaria del Sol');
    expect(cert.urlVerificacion).toContain(cert.hash);
    expect(new Date(cert.validoHasta).getTime()).toBeGreaterThan(new Date(cert.generadoAt).getTime());
  });

  it('regenerar no duplica: mismo hash, se actualiza el registro persistido', async () => {
    const a = await app.inject({ method: 'GET', url: '/certificado', headers: auth(tokenMariela) });
    const b = await app.inject({ method: 'GET', url: '/certificado', headers: auth(tokenMariela) });
    expect(a.json().hash).toBe(b.json().hash);
    expect(a.json().id).toBe(b.json().id);
  });

  it('usuario del panel no tiene certificado → 403', async () => {
    const res = await app.inject({ method: 'GET', url: '/certificado', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(403);
  });
});

describe('Screening — informe simulado coherente con la identidad solicitada', () => {
  it('el informe lleva EXACTAMENTE el cuit y nombre pedidos (sin mezclar personas)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/screening',
      headers: auth(tokenAdmin),
      payload: { cuit: '27-28456789-3', nombre: 'Valeria Núñez' },
    });
    expect(res.statusCode).toBe(201);
    const s = res.json();
    expect(s.cuit).toBe('27-28456789-3');
    expect(s.nombre).toBe('Valeria');
    expect(s.apellido).toBe('Núñez');
    expect(s.dni).toBe('28.456.789'); // los 8 del medio del CUIT
    expect(s.sexo).toBe('F'); // prefijo 27
    expect(s.email).toContain('valeria');
    expect(s.estado).toBe('COMPLETO');
    expect(s.scoreNosis).toBeGreaterThanOrEqual(0);
    expect(s.scoreNosis).toBeLessThanOrEqual(1000);
    expect(['APTO', 'APTO_CON_GARANTIA', 'NO_APTO']).toContain(s.recomendacion);
    expect(s.recomendacionRazon).toContain(String(s.scoreNosis));
    // El grupo familiar es coherente con el apellido solicitado
    const familia = s.familia as Array<{ vinculo: string; nombreCompleto: string }>;
    expect(familia.some((f) => f.nombreCompleto.endsWith('Núñez'))).toBe(true);
  });

  it('mismo CUIT → mismo perfil (determinístico)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/screening',
      headers: auth(tokenAdmin),
      payload: { cuit: '27284567893', nombre: 'Valeria Núñez' }, // sin guiones, se normaliza
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().cuit).toBe('27-28456789-3');
    expect(res.json().scoreNosis).toBeDefined();
  });

  it('CUIT inválido → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/screening',
      headers: auth(tokenAdmin),
      payload: { cuit: '123', nombre: 'Valeria Núñez' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rol CARGA no ve screening → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/screening',
      headers: auth(tokenCarga),
      payload: { cuit: '20-31256789-0', nombre: 'Carlos Méndez' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /screenings lista los del tenant (incluye scr_001 del seed)', async () => {
    const res = await app.inject({ method: 'GET', url: '/screenings', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const lista = res.json();
    expect(lista.find((s: { id: string }) => s.id === 'scr_001').apellido).toBe('Méndez');
    expect(lista.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Co-inquilinos — invitación, permisos y aceptación demo', () => {
  let coId: string;

  it('invitar crea PENDIENTE con token de invitación', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/co-inquilinos',
      headers: auth(tokenMariela),
      payload: { nombre: 'Federico Sosa', dni: '35111222', email: 'fede.sosa@gmail.com', telefono: '+5491155667788', relacion: 'Hermano', permiso: 'VER' },
    });
    expect(res.statusCode).toBe(201);
    const co = res.json();
    expect(co.estado).toBe('PENDIENTE');
    expect(co.permiso).toBe('VER');
    expect(co.tokenInvitacion).toBeTruthy();
    expect(co.aceptadoAt).toBeNull();
    coId = co.id;
  });

  it('mismo email dos veces → 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/co-inquilinos',
      headers: auth(tokenMariela),
      payload: { nombre: 'Federico Sosa', email: 'fede.sosa@gmail.com', relacion: 'Hermano', permiso: 'VER' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('GET lista los del contrato del inquilino', async () => {
    const res = await app.inject({ method: 'GET', url: '/co-inquilinos', headers: auth(tokenMariela) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('cambiar permiso VER → PAGAR', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/co-inquilinos/${coId}/permiso`,
      headers: auth(tokenMariela),
      payload: { permiso: 'PAGAR' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().permiso).toBe('PAGAR');
  });

  it('permiso inválido → 400', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/co-inquilinos/${coId}/permiso`,
      headers: auth(tokenMariela),
      payload: { permiso: 'ROOT' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('aceptar (simulado por DEMO_MODE) → ACEPTADO con timestamp', async () => {
    const res = await app.inject({ method: 'POST', url: `/co-inquilinos/${coId}/aceptar`, headers: auth(tokenMariela) });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('ACEPTADO');
    expect(res.json().aceptadoAt).toBeTruthy();
  });

  it('aceptar dos veces → 409', async () => {
    const res = await app.inject({ method: 'POST', url: `/co-inquilinos/${coId}/aceptar`, headers: auth(tokenMariela) });
    expect(res.statusCode).toBe(409);
  });

  it('eliminar co-inquilino', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/co-inquilinos/${coId}`, headers: auth(tokenMariela) });
    expect(res.statusCode).toBe(200);
    const lista = await app.inject({ method: 'GET', url: '/co-inquilinos', headers: auth(tokenMariela) });
    expect(lista.json()).toHaveLength(0);
  });

  it('usuario del panel → 403', async () => {
    const res = await app.inject({ method: 'GET', url: '/co-inquilinos', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(403);
  });
});

describe('Boletas de servicios', () => {
  it('GET trae las del contrato ordenadas por período desc', async () => {
    const res = await app.inject({ method: 'GET', url: '/boletas', headers: auth(tokenMariela) });
    expect(res.statusCode).toBe(200);
    const boletas = res.json();
    expect(boletas).toHaveLength(3);
    expect(boletas[0].id).toBe('bol-seed-3'); // 2026-05
    expect(boletas[1].id).toBe('bol-seed-1'); // 2026-04, subida más tarde
  });

  it('subir LUZ sin monto → toma el consumo promedio del servicio de la propiedad', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/boletas',
      headers: auth(tokenMariela),
      payload: { servicio: 'LUZ', periodo: '2026-06' },
    });
    expect(res.statusCode).toBe(201);
    const b = res.json();
    expect(Number(b.monto)).toBe(28000); // ServicioPublico prp_001 LUZ
    expect(b.estado).toBe('SUBIDA');
    expect(b.vencimiento).toContain('2026-07-10'); // default: día 10 del mes siguiente
  });

  it('subir AGUA (sin promedio cargado) sin monto → 0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/boletas',
      headers: auth(tokenMariela),
      payload: { servicio: 'AGUA', periodo: '2026-06', vencimiento: '2026-06-25' },
    });
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().monto)).toBe(0);
  });

  it('período inválido → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/boletas',
      headers: auth(tokenMariela),
      payload: { servicio: 'GAS', periodo: 'junio' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /servicios muestra NIS y distribuidoras de la propiedad', async () => {
    const res = await app.inject({ method: 'GET', url: '/servicios', headers: auth(tokenMariela) });
    expect(res.statusCode).toBe(200);
    const servicios = res.json();
    expect(servicios).toHaveLength(4);
    expect(servicios.find((s: { tipo: string }) => s.tipo === 'LUZ').nis).toBe('7841029-3');
  });
});

describe('Reportes piloto — tracking server-side automático', () => {
  it('usuario del panel reporta un BUG: ip, userAgent, rol y navegador capturados solos', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reportes',
      headers: {
        ...auth(tokenAdmin),
        'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'x-session-id': 'sess-rt-001',
        'x-app-build': '2026.06.0',
      },
      payload: { tipo: 'BUG', titulo: 'La tabla de pagos no pagina', detalle: 'Con más de 50 filas se corta.', severidad: 'MOLESTO', url: '/pagos' },
    });
    expect(res.statusCode).toBe(201);
    const r = res.json();
    expect(r.ip).toBeTruthy(); // request.ip server-side
    expect(r.userAgent).toContain('Chrome/125');
    expect(r.navegador).toBe('Chrome');
    expect(r.rol).toBe('ADMIN');
    expect(r.pantalla).toBe('Pagos');
    expect(r.sessionId).toBe('sess-rt-001');
    expect(r.build).toBe('2026.06.0');
    expect(r.severidad).toBe('MOLESTO');
    expect(r.reportadoAt).toBeTruthy(); // timestamp del server
  });

  it('un inquilino también puede reportar (rol INQUILINO)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reportes',
      headers: auth(tokenMariela),
      payload: { tipo: 'IDEA', titulo: 'Quiero recordatorios de boletas por WhatsApp' },
    });
    expect(res.statusCode).toBe(201);
    const r = res.json();
    expect(r.rol).toBe('INQUILINO');
    expect(r.pantalla).toBe('Home'); // url default '/'
    expect(r.ip).toBeTruthy();
    expect(r.sessionId).toContain('inquilino:'); // autoría real preservada
  });

  it('GET /reportes (ADMIN) lista ambos y resuelve la autoría del inquilino', async () => {
    const res = await app.inject({ method: 'GET', url: '/reportes', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const lista = res.json();
    expect(lista.length).toBeGreaterThanOrEqual(2);
    const idea = lista.find((r: { tipo: string }) => r.tipo === 'IDEA');
    expect(idea.reportadoPor).toBe('Mariela Sosa (inquilino)');
    const bug = lista.find((r: { tipo: string }) => r.tipo === 'BUG');
    expect(bug.reportadoPor).toBe('Roberto Tapia');
  });

  it('rol CARGA (sin auditoria.ver, no ADMIN) → 403', async () => {
    const res = await app.inject({ method: 'GET', url: '/reportes', headers: auth(tokenCarga) });
    expect(res.statusCode).toBe(403);
  });

  it('sin auth → 401 · tipo inválido → 400', async () => {
    const anon = await app.inject({ method: 'POST', url: '/reportes', payload: { tipo: 'BUG', titulo: 'x'.repeat(10) } });
    expect(anon.statusCode).toBe(401);
    const malo = await app.inject({
      method: 'POST',
      url: '/reportes',
      headers: auth(tokenAdmin),
      payload: { tipo: 'QUEJA', titulo: 'No es BUG ni IDEA' },
    });
    expect(malo.statusCode).toBe(400);
  });
});
