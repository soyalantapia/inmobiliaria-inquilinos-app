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
  // liq_003 la muta la suite de /pagos/manual (cobro manual → PARCIAL/PAGADO).
  await prisma.liquidacion.update({
    where: { id: 'liq_003' },
    data: { estado: 'VENCIDO', fechaPago: null, metodoPago: null },
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

describe('Alta de gasto en caja', () => {
  it('crea un gasto sin proveedor (proveedor null) → 200 y persiste; luego se puede eliminar', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/caja/movimientos',
      headers: auth(tokenAdmin),
      // proveedor null = caso del form cuando queda vacío (antes daba 400)
      payload: { propiedadId: 'prp_003', categoria: 'CERRAJERIA', descripcion: 'QA alta sin proveedor', monto: 15000, fecha: '2026-06-14', proveedor: null },
    });
    expect(res.statusCode).toBe(200);
    const creado = res.json();
    expect(creado.proveedor).toBeNull();
    expect(Number(creado.monto)).toBe(15000);
    // limpieza: el gasto recién creado no está descontado → se puede eliminar con PIN
    const del = await app.inject({
      method: 'DELETE',
      url: `/caja/movimientos/${creado.id}`,
      headers: auth(tokenAdmin),
      payload: { pin: '1234' },
    });
    expect(del.statusCode).toBe(200);
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

// Cobro MANUAL (efectivo en oficina / "el dueño confirmó que cobró" en cobranza
// directa): el único camino en prod para marcar cobrada una liquidación cuando el
// inquilino no informa por la app. Usa liq_003 (cnt_003, VENCIDO, $510.000) que
// ningún otro test toca; fecha = fechaVencimiento → 0 días de atraso → mora 0
// (determinístico, no depende del día en que corra la suite).
describe('POST /pagos/manual — cobro registrado por la inmobiliaria', () => {
  const FECHA = '2026-06-02'; // = fechaVencimiento de liq_003

  it('rol CARGA no puede → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenCarga),
      payload: { liquidacionId: 'liq_003', monto: 1000, fecha: FECHA, pin: '1234' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('PIN incorrecto → 403 y no se crea el pago', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenAdmin),
      payload: { liquidacionId: 'liq_003', monto: 1000, fecha: FECHA, pin: '9999' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('monto que supera el saldo → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenAdmin),
      payload: { liquidacionId: 'liq_003', monto: 999999999, fecha: FECHA, pin: '1234' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/supera el saldo/i);
  });

  it('cobro parcial en efectivo → 201, nace CONCILIADO y la liq queda PARCIAL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenAdmin),
      payload: { liquidacionId: 'liq_003', monto: 200000, metodo: 'EFECTIVO', fecha: FECHA, nota: 'pagó en la oficina', pin: '1234' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().estado).toBe('CONCILIADO');
    expect(res.json().tipo).toBe('PARCIAL');
    const liqs = await app.inject({ method: 'GET', url: '/liquidaciones?periodo=2026-06', headers: auth(tokenAdmin) });
    const liq3 = liqs.json().find((l: { id: string }) => l.id === 'liq_003');
    expect(liq3.estado).toBe('PARCIAL');
    expect(Number(liq3.montoPagado)).toBe(200000);
  });

  it('cobro del resto → cierra el ciclo: liq PAGADO con metodoPago EFECTIVO', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenAdmin),
      payload: { liquidacionId: 'liq_003', monto: 310000, metodo: 'EFECTIVO', fecha: FECHA, pin: '1234' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().tipo).toBe('TOTAL'); // el pago que CIERRA nace TOTAL
    const liqs = await app.inject({ method: 'GET', url: '/liquidaciones?periodo=2026-06', headers: auth(tokenAdmin) });
    const liq3 = liqs.json().find((l: { id: string }) => l.id === 'liq_003');
    expect(liq3.estado).toBe('PAGADO');
  });

  it('sobre una liq ya paga → 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenAdmin),
      payload: { liquidacionId: 'liq_003', monto: 1000, fecha: FECHA, pin: '1234' },
    });
    expect(res.statusCode).toBe(409);
  });
});

