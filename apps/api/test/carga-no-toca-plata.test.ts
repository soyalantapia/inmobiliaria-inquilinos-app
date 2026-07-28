import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P1 — la capacidad `contratos.crear` incluye al rol CARGA porque ese rol carga
// contratos PARA APROBACIÓN (nacen BORRADOR). Pero esa misma capacidad gateaba tres
// mutaciones POST-alta que mueven plata de verdad, y sólo finalizar/ajustar/renovar tenían
// el guard explícito de rol. Un CARGA podía:
//   · PATCH /monto          → dejar el alquiler (y la comisión, que sale de ahí) en $1
//   · PATCH /modo-cobranza  → cambiar a qué CBU transfiere el inquilino
//   · PUT   /mora           → borrarle los punitorios a un moroso
// El PIN no lo frenaba: verificarPinUsuario es un no-op a propósito (PIN eliminado).

let app: FastifyInstance;
let prisma: PrismaClient;
let tCARGA = '';
let tOPERADOR = '';
const CID = 'cnt_002';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function login(email: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'delsol123' } });
  return r.json().token as string;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tCARGA = await login('camila@delsol.com'); // rol CARGA
  tOPERADOR = await login('luciana@delsol.com'); // rol OPERADOR
});

afterAll(async () => {
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — un rol CARGA no toca la plata de un contrato vigente', () => {
  it('PATCH /monto con CARGA → 403', async () => {
    const r = await app.inject({ method: 'PATCH', url: `/contratos/${CID}/monto`, headers: auth(tCARGA), payload: { monto: 1 } });
    expect(r.statusCode).toBe(403); // con el bug: 200 y el alquiler quedaba en $1
  });

  it('PATCH /modo-cobranza con CARGA → 403', async () => {
    const r = await app.inject({
      method: 'PATCH', url: `/contratos/${CID}/modo-cobranza`, headers: auth(tCARGA),
      payload: { modoCobranza: 'PROPIETARIO_DIRECTO' },
    });
    expect(r.statusCode).toBe(403);
  });

  it('PUT /mora con CARGA → 403', async () => {
    const r = await app.inject({ method: 'PUT', url: `/contratos/${CID}/mora`, headers: auth(tCARGA), payload: { tipo: 'SIN_MORA' } });
    expect(r.statusCode).toBe(403);
  });

  it('el alquiler NO cambió tras los tres intentos', async () => {
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: CID } });
    expect(Number(c.monto)).toBeGreaterThan(1);
  });

  it('un OPERADOR SÍ puede ajustar el monto (no se rompió el caso de uso real)', async () => {
    const antes = await prisma.contrato.findUniqueOrThrow({ where: { id: CID } });
    const nuevo = Number(antes.monto) + 1;
    const r = await app.inject({ method: 'PATCH', url: `/contratos/${CID}/monto`, headers: auth(tOPERADOR), payload: { monto: nuevo } });
    expect(r.statusCode).toBe(200);
    // lo devolvemos a su valor original para no ensuciar la DB compartida
    await prisma.contrato.update({ where: { id: CID }, data: { monto: antes.monto } });
  });
});
