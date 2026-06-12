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
  it('request + verify con backdoor demo 000000', async () => {
    const req = await app.inject({
      method: 'POST',
      url: '/auth/otp/request',
      payload: { email: 'mariela.sosa@gmail.com' },
    });
    expect(req.statusCode).toBe(200);

    const ver = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { email: 'mariela.sosa@gmail.com', code: '000000' },
    });
    expect(ver.statusCode).toBe(200);
    expect(ver.json().token).toBeTruthy();
    expect(ver.json().nombre).toBe('Mariela Sosa');
  });

  it('código inválido → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { email: 'mariela.sosa@gmail.com', code: '999999' },
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

  it('PIN correcto valida, PIN incorrecto 403', async () => {
    const token = await loginRoberto();
    const ok = await app.inject({
      method: 'POST',
      url: '/auth/pin/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: { pin: '1234' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().valid).toBe(true);

    const bad = await app.inject({
      method: 'POST',
      url: '/auth/pin/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: { pin: '9999' },
    });
    expect(bad.statusCode).toBe(403);
  });

  it('demo devuelve sesión de Mariela', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/demo' });
    expect(res.statusCode).toBe(200);
    expect(res.json().nombre).toBe('Mariela Sosa');
  });
});