// La bandeja GET /pagos ahora decora cada fila con el saldo REAL de la liquidación
// y el modo de cobranza del contrato (antes el panel calculaba el saldo contra
// mocks y no distinguía contratos PROPIETARIO_DIRECTO).
describe('GET /pagos — decoración de liquidación y modo de cobranza', () => {
  it('cada pago trae liquidacion.{montoPagado,saldo} y contrato.modoCobranza', async () => {
    const res = await app.inject({ method: 'GET', url: '/pagos', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const pagos = res.json();
    expect(pagos.length).toBeGreaterThan(0);
    for (const p of pagos) {
      expect(p.contrato.modoCobranza).toBeDefined();
      expect(p.liquidacion.montoPagado).toBeDefined();
      expect(p.liquidacion.saldo).toBeDefined();
      expect(p.liquidacion.montoPunitorio).toBeDefined();
    }
  });
});

// /mis-liquidaciones ahora expone los pagos del inquilino (estado + motivo de
// rechazo + comprobante): la fuente que la PWA necesitaba para mostrar
// "pendiente de validación" / "rechazado" / "confirmado" en prod.
describe('GET /mis-liquidaciones — pagos[] del inquilino', () => {
  it('cada liquidación trae su lista de pagos con estado y monto numérico', async () => {
    const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
    const tk = demo.json().token;
    const res = await app.inject({ method: 'GET', url: '/mis-liquidaciones', headers: auth(tk) });
    expect(res.statusCode).toBe(200);
    const liqs = res.json();
    expect(liqs.length).toBeGreaterThan(0);
    for (const l of liqs) expect(Array.isArray(l.pagos)).toBe(true);
    // liq_001 tiene pag_002 (INFORMADO del seed, o el estado en que lo dejó la suite)
    const liq1 = liqs.find((l: { id: string }) => l.id === 'liq_001');
    expect(liq1.pagos.length).toBeGreaterThan(0);
    const pago = liq1.pagos.find((p: { id: string }) => p.id === 'pag_002');
    expect(pago).toBeDefined();
    expect(typeof pago.monto).toBe('number');
    expect(['INFORMADO', 'CONCILIADO', 'RECHAZADO']).toContain(pago.estado);
  });
});

// P10: las escrituras del inquilino sobre el contrato exigen contrato ACTIVO.
// El JWT vive 15 días y sobrevive a finalizar el contrato → sin este guard, un
// ex-inquilino seguía informando pagos / subiendo boletas. Va al FINAL del archivo
// porque finaliza cnt_001 (mutación de seed); cada test file re-seedea en beforeAll.
describe('P10 — escritura sobre contrato no-activo', () => {
  it('finalizar cnt_001 y luego informar pago / subir boleta con el JWT viejo → 409', async () => {
    // Token de Mariela (cnt_001) emitido ANTES de finalizar: el JWT lleva el contratoId.
    const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
    const tk = demo.json().token;
    const fin = await app.inject({ method: 'POST', url: '/contratos/cnt_001/finalizar', headers: auth(tokenAdmin) });
    expect(fin.statusCode).toBe(200);

    const pago = await app.inject({
      method: 'POST',
      url: '/pagos/informar',
      headers: auth(tk),
      payload: { liquidacionId: 'liq_001', monto: 1000, metodo: 'TRANSFERENCIA', fechaTransferencia: '2026-06-12' },
    });
    expect(pago.statusCode).toBe(409);
    expect(pago.json().message).toMatch(/no está activo/i);

    const boleta = await app.inject({
      method: 'POST',
      url: '/boletas',
      headers: auth(tk),
      payload: { servicio: 'LUZ', periodo: '2026-06', monto: 5000 },
    });
    expect(boleta.statusCode).toBe(409);
  });
});
