import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let tokenAdmin: string;
let tokenCarga: string;

/** Devuelve el estado seed mutado por corridas anteriores a su origen. */
async function resetPlata(prisma: PrismaClient) {
  await prisma.pago.deleteMany({ where: { id: { notIn: ['pag_001', 'pag_002'] } } });
  await prisma.pago.update({
    where: { id: 'pag_001' },
    data: { estado: 'INFORMADO', decididoPorId: null, decididoAt: null, observacion: null },
  });
  await prisma.liquidacion.update({
    where: { id: 'liq_005' },
    data: { estado: 'PENDIENTE', fechaPago: null, metodoPago: null },
  });
  await prisma.gastoRendido.deleteMany({ where: { rendicion: { id: { not: 'ren_001' } } } });
  await prisma.movimientoCaja.updateMany({
    where: { id: { in: ['mov_002', 'mov_003'] } },
    data: { descontadoEnRendicion: false, rendicionId: null },
  });
  await prisma.rendicion.deleteMany({ where: { id: { not: 'ren_001' } } });
  await prisma.aprobacion.update({
    where: { id: 'apr_seed_1' },
    data: { estado: 'PENDIENTE', aprobadoPorId: null, aprobadoAt: null, comentarioAprobador: null },
  });
  await prisma.contrato.update({
    where: { id: 'cnt_006' },
    data: { estado: 'BORRADOR', pendienteAprobacion: true, aprobadoAt: null },
  });
}

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await resetPlata(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const admin = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tokenAdmin = admin.json().token;
  const carga = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'camila@delsol.com', password: 'delsol123' } });
  tokenCarga = carga.json().token;
});

