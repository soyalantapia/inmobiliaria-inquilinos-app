import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { seedAnuncios } from '../prisma/seeds/anuncios.js';

let app: FastifyInstance;
let tokenAdmin: string;
let tokenCarga: string;
let tokenMariela: string;

const SEED_IDS = ['anu_seed_1', 'anu_seed_2', 'anu_seed_3'];

/** Devuelve el estado seed mutado por corridas anteriores a su origen. */
async function resetAnuncios(prisma: PrismaClient) {
  // Anuncios creados por tests previos (y sus acuses)
  await prisma.anuncioAcuse.deleteMany({ where: { anuncioId: { notIn: SEED_IDS } } });
  await prisma.anuncio.deleteMany({ where: { id: { notIn: SEED_IDS } } });
  // Acuses que Mariela dejó sobre los seeds en corridas previas (su flujo
  // leído→enterado tiene que arrancar virgen)
  const mariela = await prisma.inquilino.findFirst({ where: { email: 'mariela.sosa@gmail.com' } });
  if (mariela) {
    await prisma.anuncioAcuse.deleteMany({ where: { inquilinoId: mariela.id, anuncioId: { in: SEED_IDS } } });
  }
}

beforeAll(async () => {
  const prisma = new PrismaClient();
  const { inmobiliariaId } = await seedBase(prisma);
  await seedAnuncios(prisma, inmobiliariaId);
  await resetAnuncios(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
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

type AnuncioPanel = {
  id: string;
  titulo: string;
  audiencia: string;
  canales: string[];
  destinatariosCount: number;
  conteos: { leido: number; confirmado: number; total: number };
};
type AnuncioInquilino = {
  id: string;
  acuse: { leidoAt: string | null; confirmadoAt: string | null } | null;
};

const buscar = (lista: AnuncioPanel[], id: string) => lista.find((a) => a.id === id);

describe('Permisos', () => {
  it('GET /anuncios sin token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/anuncios' });
    expect(res.statusCode).toBe(401);
  });

  it('rol CARGA puede VER (contratos.ver) pero no ENVIAR (comunicaciones.enviar)', async () => {
    const ver = await app.inject({ method: 'GET', url: '/anuncios', headers: auth(tokenCarga) });
    expect(ver.statusCode).toBe(200);
    const enviar = await app.inject({
      method: 'POST',
      url: '/anuncios',
      headers: auth(tokenCarga),
      payload: { titulo: 'No debería', cuerpo: 'pasar nunca', audiencia: 'TODOS_INQUILINOS' },
    });
    expect(enviar.statusCode).toBe(403);
  });

  it('un inquilino no puede crear anuncios → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/anuncios',
      headers: auth(tokenMariela),
      payload: { titulo: 'Hackeo', cuerpo: 'desde la app del inquilino', audiencia: 'TODOS_INQUILINOS' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('un usuario del panel no puede acusar recibo → 403', async () => {
    const res = await app.inject({ method: 'POST', url: '/anuncios/anu_seed_2/leido', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(403);
  });
});

describe('Seeds con acuses reales (reemplazan la simulación del mock)', () => {
  it('los 3 seeds están con conteos que salen de AnuncioAcuse, no de un hash', async () => {
    const res = await app.inject({ method: 'GET', url: '/anuncios', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const lista: AnuncioPanel[] = res.json();

    const s1 = buscar(lista, 'anu_seed_1');
    expect(s1?.conteos).toEqual({ leido: 0, confirmado: 0, total: 12 });

    const s2 = buscar(lista, 'anu_seed_2');
    expect(s2?.conteos).toEqual({ leido: 4, confirmado: 2, total: 6 });

    const s3 = buscar(lista, 'anu_seed_3');
    expect(s3?.conteos).toEqual({ leido: 2, confirmado: 1, total: 6 });
  });

  it('vienen ordenados del más nuevo al más viejo', async () => {
    const res = await app.inject({ method: 'GET', url: '/anuncios', headers: auth(tokenAdmin) });
    const ids = (res.json() as AnuncioPanel[]).map((a) => a.id).filter((id) => SEED_IDS.includes(id));
    expect(ids).toEqual(['anu_seed_1', 'anu_seed_2', 'anu_seed_3']);
  });
});

describe('Mis anuncios — Mariela (cnt_001, consorcio Gorriti)', () => {
  it('ve el del consorcio y los de todos, sin acuse todavía', async () => {
    const res = await app.inject({ method: 'GET', url: '/mis-anuncios', headers: auth(tokenMariela) });
    expect(res.statusCode).toBe(200);
    const lista: AnuncioInquilino[] = res.json();
    const ids = lista.map((a) => a.id);
    expect(ids).toContain('anu_seed_1'); // INQUILINOS_CONSORCIO cnsr_001 (vive en Gorriti 4521)
    expect(ids).toContain('anu_seed_2'); // TODOS_INQUILINOS
    expect(ids).toContain('anu_seed_3');
    for (const sid of SEED_IDS) {
      expect(lista.find((a) => a.id === sid)?.acuse ?? null).toBeNull();
    }
  });

  it('marcar leído setea leidoAt sin confirmar, y NO pisa el leidoAt previo', async () => {
    const res = await app.inject({ method: 'POST', url: '/anuncios/anu_seed_2/leido', headers: auth(tokenMariela) });
    expect(res.statusCode).toBe(200);
    const primero = res.json();
    expect(primero.leidoAt).toBeTruthy();
    expect(primero.confirmadoAt).toBeNull();

    const otraVez = await app.inject({ method: 'POST', url: '/anuncios/anu_seed_2/leido', headers: auth(tokenMariela) });
    expect(otraVez.json().leidoAt).toBe(primero.leidoAt);
  });

  it('"Enterado" confirma e implica leído si faltaba', async () => {
    const res = await app.inject({ method: 'POST', url: '/anuncios/anu_seed_1/enterado', headers: auth(tokenMariela) });
    expect(res.statusCode).toBe(200);
    expect(res.json().leidoAt).toBeTruthy();
    expect(res.json().confirmadoAt).toBeTruthy();
  });

  it('los acuses de Mariela SUBEN los conteos del panel en serio', async () => {
    const res = await app.inject({ method: 'GET', url: '/anuncios', headers: auth(tokenAdmin) });
    const lista: AnuncioPanel[] = res.json();
    expect(buscar(lista, 'anu_seed_2')?.conteos).toEqual({ leido: 5, confirmado: 2, total: 6 });
    expect(buscar(lista, 'anu_seed_1')?.conteos).toEqual({ leido: 1, confirmado: 1, total: 12 });
  });
});

describe('EL LOOP ESTRELLA: panel envía → inquilino acusa → panel ve el acuse real', () => {
  let anuncioId: string;
  let total: number;

  it('el panel crea un anuncio a TODOS_INQUILINOS con audiencia resuelta server-side', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/anuncios',
      headers: auth(tokenAdmin),
      payload: {
        titulo: 'Pintura del hall de entrada',
        cuerpo: 'La semana que viene pintamos los halls de todos los edificios. Disculpá las molestias.',
        prioridad: 'NORMAL',
        audiencia: 'TODOS_INQUILINOS',
      },
    });
    expect(res.statusCode).toBe(201);
    const a = res.json();
    anuncioId = a.id;
    total = a.destinatariosCount;
    // inquilinos con contrato ACTIVO del seed: Mariela, Juan, Laura, Carlos, Ana
    expect(total).toBeGreaterThanOrEqual(5);
    expect(a.canales).toEqual(['APP', 'EMAIL']); // siempre, decida lo que decida el front
    expect(a.enviadoPor).toBe('Roberto Tapia');
  });

  it('GET /anuncios lo muestra leído 0 de N', async () => {
    const res = await app.inject({ method: 'GET', url: '/anuncios', headers: auth(tokenAdmin) });
    const a = buscar(res.json(), anuncioId);
    expect(a?.conteos).toEqual({ leido: 0, confirmado: 0, total });
  });

  it('Mariela lo ve en /mis-anuncios sin acuse', async () => {
    const res = await app.inject({ method: 'GET', url: '/mis-anuncios', headers: auth(tokenMariela) });
    const a = (res.json() as AnuncioInquilino[]).find((x) => x.id === anuncioId);
    expect(a).toBeTruthy();
    expect(a?.acuse ?? null).toBeNull();
  });

  it('Mariela toca "Enterado" → el panel pasa a leído 1 y confirmado 1 (acuse REAL, no simulado)', async () => {
    const ack = await app.inject({ method: 'POST', url: `/anuncios/${anuncioId}/enterado`, headers: auth(tokenMariela) });
    expect(ack.statusCode).toBe(200);

    const res = await app.inject({ method: 'GET', url: '/anuncios', headers: auth(tokenAdmin) });
    const a = buscar(res.json(), anuncioId);
    expect(a?.conteos).toEqual({ leido: 1, confirmado: 1, total });
  });

  it('eliminar el anuncio lo saca del panel (y borra sus acuses)', async () => {
    const del = await app.inject({ method: 'DELETE', url: `/anuncios/${anuncioId}`, headers: auth(tokenAdmin) });
    expect(del.statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: '/anuncios', headers: auth(tokenAdmin) });
    expect(buscar(res.json(), anuncioId)).toBeUndefined();
    const mios = await app.inject({ method: 'GET', url: '/mis-anuncios', headers: auth(tokenMariela) });
    expect((mios.json() as AnuncioInquilino[]).find((x) => x.id === anuncioId)).toBeUndefined();
  });
});

describe('Resolución de audiencias server-side', () => {
  it('INQUILINOS_CONSORCIO sin audienciaIds → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/anuncios',
      headers: auth(tokenAdmin),
      payload: { titulo: 'Asamblea', cuerpo: 'Asamblea del consorcio el jueves', audiencia: 'INQUILINOS_CONSORCIO' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('INQUILINOS_CONSORCIO cnsr_001 alcanza solo a Mariela (FK prp_001→cnsr_001)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/anuncios',
      headers: auth(tokenAdmin),
      payload: {
        titulo: 'Fumigación Gorriti 4521',
        cuerpo: 'El lunes fumigamos los palieres del edificio.',
        audiencia: 'INQUILINOS_CONSORCIO',
        audienciaIds: ['cnsr_001'],
      },
    });
    expect(res.statusCode).toBe(201);
    const a = res.json();
    expect(a.destinatariosCount).toBe(1);

    const mios = await app.inject({ method: 'GET', url: '/mis-anuncios', headers: auth(tokenMariela) });
    expect((mios.json() as AnuncioInquilino[]).find((x) => x.id === a.id)).toBeTruthy();
  });

  it('CONTRATOS_ESPECIFICOS a cnt_002 NO le llega a Mariela (cnt_001), y acusar da 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/anuncios',
      headers: auth(tokenAdmin),
      payload: {
        titulo: 'Cambio de cerradura Cabildo',
        cuerpo: 'Coordinamos con el cerrajero para el martes a la mañana.',
        audiencia: 'CONTRATOS_ESPECIFICOS',
        audienciaIds: ['cnt_002'],
      },
    });
    expect(res.statusCode).toBe(201);
    const a = res.json();
    expect(a.destinatariosCount).toBe(1);

    const mios = await app.inject({ method: 'GET', url: '/mis-anuncios', headers: auth(tokenMariela) });
    expect((mios.json() as AnuncioInquilino[]).find((x) => x.id === a.id)).toBeUndefined();

    const ack = await app.inject({ method: 'POST', url: `/anuncios/${a.id}/enterado`, headers: auth(tokenMariela) });
    expect(ack.statusCode).toBe(403);
  });

  it('TODOS_PROPIETARIOS cuenta destinatarios pero no genera bandeja de inquilinos', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/anuncios',
      headers: auth(tokenAdmin),
      payload: {
        titulo: 'Rendiciones de junio',
        cuerpo: 'Las rendiciones de junio salen el día 10 como siempre.',
        audiencia: 'TODOS_PROPIETARIOS',
      },
    });
    expect(res.statusCode).toBe(201);
    const a = res.json();
    expect(a.destinatariosCount).toBeGreaterThanOrEqual(5); // own_001..own_005 del seed

    const mios = await app.inject({ method: 'GET', url: '/mis-anuncios', headers: auth(tokenMariela) });
    expect((mios.json() as AnuncioInquilino[]).find((x) => x.id === a.id)).toBeUndefined();
  });

  it('DELETE de un anuncio inexistente → 404 · DELETE como CARGA → 403', async () => {
    const noExiste = await app.inject({ method: 'DELETE', url: '/anuncios/anu_fantasma', headers: auth(tokenAdmin) });
    expect(noExiste.statusCode).toBe(404);
    const sinPermiso = await app.inject({ method: 'DELETE', url: '/anuncios/anu_seed_3', headers: auth(tokenCarga) });
    expect(sinPermiso.statusCode).toBe(403);
  });
});
