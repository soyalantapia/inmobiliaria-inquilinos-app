import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// ============================================================================
// TESTEO INTEGRAL del módulo CONSORCIOS (My Alquiler).
// Cubre los 16 endpoints y TODAS las reglas del tablero:
//   - CRUD de consorcio (+ sociedad del tenant, multi-tenant).
//   - Unidades funcionales: Σ coeficientes ≤ 100, duplicado case-insensitive,
//     cantUf consistente, saldoDeudor = plata (CARGA afuera), borrado con deuda.
//   - Movimientos financieros: signo↔categoría, monto≠0, RBAC (CARGA afuera,
//     borrado solo ADMIN).
//   - Asambleas: alta/baja + RBAC.
//   - Servicios comunes: upsert por (consorcio, tipo).
//   - Inventario: alta de items + movimientos de stock (ENTRADA/SALIDA/AJUSTE,
//     clamp ≥ 0, atómico).
//   - Auth (401) + RBAC por rol + aislamiento multi-tenant (404 cross-tenant).
// ============================================================================

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let tOPERADOR = '';
let tCARGA = '';
let tLECTURA = '';
let tid = ''; // tenant A (Inmobiliaria del Sol)

// Tenant B (para aislamiento cross-tenant)
let tidB = '';
let consorcioB = '';
let ufB = '';
let movB = '';

const NAME_PREFIX = 'ZZ-TEST-CONSORCIO';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const creados: string[] = []; // consorcios creados por el test (cleanup)

async function login(email: string): Promise<string> {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'delsol123' } });
  if (r.statusCode !== 200) throw new Error(`login ${email} → ${r.statusCode}: ${r.body}`);
  return r.json().token;
}

const get = (url: string, t: string) => app.inject({ method: 'GET', url, headers: auth(t) });
const post = (url: string, t: string, payload: unknown) =>
  app.inject({ method: 'POST', url, headers: auth(t), payload: payload as object });
const put = (url: string, t: string, payload: unknown) =>
  app.inject({ method: 'PUT', url, headers: auth(t), payload: payload as object });
const del = (url: string, t: string) => app.inject({ method: 'DELETE', url, headers: auth(t) });

async function borrarConsorcios(ids: string[]) {
  for (const cid of ids) {
    await prisma.movimientoInventario.deleteMany({ where: { consorcioId: cid } });
    await prisma.itemInventario.deleteMany({ where: { consorcioId: cid } });
    await prisma.servicioComunConsorcio.deleteMany({ where: { consorcioId: cid } });
    await prisma.asambleaConsorcio.deleteMany({ where: { consorcioId: cid } });
    await prisma.movimientoConsorcio.deleteMany({ where: { consorcioId: cid } });
    await prisma.unidadFuncional.deleteMany({ where: { consorcioId: cid } });
    await prisma.consorcio.deleteMany({ where: { id: cid } });
  }
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;

  // Limpieza idempotente: consorcios de test de corridas previas.
  const viejos = await prisma.consorcio.findMany({
    where: { inmobiliariaId: tid, nombre: { startsWith: NAME_PREFIX } },
    select: { id: true },
  });
  await borrarConsorcios(viejos.map((c) => c.id));

  // Usuario LECTURA (no lo crea seedBase) para probar el gate propiedades.crear.
  await prisma.usuario.upsert({
    where: { inmobiliariaId_email: { inmobiliariaId: tid, email: 'lectura@delsol.com' } },
    update: { rol: 'LECTURA', activo: true },
    create: {
      inmobiliariaId: tid,
      email: 'lectura@delsol.com',
      nombre: 'Lucrecia',
      apellido: 'Lectura',
      rol: 'LECTURA',
      passwordHash: bcrypt.hashSync('delsol123', 10),
    },
  });

  // Tenant B + un consorcio con UF y movimiento (para cross-tenant).
  const inmoB = await prisma.inmobiliaria.create({
    data: {
      nombre: 'ZZ-TEST-TENANT-B',
      cuit: '30-99999999-9',
      email: 'zz-test-b@example.com',
      telefono: '0',
      matricula: 'ZZ-TEST-MAT',
      direccionCalle: 'Calle B',
      direccionAltura: '1',
      direccionCiudad: 'CABA',
      direccionProvincia: 'CABA',
      direccionCp: '1000',
      codigoReferido: 'ZZ-TEST-REF-B',
    },
  });
  tidB = inmoB.id;
  const cB = await prisma.consorcio.create({
    data: {
      inmobiliariaId: tidB,
      nombre: `${NAME_PREFIX}-B`,
      direccion: 'Calle B 123',
      cantUf: 1,
      periodoActual: '2026-07',
      expensasPeriodoActual: 0,
      desde: new Date(),
    },
  });
  consorcioB = cB.id;
  const uB = await prisma.unidadFuncional.create({
    data: { inmobiliariaId: tidB, consorcioId: consorcioB, identificacion: '1A', titular: 'Beto', coeficiente: 50, telefono: '' },
  });
  ufB = uB.id;
  const mB = await prisma.movimientoConsorcio.create({
    data: { inmobiliariaId: tidB, consorcioId: consorcioB, fecha: new Date(), concepto: 'Movimiento test', monto: 100, categoria: 'COBRANZA' },
  });
  movB = mB.id;

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tADMIN = await login('roberto@delsol.com');
  tOPERADOR = await login('luciana@delsol.com');
  tCARGA = await login('camila@delsol.com');
  tLECTURA = await login('lectura@delsol.com');
});

