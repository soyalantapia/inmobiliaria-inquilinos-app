import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma); // idempotente
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
});

afterAll(async () => {
  await app.close();
});

describe('POST /auth/login', () => {
  it('login OK devuelve token + rol', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'roberto@delsol.com', password: 'delsol123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.rol).toBe('ADMIN');
    expect(body.nombre).toBe('Roberto Tapia');
  });

  it('password incorrecta → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'roberto@delsol.com', password: 'nope' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('OTP inquilino', () => {
  const EMAIL = 'mariela.sosa@gmail.com';

  /** Hace verify con el backdoor demo y devuelve el body { personaToken, alquileres }. */
  async function verifyDemo() {
    const ver = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { email: EMAIL, code: '000000' },
    });
    expect(ver.statusCode).toBe(200);
    return ver.json() as {
      personaToken: string;
      alquileres: Array<{ inquilinoId: string; nombre: string; inmobiliaria: string; direccion: string; ciudad: string }>;
    };
  }

  it('request + verify devuelve persona-token + lista de alquileres', async () => {
    const req = await app.inject({
      method: 'POST',
      url: '/auth/otp/request',
      payload: { email: EMAIL },
    });
    expect(req.statusCode).toBe(200);

    const body = await verifyDemo();
    expect(body.personaToken).toBeTruthy();
    expect(Array.isArray(body.alquileres)).toBe(true);
    expect(body.alquileres.length).toBeGreaterThanOrEqual(1);
    const alq = body.alquileres[0]!;
    expect(alq.inquilinoId).toBeTruthy();
    expect(alq.inmobiliaria).toBeTruthy();
  });

  it('elegir con el persona-token entra al contrato (token + datos reales)', async () => {
    const { personaToken, alquileres } = await verifyDemo();
    const eleg = await app.inject({
      method: 'POST',
      url: '/auth/inquilino/elegir',
      headers: { authorization: `Bearer ${personaToken}` },
      payload: { inquilinoId: alquileres[0]!.inquilinoId },
    });
    expect(eleg.statusCode).toBe(200);
    const b = eleg.json();
    expect(b.token).toBeTruthy();
    expect(b.nombre).toBe('Mariela');
    expect(b.contratoId).toBeTruthy();
    expect(b.inquilinoId).toBe(alquileres[0]!.inquilinoId);
  });

  it('elegir un inquilinoId ajeno al email → 404', async () => {
    const { personaToken } = await verifyDemo();
    const eleg = await app.inject({
      method: 'POST',
      url: '/auth/inquilino/elegir',
      headers: { authorization: `Bearer ${personaToken}` },
      payload: { inquilinoId: 'inq_inexistente_999' },
    });
    expect(eleg.statusCode).toBe(404);
  });

  it('GET /alquileres: persona-token lista; token de contrato → 403; sin token → 401', async () => {
    const { personaToken, alquileres } = await verifyDemo();

    // Con persona-token: lista OK.
    const lista = await app.inject({
      method: 'GET',
      url: '/auth/inquilino/alquileres',
      headers: { authorization: `Bearer ${personaToken}` },
    });
    expect(lista.statusCode).toBe(200);
    expect(Array.isArray(lista.json().alquileres)).toBe(true);

    // Con token de CONTRATO (no-persona): 403 (requirePersona lo rechaza).
    const eleg = await app.inject({
      method: 'POST',
      url: '/auth/inquilino/elegir',
      headers: { authorization: `Bearer ${personaToken}` },
      payload: { inquilinoId: alquileres[0]!.inquilinoId },
    });
    const contratoToken = eleg.json().token as string;
    const conContrato = await app.inject({
      method: 'GET',
      url: '/auth/inquilino/alquileres',
      headers: { authorization: `Bearer ${contratoToken}` },
    });
    expect(conContrato.statusCode).toBe(403);

    // Sin token: 401.
    const sin = await app.inject({ method: 'GET', url: '/auth/inquilino/alquileres' });
    expect(sin.statusCode).toBe(401);
  });

  it('persona-token NO sirve para endpoints normales (/auth/me → 401)', async () => {
    const { personaToken } = await verifyDemo();
    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${personaToken}` },
    });
    expect(me.statusCode).toBe(401);
  });

  it('código inválido → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { email: EMAIL, code: '999999' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Sesión + PIN', () => {
  async function loginRoberto(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'roberto@delsol.com', password: 'delsol123' },
    });
    return res.json().token as string;
  }

  it('/auth/me sin token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('/auth/me con token de usuario', async () => {
    const token = await loginRoberto();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ kind: 'usuario', rol: 'ADMIN' });
  });

  // El PIN se eliminó de la plataforma: verificarPinUsuario siempre aprueba, así
  // que /auth/pin/verify valida con CUALQUIER PIN (incluido uno "incorrecto").
  // Guardia de regresión para que no vuelva a bloquear.
  it('PIN eliminado: /auth/pin/verify aprueba cualquier PIN', async () => {
    const token = await loginRoberto();
    for (const pin of ['1234', '9999']) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/pin/verify',
        headers: { authorization: `Bearer ${token}` },
        payload: { pin },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().valid).toBe(true);
    }
  });

  it('demo devuelve sesión de Mariela', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/demo' });
    expect(res.statusCode).toBe(200);
    expect(res.json().nombre).toBe('Mariela Sosa');
  });
});
