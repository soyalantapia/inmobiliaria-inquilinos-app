import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P3 — dos agujeros de la misma familia:
//
// 1) /uploads usaba un guard propio que sólo validaba la FORMA del JWT, sin revalidar
//    contra la DB. El guard canónico (requireContratoAcceso) sí lo hace y explica por qué:
//    "el token dura 15 días, así que NO confiamos en el estado del JWT". /uploads era la
//    excepción: un co-inquilino revocado y un profesional cuya visita ya se cerró seguían
//    subiendo archivos al Volume del tenant hasta que venciera su token.
//
// 2) /contratos/:id/reenviar-bienvenida pedía `contratos.crear` (que incluye a CARGA) para
//    mandarle un mail AL INQUILINO. Cargar contratos para aprobación no es comunicarse con
//    el cliente: va con `comunicaciones.enviar`, igual que los anuncios.

let app: FastifyInstance;
let prisma: PrismaClient;
let tCARGA = '';
let tOPERADOR = '';
let sesionProf = '';
let reclamoId = '';
const TOKEN = 'ZZ-cazabug-revalida';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function login(email: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'delsol123' } });
  return r.json().token as string;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  const prof = await prisma.profesional.findFirstOrThrow({ where: { inmobiliariaId: inmo.id } });
  const rec = await prisma.reclamo.create({
    data: {
      inmobiliariaId: inmo.id, contratoId: 'cnt_001', propiedadId: 'prp_001',
      categoria: 'PLOMERIA', urgencia: 'MEDIA', descripcion: 'Revalidación (cazabug)',
      estado: 'EN_CURSO',
    },
  });
  reclamoId = rec.id;
  await prisma.visitaProfesional.create({
    data: { inmobiliariaId: inmo.id, reclamoId: rec.id, profesionalId: prof.id, token: TOKEN, estado: 'EN_CAMINO', enCaminoAt: new Date() },
  });

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tCARGA = await login('camila@delsol.com');
  tOPERADOR = await login('luciana@delsol.com');
  const r = await app.inject({ method: 'GET', url: `/visitas-publicas/${TOKEN}` });
  sesionProf = r.json().sesion;
});

afterAll(async () => {
  if (reclamoId) {
    await prisma.visitaProfesional.deleteMany({ where: { reclamoId } });
    await prisma.reclamoEvento.deleteMany({ where: { reclamoId } });
    await prisma.reclamo.deleteMany({ where: { id: reclamoId } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — el acceso se revalida contra la DB, no se confía en el JWT', () => {
  it('el profesional con visita ABIERTA pasa el guard de /uploads', async () => {
    // Sin archivo da 400 (falta el multipart), pero NO 401: pasó la autenticación.
    const r = await app.inject({ method: 'POST', url: '/uploads', headers: auth(sesionProf) });
    expect(r.statusCode).not.toBe(401);
  });

  it('cerrada la visita, el MISMO token ya no sirve para subir archivos', async () => {
    await prisma.visitaProfesional.updateMany({ where: { token: TOKEN }, data: { estado: 'LISTO', listoAt: new Date() } });
    const r = await app.inject({ method: 'POST', url: '/uploads', headers: auth(sesionProf) });
    expect(r.statusCode).toBe(401); // con el bug: seguía subiendo hasta que venciera el JWT
  });
});

describe('CAZABUG — mandar mail al inquilino pide comunicaciones.enviar', () => {
  it('un CARGA no puede reenviar la bienvenida (403)', async () => {
    const r = await app.inject({ method: 'POST', url: '/contratos/cnt_001/reenviar-bienvenida', headers: auth(tCARGA) });
    expect(r.statusCode).toBe(403); // antes: entraba con contratos.crear
  });

  it('un OPERADOR sí puede (no rompimos el caso real)', async () => {
    const r = await app.inject({ method: 'POST', url: '/contratos/cnt_001/reenviar-bienvenida', headers: auth(tOPERADOR) });
    expect(r.statusCode).not.toBe(403);
  });
});