afterAll(async () => {
  await borrarConsorcios(creados);
  await borrarConsorcios([consorcioB]);
  await prisma.usuario.deleteMany({ where: { inmobiliariaId: tid, email: 'lectura@delsol.com' } });
  await prisma.inmobiliaria.deleteMany({ where: { id: tidB } });
  await app.close();
  await prisma.$disconnect();
});

// Crea un consorcio de test y lo registra para cleanup.
async function nuevoConsorcio(nombre = `${NAME_PREFIX}-${creados.length}`): Promise<string> {
  const r = await post('/consorcios', tADMIN, { nombre, direccion: 'Av. Test 100' });
  expect(r.statusCode).toBe(201);
  const id = r.json().id;
  creados.push(id);
  return id;
}

describe('Consorcios — auth y RBAC base', () => {
  it('GET /consorcios sin token → 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/consorcios' });
    expect(r.statusCode).toBe(401);
  });
  it('LECTURA puede VER pero no CREAR (propiedades.crear) → 403', async () => {
    expect((await get('/consorcios', tLECTURA)).statusCode).toBe(200);
    const r = await post('/consorcios', tLECTURA, { nombre: `${NAME_PREFIX}-nope`, direccion: 'x y z' });
    expect(r.statusCode).toBe(403);
  });
});

describe('Consorcios — CRUD', () => {
  it('POST crea con cantUf=0 y periodo por defecto; 201', async () => {
    const r = await post('/consorcios', tADMIN, { nombre: `${NAME_PREFIX}-crud`, direccion: 'Av. Siempreviva 742' });
    expect(r.statusCode).toBe(201);
    const c = r.json();
    creados.push(c.id);
    expect(c.cantUf).toBe(0);
    expect(c.periodoActual).toMatch(/^\d{4}-\d{2}$/);
    expect(c.unidades).toEqual([]);
  });
  it('POST con body inválido (nombre corto) → 400', async () => {
    expect((await post('/consorcios', tADMIN, { nombre: 'x', direccion: 'y' })).statusCode).toBe(400);
  });
  it('POST con sociedad de otro tenant → 404', async () => {
    const r = await post('/consorcios', tADMIN, { nombre: `${NAME_PREFIX}-soc`, direccion: 'Av. Test 1', sociedadId: 'no-existe-id' });
    expect(r.statusCode).toBe(404);
  });
  it('GET detalle trae unidades/movimientos/asambleas', async () => {
    const id = await nuevoConsorcio();
    const r = await get(`/consorcios/${id}`, tADMIN);
    expect(r.statusCode).toBe(200);
    const c = r.json();
    expect(c).toHaveProperty('unidades');
    expect(c).toHaveProperty('movimientos');
    expect(c).toHaveProperty('asambleas');
  });
  it('PUT edita nombre/expensas y saca encargado (null)', async () => {
    const id = await nuevoConsorcio();
    const r = await put(`/consorcios/${id}`, tADMIN, { nombre: `${NAME_PREFIX}-editado`, expensasPeriodoActual: 999, encargado: null });
    expect(r.statusCode).toBe(200);
    expect(r.json().nombre).toBe(`${NAME_PREFIX}-editado`);
    expect(Number(r.json().expensasPeriodoActual)).toBe(999);
    expect(r.json().encargado).toBeNull();
  });
});

