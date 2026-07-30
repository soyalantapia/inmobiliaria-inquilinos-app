import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ NODE_ENV: 'test' });
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('responde ok con la DB arriba', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe('up');
  });

  // Sin esto no había forma de saber QUÉ está corriendo en prod: no hay tags ni releases,
  // así que después de un `railway up` no se podía verificar que el deploy entró.
  it('expone la versión que está corriendo (o "desconocido", nunca un valor inventado)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json();
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
  });

  it('cae al id de deploy cuando no hay SHA (railway up desde un worktree)', async () => {
    const sha = process.env.RAILWAY_GIT_COMMIT_SHA;
    const dep = process.env.RAILWAY_DEPLOYMENT_ID;
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    process.env.RAILWAY_DEPLOYMENT_ID = '62a15171-c585-46a3';
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.json().version).toBe('deploy:62a15171');
    } finally {
      if (sha !== undefined) process.env.RAILWAY_GIT_COMMIT_SHA = sha;
      if (dep === undefined) delete process.env.RAILWAY_DEPLOYMENT_ID;
      else process.env.RAILWAY_DEPLOYMENT_ID = dep;
    }
  });

  it('toma el commit real cuando Railway lo inyecta', async () => {
    const previo = process.env.RAILWAY_GIT_COMMIT_SHA;
    process.env.RAILWAY_GIT_COMMIT_SHA = 'abcdef1234567890';
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.json().version).toBe('abcdef1');
    } finally {
      if (previo === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
      else process.env.RAILWAY_GIT_COMMIT_SHA = previo;
    }
  });
});
