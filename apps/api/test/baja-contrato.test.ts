import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// Regresión de la BAJA de contrato (auditoría "el inquilino sigue viendo el contrato
// activo tras la baja"). Cubre el circuito completo:
//  - /mi-contrato devuelve `estado` y anula datosCobranza cuando no está ACTIVO.
//  - finalizar anula las cuotas FUTURAS impagas sin pago y CONSERVA la deuda vencida.
//  - finalizar NO desvincula al inquilino (acceso de solo lectura para el ex-inquilino).
//  - las notificaciones dejan de decir "tu alquiler está atrasado".
//  - las ESCRITURAS (informar pago) siguen bloqueadas con 409.
//  - el preview de finalizar reporta las cuotas futuras a anular.

let app: FastifyInstance;
let prisma: PrismaClient;
let tokenAdmin: string;
let tokenInq: string;
let cid: string; // contratoId del inquilino demo
let tid: string; // inmobiliariaId

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const PERIODO_FUTURO = '2099-01';
const PERIODO_VENCIDO = '2099-02'; // periodo distinto; lo marcamos VENCIDO a mano

const DEMO_CONTRATO = 'cnt_001';
const DEMO_INQ_EMAIL = 'mariela.sosa@gmail.com';

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);

  // Reset DETERMINISTA: seedBase upserta el contrato SIN resetear `estado`, así que
  // una corrida previa que finalizó cnt_001 lo deja FINALIZADO. Lo devolvemos a ACTIVO
  // (con su propiedad e inquilino re-vinculados) para que el test parta de un contrato vivo.
  const cto = await prisma.contrato.findUniqueOrThrow({ where: { id: DEMO_CONTRATO } });
  cid = cto.id;
  tid = cto.inmobiliariaId;
  await prisma.contrato.update({ where: { id: cid }, data: { estado: 'ACTIVO' } });
  await prisma.propiedad.updateMany({
    where: { id: cto.propiedadId },
    data: { contratoActualId: cid, estado: 'ALQUILADA' },
  });
  await prisma.inquilino.updateMany({
    where: { inmobiliariaId: tid, email: DEMO_INQ_EMAIL },
    data: { contratoId: cid },
  });

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });

  const admin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  tokenAdmin = admin.json().token;

  const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
  tokenInq = demo.json().token;

  // Limpieza idempotente de corridas previas.
  await prisma.liquidacion.deleteMany({
    where: { contratoId: cid, periodo: { in: [PERIODO_FUTURO, PERIODO_VENCIDO] } },
  });

  // Cuota FUTURA impaga sin pago → debe anularse al finalizar.
  await prisma.liquidacion.create({
    data: {
      inmobiliariaId: tid,
      contratoId: cid,
      periodo: PERIODO_FUTURO,
      montoAlquiler: 100000,
      montoTotal: 100000,
      fechaVencimiento: new Date(Date.now() + 60 * 86400000),
      estado: 'PENDIENTE',
    },
  });
  // Deuda YA vencida → debe SOBREVIVIR a la baja (es deuda real cobrable).
  await prisma.liquidacion.create({
    data: {
      inmobiliariaId: tid,
      contratoId: cid,
      periodo: PERIODO_VENCIDO,
      montoAlquiler: 100000,
      montoTotal: 100000,
      fechaVencimiento: new Date(Date.now() - 60 * 86400000),
      estado: 'VENCIDO',
    },
  });
});

afterAll(async () => {
  await prisma.liquidacion.deleteMany({
    where: { contratoId: cid, periodo: { in: [PERIODO_FUTURO, PERIODO_VENCIDO] } },
  });
  // Restaurar el contrato compartido del seed a ACTIVO: este test lo finaliza, y
  // seedBase no resetea `estado` → sin esto dejaríamos cnt_001 FINALIZADO y podríamos
  // romper otros archivos de test que lo leen como activo.
  const cto = await prisma.contrato.findUnique({ where: { id: cid } });
  if (cto) {
    await prisma.contrato.update({ where: { id: cid }, data: { estado: 'ACTIVO' } });
    await prisma.propiedad.updateMany({
      where: { id: cto.propiedadId },
      data: { contratoActualId: cid, estado: 'ALQUILADA' },
    });
    await prisma.inquilino.updateMany({
      where: { inmobiliariaId: tid, email: DEMO_INQ_EMAIL },
      data: { contratoId: cid },
    });
  }
  await app.close();
  await prisma.$disconnect();
});

describe('Baja de contrato — estado y colaterales', () => {
  it('antes de la baja: /mi-contrato está ACTIVO', async () => {
    const res = await app.inject({ method: 'GET', url: '/mi-contrato', headers: auth(tokenInq) });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('ACTIVO');
  });

  it('el preview reporta la cuota futura a anular', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/contratos/${cid}/finalizar-preview`,
      headers: auth(tokenAdmin),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().cuotasFuturasAAnular).toBeGreaterThanOrEqual(1);
  });

  it('finalizar: 200 + anula al menos la cuota futura', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/contratos/${cid}/finalizar`,
      headers: auth(tokenAdmin),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.json().cuotasAnuladas).toBeGreaterThanOrEqual(1);
  });

  it('la cuota FUTURA se borró y la VENCIDA sobrevive', async () => {
    const futura = await prisma.liquidacion.findFirst({
      where: { contratoId: cid, periodo: PERIODO_FUTURO },
    });
    const vencida = await prisma.liquidacion.findFirst({
      where: { contratoId: cid, periodo: PERIODO_VENCIDO },
    });
    expect(futura).toBeNull();
    expect(vencida).not.toBeNull();
  });

  it('el inquilino NO se desvincula (acceso de solo lectura conservado)', async () => {
    const inq = await prisma.inquilino.findFirst({ where: { contratoId: cid } });
    expect(inq).not.toBeNull();
  });

  it('tras la baja: /mi-contrato está FINALIZADO y sin datos de cobranza', async () => {
    const res = await app.inject({ method: 'GET', url: '/mi-contrato', headers: auth(tokenInq) });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('FINALIZADO');
    expect(res.json().datosCobranza).toBeNull();
  });

  it('las notificaciones ya NO dicen "tu alquiler está atrasado"', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/mis-notificaciones',
      headers: auth(tokenInq),
    });
    expect(res.statusCode).toBe(200);
    const titulos = (res.json() as { titulo: string }[]).map((n) => n.titulo);
    expect(titulos).not.toContain('Tu alquiler está atrasado');
  });

  it('informar un pago tras la baja → 409 (escritura bloqueada)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/informar',
      headers: auth(tokenInq),
      payload: {
        liquidacionId: 'cualquiera',
        monto: 1000,
        metodo: 'TRANSFERENCIA',
        fechaTransferencia: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(409);
  });
});