describe('Consorcios — unidades funcionales (coeficientes)', () => {
  it('alta de UF incrementa cantUf y devuelve 201', async () => {
    const id = await nuevoConsorcio();
    const r = await post(`/consorcios/${id}/unidades`, tADMIN, { identificacion: '1°A', titular: 'Pérez', coeficiente: 40 });
    expect(r.statusCode).toBe(201);
    const det = (await get(`/consorcios/${id}`, tADMIN)).json();
    expect(det.cantUf).toBe(1);
    expect(det.unidades.length).toBe(1);
  });
  it('Σ coeficientes > 100 → 400 con disponible', async () => {
    const id = await nuevoConsorcio();
    expect((await post(`/consorcios/${id}/unidades`, tADMIN, { identificacion: 'A', titular: 'Ana', coeficiente: 70 })).statusCode).toBe(201);
    const r = await post(`/consorcios/${id}/unidades`, tADMIN, { identificacion: 'B', titular: 'Beto', coeficiente: 40 });
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toMatch(/100%|disponible/i);
    // La segunda NO se creó → cantUf sigue en 1.
    expect((await get(`/consorcios/${id}`, tADMIN)).json().cantUf).toBe(1);
  });
  it('tolerancia: 33.33 * 3 = 99.99 cierra sin error', async () => {
    const id = await nuevoConsorcio();
    for (const ident of ['A', 'B', 'C']) {
      expect((await post(`/consorcios/${id}/unidades`, tADMIN, { identificacion: ident, titular: `Titular ${ident}`, coeficiente: 33.33 })).statusCode).toBe(201);
    }
  });
  it('identificación duplicada (case-insensitive) → 409', async () => {
    const id = await nuevoConsorcio();
    expect((await post(`/consorcios/${id}/unidades`, tADMIN, { identificacion: 'PB', titular: 'Ana', coeficiente: 10 })).statusCode).toBe(201);
    const r = await post(`/consorcios/${id}/unidades`, tADMIN, { identificacion: 'pb', titular: 'Beto', coeficiente: 10 });
    expect(r.statusCode).toBe(409);
  });
  it('CARGA no puede setear saldoDeudor → 403', async () => {
    const id = await nuevoConsorcio();
    const r = await post(`/consorcios/${id}/unidades`, tCARGA, { identificacion: 'X', titular: 'Xenia', coeficiente: 10, saldoDeudor: 5000 });
    expect(r.statusCode).toBe(403);
  });
  it('CARGA sí puede crear UF estructural (sin saldoDeudor) → 201', async () => {
    const id = await nuevoConsorcio();
    expect((await post(`/consorcios/${id}/unidades`, tCARGA, { identificacion: 'Y', titular: 'Yago', coeficiente: 10 })).statusCode).toBe(201);
  });
  it('PUT UF recalcula Σ excluyendo la propia', async () => {
    const id = await nuevoConsorcio();
    const a = (await post(`/consorcios/${id}/unidades`, tADMIN, { identificacion: 'A', titular: 'Ana', coeficiente: 60 })).json();
    await post(`/consorcios/${id}/unidades`, tADMIN, { identificacion: 'B', titular: 'Beto', coeficiente: 30 });
    // Subir A a 70 → 70+30=100 OK
    expect((await put(`/consorcios/${id}/unidades/${a.id}`, tADMIN, { coeficiente: 70 })).statusCode).toBe(200);
    // Subir A a 80 → 80+30=110 > 100 → 400
    expect((await put(`/consorcios/${id}/unidades/${a.id}`, tADMIN, { coeficiente: 80 })).statusCode).toBe(400);
  });
  it('DELETE UF decrementa cantUf; CARGA no puede borrar (403)', async () => {
    const id = await nuevoConsorcio();
    const uf = (await post(`/consorcios/${id}/unidades`, tADMIN, { identificacion: 'A', titular: 'Ana', coeficiente: 10 })).json();
    expect((await del(`/consorcios/${id}/unidades/${uf.id}`, tCARGA)).statusCode).toBe(403);
    expect((await del(`/consorcios/${id}/unidades/${uf.id}`, tADMIN)).statusCode).toBe(200);
    expect((await get(`/consorcios/${id}`, tADMIN)).json().cantUf).toBe(0);
  });
  it('DELETE UF con saldoDeudor > 0 → 409', async () => {
    const id = await nuevoConsorcio();
    const uf = (await post(`/consorcios/${id}/unidades`, tADMIN, { identificacion: 'A', titular: 'Ana', coeficiente: 10, saldoDeudor: 15000 })).json();
    expect((await del(`/consorcios/${id}/unidades/${uf.id}`, tADMIN)).statusCode).toBe(409);
  });
});

