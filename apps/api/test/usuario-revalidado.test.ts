import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * CAZABUG P0 — dar de baja a un empleado no le sacaba el acceso.
 *
 * `requireUsuario` resolvía los permisos leyendo el rol que viene DENTRO del JWT
 * y nunca consultaba la tabla `usuarios`. `activo` se miraba sólo en el login, y
 * el token dura 15 días (TOKEN_TTL en auth.ts). Consecuencia real: la
 * inmobiliaria echa a alguien, el panel muestra "dado de baja"… y esa persona
 * sigue conciliando pagos, rindiendo a propietarios y resolviendo depósitos
 * desde su sesión abierta hasta que el token venza. Bajarle el rol de ADMIN a
 * LECTURA tampoco tenía efecto.
 *
 * Lo llamativo es que el principio ya estaba escrito en este mismo repo: el
 * guard del profesional externo comenta "revalidamos SIEMPRE contra la DB (no
 * sólo el JWT)" porque el token dura 15 días. Se aplicó a las identidades
 * periféricas (co-inquilino, profesional — ver acceso-revalidado.test.ts) y
 * quedó sin aplicar en la central, la del panel.
 */

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
let userId = '';
let rolOriginal: string;
const auth = () => ({ authorization: `Bearer ${token}` });

/** Ruta liviana que exige `contratos.ver` (la tienen los cuatro roles). */
const RUTA_CUALQUIER_ROL = '/contratos';
/** Ruta que exige `metricas.ver`, que es SÓLO de ADMIN. */
const RUTA_SOLO_ADMIN = '/metricas/resumen';

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  expect(login.statusCode).toBe(200);
  token = login.json().token;
  const u = await prisma.usuario.findFirstOrThrow({ where: { email: 'roberto@delsol.com' } });
  userId = u.id;
  rolOriginal = u.rol;
}, 420_000);

afterAll(async () => {
  // Dejar la cuenta como estaba: la DB de test es compartida entre sesiones.
  await prisma.usuario.updateMany({
    where: { id: userId },
    data: { activo: true, rol: rolOriginal as never },
  });
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('el token del panel se revalida contra la DB en cada request', () => {
  it('control: con la cuenta activa el token anda', async () => {
    const r = await app.inject({ method: 'GET', url: RUTA_CUALQUIER_ROL, headers: auth() });
    expect(r.statusCode).toBe(200);
  });

  it('dado de baja el usuario, el MISMO token deja de servir (401)', async () => {
    await prisma.usuario.update({ where: { id: userId }, data: { activo: false } });
    // Con el bug: 200 — el JWT seguía valiendo hasta 15 días después de la baja.
    const r = await app.inject({ method: 'GET', url: RUTA_CUALQUIER_ROL, headers: auth() });
    expect(r.statusCode).toBe(401);
  });

  it('reactivado, el mismo token vuelve a andar (la baja no lo quema para siempre)', async () => {
    await prisma.usuario.update({ where: { id: userId }, data: { activo: true } });
    const r = await app.inject({ method: 'GET', url: RUTA_CUALQUIER_ROL, headers: auth() });
    expect(r.statusCode).toBe(200);
  });

  it('control: como ADMIN entra a una ruta de ADMIN', async () => {
    const r = await app.inject({ method: 'GET', url: RUTA_SOLO_ADMIN, headers: auth() });
    expect(r.statusCode).toBe(200);
  });

  it('bajado a LECTURA, el token que dice ADMIN ya no abre la ruta de ADMIN (403)', async () => {
    await prisma.usuario.update({ where: { id: userId }, data: { rol: 'LECTURA' } });
    // Con el bug: 200 — mandaba el rol del token, no el de la tabla.
    const r = await app.inject({ method: 'GET', url: RUTA_SOLO_ADMIN, headers: auth() });
    expect(r.statusCode).toBe(403);
  });

  it('pero sigue pudiendo lo que SÍ le corresponde a su rol nuevo', async () => {
    const r = await app.inject({ method: 'GET', url: RUTA_CUALQUIER_ROL, headers: auth() });
    expect(r.statusCode).toBe(200);
  });

  it('restituido a ADMIN, recupera la ruta de ADMIN sin volver a loguearse', async () => {
    await prisma.usuario.update({ where: { id: userId }, data: { rol: rolOriginal as never } });
    const r = await app.inject({ method: 'GET', url: RUTA_SOLO_ADMIN, headers: auth() });
    expect(r.statusCode).toBe(200);
  });
});
