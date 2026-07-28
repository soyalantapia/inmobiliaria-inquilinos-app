import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P2 — la fecha de transferencia la elige el inquilino, y es la que la validación
// usa como `asOf` para calcular la mora. Los únicos topes eran "no futura" y "no anterior
// al inicio del contrato": en un contrato de 3 años eso deja backdatear MESES, así que el
// inquilino se auto-condonaba los punitorios fechando el pago antes del vencimiento (y de
// paso falseaba el certificado de buen pagador). Ahora hay una ventana de 30 días: cubre
// "transferí hace unos días y recién informo" y corta el abuso.

let app: FastifyInstance;
let prisma: PrismaClient;
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const diasAtras = (d: number) => new Date(Date.now() - d * 24 * 3600 * 1000).toISOString().slice(0, 10);

async function tokenInquilino() {
  const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
  return demo.json().token as string;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  // La DB de test es COMPARTIDA y plata.test.ts finaliza cnt_001 en uno de sus casos.
  // Sin reactivarlo, exigirContratoActivo corta con 409 ANTES de los guards de fecha y
  // este test no probaría nada.
  await prisma.contrato.updateMany({ where: { id: 'cnt_001' }, data: { estado: 'ACTIVO' } });
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
});

afterAll(async () => {
  if (app) await app.close();
  await prisma.$disconnect();
});

const informar = async (fecha: string) => {
  const tk = await tokenInquilino();
  return app.inject({
    method: 'POST',
    url: '/pagos/informar',
    headers: auth(tk),
    payload: { liquidacionId: 'liq_001', monto: 1000, metodo: 'TRANSFERENCIA', nroOperacion: 'TRF-BACKDATE', fechaTransferencia: fecha },
  });
};

describe('CAZABUG — no se puede backdatear la transferencia para esquivar la mora', () => {
  it('una fecha de hace 200 días → 400 (antes: aceptada, mora en 0)', async () => {
    const r = await informar(diasAtras(200));
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toMatch(/30 días/i);
  });

  it('una fecha de hace 31 días → 400 (justo afuera de la ventana)', async () => {
    const r = await informar(diasAtras(31));
    expect(r.statusCode).toBe(400);
  });

  it('una fecha de hace 3 días NO la corta este guard (caso legítimo)', async () => {
    const r = await informar(diasAtras(3));
    // Puede dar 200/409/400 por otras reglas del flujo (ya informada, monto, etc.),
    // pero NUNCA el rechazo por antigüedad: ese es el punto del test.
    expect(r.json().message ?? '').not.toMatch(/30 días/i);
  });

  it('una fecha futura sigue rechazada (guard previo intacto)', async () => {
    const manana = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const r = await informar(manana);
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toMatch(/futura/i);
  });
});