describe('Consorcios — movimientos financieros (signo↔categoría, RBAC)', () => {
  it('COBRANZA positiva → 201; SUELDO negativo → 201', async () => {
    const id = await nuevoConsorcio();
    expect((await post(`/consorcios/${id}/movimientos`, tADMIN, { fecha: '2026-07-01', concepto: 'Cobranza expensas', monto: 50000, categoria: 'COBRANZA' })).statusCode).toBe(201);
    expect((await post(`/consorcios/${id}/movimientos`, tADMIN, { fecha: '2026-07-02', concepto: 'Sueldo encargado', monto: -30000, categoria: 'SUELDO' })).statusCode).toBe(201);
  });
  it('signo que no coincide con categoría → 400', async () => {
    const id = await nuevoConsorcio();
    // COBRANZA negativa
    expect((await post(`/consorcios/${id}/movimientos`, tADMIN, { fecha: '2026-07-01', concepto: 'Movimiento test', monto: -100, categoria: 'COBRANZA' })).statusCode).toBe(400);
    // SUELDO positivo (inflar ingresos)
    expect((await post(`/consorcios/${id}/movimientos`, tADMIN, { fecha: '2026-07-01', concepto: 'Movimiento test', monto: 100, categoria: 'SUELDO' })).statusCode).toBe(400);
  });
  it('monto 0 → 400', async () => {
    const id = await nuevoConsorcio();
    expect((await post(`/consorcios/${id}/movimientos`, tADMIN, { fecha: '2026-07-01', concepto: 'Movimiento test', monto: 0, categoria: 'OTRO' })).statusCode).toBe(400);
  });
  it('CARGA no tiene gasto.caja.cargar → 403', async () => {
    const id = await nuevoConsorcio();
    expect((await post(`/consorcios/${id}/movimientos`, tCARGA, { fecha: '2026-07-01', concepto: 'Movimiento test', monto: -100, categoria: 'SERVICIO' })).statusCode).toBe(403);
  });
  it('borrar movimiento: OPERADOR 403, ADMIN 200', async () => {
    const id = await nuevoConsorcio();
    const mov = (await post(`/consorcios/${id}/movimientos`, tOPERADOR, { fecha: '2026-07-01', concepto: 'Movimiento test', monto: 100, categoria: 'COBRANZA' })).json();
    expect((await del(`/consorcios/${id}/movimientos/${mov.id}`, tOPERADOR)).statusCode).toBe(403);
    expect((await del(`/consorcios/${id}/movimientos/${mov.id}`, tADMIN)).statusCode).toBe(200);
  });
});

describe('Consorcios — asambleas', () => {
  it('alta 201; CARGA no puede borrar (403); ADMIN sí', async () => {
    const id = await nuevoConsorcio();
    const a = await post(`/consorcios/${id}/asambleas`, tADMIN, { fecha: '2026-06-01', tipo: 'ORDINARIA', asunto: 'Presupuesto anual', asistentes: 12, acuerdoPrincipal: 'Aprobar expensas' });
    expect(a.statusCode).toBe(201);
    const aid = a.json().id;
    expect((await del(`/consorcios/${id}/asambleas/${aid}`, tCARGA)).statusCode).toBe(403);
    expect((await del(`/consorcios/${id}/asambleas/${aid}`, tADMIN)).statusCode).toBe(200);
  });
  it('tipo inválido → 400', async () => {
    const id = await nuevoConsorcio();
    expect((await post(`/consorcios/${id}/asambleas`, tADMIN, { fecha: '2026-06-01', tipo: 'RARA', asunto: 'x y z', asistentes: 1, acuerdoPrincipal: 'a b c' })).statusCode).toBe(400);
  });
});

