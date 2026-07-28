import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P1 — el OTP es de 6 dígitos y vive 10 minutos, pero /auth/*/otp/verify sólo
// estaba cubierto por el rate-limit GLOBAL (300/min por IP, pensado para tráfico normal):
// ~3.000 intentos por ventana desde una sola IP, y repitiendo ventanas la probabilidad
// acumulada sube rápido. Los comentarios del archivo daban por sentada una protección que
// YA NO EXISTE ("hereda el lockout de verificarPinUsuario" — el PIN se eliminó y esa
// función devuelve {ok:true}). Ahora hay un tope estricto por ruta.

let app: FastifyInstance;
let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
});

afterAll(async () => {
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — fuerza bruta contra el OTP del panel', () => {
  it('a los 20 intentos fallidos empieza a devolver 429 (antes: 3.000 por ventana)', async () => {
    const codigos = Array.from({ length: 26 }, (_, i) => String(100000 + i));
    let vio429 = false;
    let ultimo = 0;
    for (const code of codigos) {
      const r = await app.inject({
        method: 'POST',
        url: '/auth/usuario/otp/verify',
        payload: { email: 'roberto@delsol.com', code },
      });
      ultimo = r.statusCode;
      if (r.statusCode === 429) { vio429 = true; break; }
    }
    expect(vio429).toBe(true); // con el bug: nunca corta, siempre 401
    expect(ultimo).toBe(429);
  });

  it('el tope deja aire para una oficina: 20 logins seguidos no se cortan', async () => {
    // Instancia nueva = contador limpio (el store del rate-limit es por instancia).
    const app2 = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
    try {
      const codigos: number[] = [];
      for (let i = 0; i < 20; i++) {
        const r = await app2.inject({
          method: 'POST', url: '/auth/login',
          payload: { email: 'roberto@delsol.com', password: 'delsol123' },
        });
        codigos.push(r.statusCode);
      }
      expect(codigos.every((c) => c === 200)).toBe(true);
    } finally {
      await app2.close();
    }
  });
});