afterAll(async () => {
  await app.close();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('Contratos con estado de pago derivado', () => {
  it('cnt_001 sale VENCIDO y cnt_002 PAGADO desde liquidaciones reales', async () => {
    const res = await app.inject({ method: 'GET', url: '/contratos', headers: auth(tokenAdmin) });
    const lista = res.json();
    expect(lista.find((c: { id: string }) => c.id === 'cnt_001').estadoPagoActual).toBe('VENCIDO');
    expect(lista.find((c: { id: string }) => c.id === 'cnt_002').estadoPagoActual).toBe('PAGADO');
  });
});

describe('Validación de pagos (PIN + permisos)', () => {
  it('PIN incorrecto → 403 y el pago sigue INFORMADO', async () => {
    const res = await app.inject({ method: 'POST', url: '/pagos/pag_001/validar', headers: auth(tokenAdmin), payload: { pin: '9999' } });
    expect(res.statusCode).toBe(403);
  });

  it('rol CARGA no puede conciliar → 403', async () => {
    const res = await app.inject({ method: 'POST', url: '/pagos/pag_001/validar', headers: auth(tokenCarga), payload: { pin: '1234' } });
    expect(res.statusCode).toBe(403);
  });

  it('rechazar sin observación → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/pagos/pag_001/rechazar', headers: auth(tokenAdmin), payload: { pin: '1234' } });
    expect(res.statusCode).toBe(400);
  });

  it('validar con PIN ok → pago CONCILIADO + liquidación PAGADA', async () => {
    const res = await app.inject({ method: 'POST', url: '/pagos/pag_001/validar', headers: auth(tokenAdmin), payload: { pin: '1234' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('CONCILIADO');
    const liqs = await app.inject({ method: 'GET', url: '/liquidaciones?periodo=2026-06', headers: auth(tokenAdmin) });
    const liq5 = liqs.json().find((l: { id: string }) => l.id === 'liq_005');
    expect(liq5.estado).toBe('PAGADO');
  });

  it('volver a validar el mismo pago → 409', async () => {
    const res = await app.inject({ method: 'POST', url: '/pagos/pag_001/validar', headers: auth(tokenAdmin), payload: { pin: '1234' } });
    expect(res.statusCode).toBe(409);
  });
});

describe('Inquilino informa pago', () => {
  it('Mariela informa el pago de su liquidación vencida', async () => {
    const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
    const tk = demo.json().token;
    const mias = await app.inject({ method: 'GET', url: '/mis-liquidaciones', headers: auth(tk) });
    const vencida = mias.json().find((l: { estado: string }) => l.estado === 'VENCIDO');
    expect(vencida.id).toBe('liq_001');

    const res = await app.inject({
      method: 'POST',
      url: '/pagos/informar',
      headers: auth(tk),
      payload: { liquidacionId: 'liq_001', monto: 572000, metodo: 'TRANSFERENCIA', nroOperacion: 'TRF-TEST-1', fechaTransferencia: '2026-06-12', nota: 'test' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('INFORMADO');
    expect(res.json().tipo).toBe('TOTAL');
  });
});

describe('Rendición — el loop caja→rendición', () => {
  it('rendir junio a Silvana: bruto por participación, descuenta gastos y los marca', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(tokenAdmin),
      payload: { propietarioId: 'own_002', periodo: '2026-06', metodo: 'TRANSFERENCIA', pin: '1234' },
    });
    expect(res.statusCode).toBe(201);
    const r = res.json();
    // Bruto: liq_002 (620k, prp_002 100%) + liq_004 (720k, prp_004 100%) + liq_007 (285k, prp_002 100%) + liq_005 (850k, prp_005)? No: prp_005 es de own_004.
    expect(Number(r.montoBruto)).toBe(1_625_000);
    expect(Number(r.comisionMonto)).toBeCloseTo(113_750, 0); // 7%
    expect(Number(r.totalGastos)).toBe(90_500); // mov_002 62k + mov_003 28.5k
    expect(Number(r.montoNeto)).toBeCloseTo(1_420_750, 0);

    // Los gastos quedaron DESCONTADOS y linkeados (lo que el mock nunca cerraba)
    const caja = await app.inject({ method: 'GET', url: '/caja/movimientos', headers: auth(tokenAdmin) });
    const movs = caja.json();
    expect(movs.find((m: { id: string }) => m.id === 'mov_002').descontadoEnRendicion).toBe(true);
    expect(movs.find((m: { id: string }) => m.id === 'mov_003').descontadoEnRendicion).toBe(true);
  });

  it('rendir el mismo período de nuevo → 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(tokenAdmin),
      payload: { propietarioId: 'own_002', periodo: '2026-06', pin: '1234' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('propietario sin CBU (Federico) → 409 con mensaje claro', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(tokenAdmin),
      payload: { propietarioId: 'own_003', periodo: '2026-06', pin: '1234' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toContain('CBU');
  });
});

describe('Aprobaciones con PIN', () => {
  it('aprobar el contrato de Tomás Bravo → APROBADA + contrato ACTIVO', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/aprobaciones/apr_seed_1/aprobar',
      headers: auth(tokenAdmin),
      payload: { pin: '1234' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('APROBADA');
    // La respuesta debe traer cargadoPor con el mismo shape que GET /aprobaciones
    // (el front mapea cargadoPor.nombre; sin el include el cliente crasheaba).
    expect(res.json().cargadoPor).toMatchObject({
      nombre: expect.any(String),
      apellido: expect.any(String),
      rol: expect.any(String),
    });
    const contratos = await app.inject({ method: 'GET', url: '/contratos', headers: auth(tokenAdmin) });
    const c6 = contratos.json().find((c: { id: string }) => c.id === 'cnt_006');
    expect(c6.estado).toBe('ACTIVO');
    expect(c6.pendienteAprobacion).toBe(false);
  });

  it('rechazar sin motivo → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/aprobaciones/apr_seed_3/rechazar',
      headers: auth(tokenAdmin),
      payload: { pin: '1234' },
    });
    expect(res.statusCode).toBe(400);
  });
});