describe('Consorcios — servicios comunes (upsert por tipo)', () => {
  it('GET vacío []; PUT crea y luego actualiza el MISMO tipo (1 fila)', async () => {
    const id = await nuevoConsorcio();
    expect((await get(`/consorcios/${id}/servicios`, tADMIN)).json()).toEqual([]);
    expect((await put(`/consorcios/${id}/servicios`, tADMIN, { tipo: 'ASCENSOR', proveedor: 'Otis', nis: '123' })).statusCode).toBe(200);
    expect((await put(`/consorcios/${id}/servicios`, tADMIN, { tipo: 'ASCENSOR', proveedor: 'Thyssen', nis: '456' })).statusCode).toBe(200);
    const lista = (await get(`/consorcios/${id}/servicios`, tADMIN)).json();
    expect(lista.length).toBe(1);
    expect(lista[0].proveedor).toBe('Thyssen');
  });
});

describe('Consorcios — inventario (stock, clamp, delta)', () => {
  it('alta item + ENTRADA/SALIDA/AJUSTE con clamp ≥ 0', async () => {
    const id = await nuevoConsorcio();
    const inv0 = (await get(`/consorcios/${id}/inventario`, tADMIN)).json();
    expect(inv0).toEqual({ items: [], movimientos: [] });

    const item = (await post(`/consorcios/${id}/inventario/items`, tADMIN, { categoria: 'ILUMINACION', nombre: 'Lámpara LED', unidad: 'unidades', cantidadActual: 10, minimoStock: 3 })).json();
    // ENTRADA +5 → 15
    let r = await post(`/consorcios/${id}/inventario/movimientos`, tADMIN, { itemId: item.id, tipo: 'ENTRADA', cantidad: 5, motivo: 'compra' });
    expect(r.statusCode).toBe(200);
    expect(r.json().item.cantidadActual).toBe(15);
    // SALIDA 100 → clamp a 0 (no negativo)
    r = await post(`/consorcios/${id}/inventario/movimientos`, tADMIN, { itemId: item.id, tipo: 'SALIDA', cantidad: 100, motivo: 'uso', ufDestino: '1°A' });
    expect(r.json().item.cantidadActual).toBe(0);
    // AJUSTE fija en 7
    r = await post(`/consorcios/${id}/inventario/movimientos`, tADMIN, { itemId: item.id, tipo: 'AJUSTE', cantidad: 7, motivo: 'recuento' });
    expect(r.json().item.cantidadActual).toBe(7);
    // item inexistente → 404
    expect((await post(`/consorcios/${id}/inventario/movimientos`, tADMIN, { itemId: 'no', tipo: 'ENTRADA', cantidad: 1, motivo: 'x' })).statusCode).toBe(404);
  });
});

describe('Consorcios — aislamiento multi-tenant (cross-tenant → 404)', () => {
  it('tenant A no ve el detalle del consorcio de tenant B', async () => {
    expect((await get(`/consorcios/${consorcioB}`, tADMIN)).statusCode).toBe(404);
  });
  it('tenant A no puede editar el consorcio de tenant B', async () => {
    expect((await put(`/consorcios/${consorcioB}`, tADMIN, { nombre: 'hackeado' })).statusCode).toBe(404);
  });
  it('tenant A no puede tocar la UF de tenant B', async () => {
    expect((await put(`/consorcios/${consorcioB}/unidades/${ufB}`, tADMIN, { coeficiente: 99 })).statusCode).toBe(404);
    expect((await del(`/consorcios/${consorcioB}/unidades/${ufB}`, tADMIN)).statusCode).toBe(404);
  });
  it('tenant A no puede borrar el movimiento de tenant B', async () => {
    expect((await del(`/consorcios/${consorcioB}/movimientos/${movB}`, tADMIN)).statusCode).toBe(404);
  });
  it('el consorcio de tenant B NO aparece en la lista de tenant A', async () => {
    const lista = (await get('/consorcios', tADMIN)).json() as { id: string }[];
    expect(lista.find((c) => c.id === consorcioB)).toBeUndefined();
  });
});
