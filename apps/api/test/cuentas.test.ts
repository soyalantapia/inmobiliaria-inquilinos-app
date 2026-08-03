import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// Circuito de cuentas de caja (pedido de Camila: "diferentes cuentas — Gaspar retira
// Mercado Pago, la otra bebé retiro" / "hay cuentas que solo entrar plata y otras salir").
// Ejercitamos de punta a punta: el admin define cuentas con dirección, cada movimiento de
// caja sale de / entra a una, la dirección se respeta, y se ven los totales por cuenta.

let app: FastifyInstance;
let tokenAdmin: string; // roberto — ADMIN (ve + gestiona)
let tokenCarga: string; // camila — CARGA (la cajera: NO ve ni gestiona cuentas)
let tokenOperador: string; // luciana — OPERADOR (ve, pero NO gestiona)
const prismaTest = new PrismaClient();
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const MARCA = 'QA-CUENTAS'; // prefijo para limpiar los movimientos que crea la suite

let idGaspar = ''; // SALIDA
let idReintegros = ''; // ENTRADA
let idEfectivo = ''; // AMBAS
let idVacia = ''; // AMBAS, sin movimientos

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const admin = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tokenAdmin = admin.json().token;
  const carga = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'camila@delsol.com', password: 'delsol123' } });
  tokenCarga = carga.json().token;
  const operador = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'luciana@delsol.com', password: 'delsol123' } });
  tokenOperador = operador.json().token;
});

afterAll(async () => {
  // Limpieza: los movimientos que creó la suite (por marca) y las cuentas nuevas, para no
  // ensuciar la DB compartida (los tests de caja cuentan movimientos del seed).
  await prismaTest.movimientoCaja.deleteMany({ where: { descripcion: { startsWith: MARCA } } });
  await prismaTest.cuentaCaja.deleteMany({ where: { id: { in: [idGaspar, idReintegros, idEfectivo, idVacia].filter(Boolean) } } });
  await app.close();
  await prismaTest.$disconnect();
});

const cargarMov = (token: string, tipo: 'GASTO' | 'INGRESO_EXTRA', monto: number, cuentaId: string | null, sufijo: string) =>
  app.inject({
    method: 'POST',
    url: '/caja/movimientos',
    headers: auth(token),
    payload: { propiedadId: 'prp_003', tipo, categoria: 'OTRO', descripcion: `${MARCA} ${sufijo}`, monto, fecha: '2026-06-20', proveedor: null, cuentaId },
  });

describe('Cuentas de caja — alta y dirección', () => {
  it('el admin crea cuentas con dirección (entrada / salida / ambas) → 201', async () => {
    const g = await app.inject({ method: 'POST', url: '/cuentas', headers: auth(tokenAdmin), payload: { nombre: 'Gaspar Mercado Pago', direccion: 'SALIDA' } });
    const r = await app.inject({ method: 'POST', url: '/cuentas', headers: auth(tokenAdmin), payload: { nombre: 'Reintegros', direccion: 'ENTRADA' } });
    const e = await app.inject({ method: 'POST', url: '/cuentas', headers: auth(tokenAdmin), payload: { nombre: 'Efectivo caja', direccion: 'AMBAS' } });
    const v = await app.inject({ method: 'POST', url: '/cuentas', headers: auth(tokenAdmin), payload: { nombre: 'Cuenta vacía' } }); // default AMBAS
    expect([g.statusCode, r.statusCode, e.statusCode, v.statusCode]).toEqual([201, 201, 201, 201]);
    idGaspar = g.json().id;
    idReintegros = r.json().id;
    idEfectivo = e.json().id;
    idVacia = v.json().id;
    expect(v.json().direccion).toBe('AMBAS');
  });

  it('nombre demasiado corto → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/cuentas', headers: auth(tokenAdmin), payload: { nombre: 'X' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('Cuentas de caja — movimientos respetan la dirección', () => {
  it('gasto (salida) sobre una cuenta SALIDA → 200', async () => {
    const res = await cargarMov(tokenAdmin, 'GASTO', 10000, idGaspar, 'salida MP');
    expect(res.statusCode).toBe(200);
    expect(res.json().cuentaId).toBe(idGaspar);
  });

  it('ingreso sobre una cuenta SALIDA → 409 (no la admite)', async () => {
    const res = await cargarMov(tokenAdmin, 'INGRESO_EXTRA', 5000, idGaspar, 'ingreso mal');
    expect(res.statusCode).toBe(409);
  });

  it('ingreso sobre una cuenta ENTRADA → 200', async () => {
    const res = await cargarMov(tokenAdmin, 'INGRESO_EXTRA', 5000, idReintegros, 'entrada reintegro');
    expect(res.statusCode).toBe(200);
  });

  it('gasto sobre una cuenta AMBAS → 200', async () => {
    const res = await cargarMov(tokenAdmin, 'GASTO', 3000, idEfectivo, 'salida efectivo');
    expect(res.statusCode).toBe(200);
  });

  it('cuentaId inexistente / de otro tenant → 404', async () => {
    const res = await cargarMov(tokenAdmin, 'GASTO', 2000, 'cuenta-que-no-existe', 'tenant ajeno');
    expect(res.statusCode).toBe(404);
  });

  // CAMBIO DE REGLA (03/08/2026): antes se podía cargar un movimiento sin cuenta y
  // quedaba fuera de todos los totales por cuenta. Ahora la cuenta es obligatoria en
  // cuanto EXISTE alguna que pueda recibir ese movimiento.
  it('sin cuenta, habiendo cuentas que aceptan salidas → 400', async () => {
    const res = await cargarMov(tokenAdmin, 'GASTO', 1000, null, 'sin cuenta');
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/de qué cuenta sale/i);
  });

  it('sin cuenta, habiendo cuentas que aceptan entradas → 400', async () => {
    const res = await cargarMov(tokenAdmin, 'INGRESO_EXTRA', 1000, null, 'sin cuenta ingreso');
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/a qué cuenta entra/i);
  });

  // La contracara, y es la que evita que la regla sea una trampa: si NINGUNA cuenta
  // puede recibir el movimiento, exigirla dejaría a la cajera sin poder registrar la
  // plata — que es justo lo que la caja existe para evitar. Se permite y queda sin
  // cuenta; el panel avisa y lleva a crear la que falta.
  it('sin cuenta y sin ninguna cuenta compatible → 200 (no se bloquea el registro)', async () => {
    // Archivamos las tres que aceptan salidas: no queda ninguna para un GASTO.
    await prismaTest.cuentaCaja.updateMany({
      where: { id: { in: [idGaspar, idEfectivo, idVacia] } },
      data: { activa: false },
    });
    try {
      const res = await cargarMov(tokenAdmin, 'GASTO', 1000, null, 'sin compatibles');
      expect(res.statusCode).toBe(200);
      expect(res.json().cuentaId).toBeNull();
    } finally {
      await prismaTest.cuentaCaja.updateMany({
        where: { id: { in: [idGaspar, idEfectivo, idVacia] } },
        data: { activa: true },
      });
    }
  });

  it('una cuenta ARCHIVADA no acepta movimientos → 409', async () => {
    await prismaTest.cuentaCaja.update({ where: { id: idEfectivo }, data: { activa: false } });
    try {
      const res = await cargarMov(tokenAdmin, 'GASTO', 1000, idEfectivo, 'a cuenta archivada');
      expect(res.statusCode).toBe(409);
      expect(res.json().message).toMatch(/archivada/i);
    } finally {
      await prismaTest.cuentaCaja.update({ where: { id: idEfectivo }, data: { activa: true } });
    }
  });
});

describe('Cuentas de caja — totales y detalle', () => {
  // Los totales vienen POR MONEDA (`totales: [{moneda, entradas, salidas, saldo}]`), no
  // como un número plano: sumar dólares y pesos uno a uno daba un saldo sin significado.
  // Con una sola moneda —el caso normal— hay un único renglón, en ARS.
  it('GET /cuentas refleja entradas / salidas / saldo por cuenta y por moneda', async () => {
    const res = await app.inject({ method: 'GET', url: '/cuentas', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    type Total = { moneda: string; entradas: number; salidas: number; saldo: number };
    const ars = new Map<string, Total | undefined>(
      res.json().map((c: { id: string; totales: Total[] }) => [c.id, c.totales.find((t) => t.moneda === 'ARS')]),
    );
    expect(ars.get(idGaspar)).toMatchObject({ entradas: 0, salidas: 10000, saldo: -10000 });
    expect(ars.get(idReintegros)).toMatchObject({ entradas: 5000, salidas: 0, saldo: 5000 });
    expect(ars.get(idEfectivo)).toMatchObject({ entradas: 0, salidas: 3000, saldo: -3000 });
    expect(ars.get(idVacia)).toMatchObject({ entradas: 0, salidas: 0, saldo: 0 });
  });

  it('GET /cuentas/:id/movimientos devuelve el detalle de esa cuenta', async () => {
    const res = await app.inject({ method: 'GET', url: `/cuentas/${idGaspar}/movimientos`, headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const movs = res.json();
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ tipo: 'GASTO', monto: 10000 });
  });
});

describe('Cuentas de caja — borrado', () => {
  it('borrar una cuenta SIN movimientos la elimina de verdad', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/cuentas/${idVacia}`, headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ eliminada: true });
    idVacia = ''; // ya no existe: sacala de la limpieza del afterAll
  });

  it('borrar una cuenta CON movimientos la archiva (no rompe el historial)', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/cuentas/${idGaspar}`, headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ archivada: true, movimientos: 1 });
    // sigue apareciendo en la lista pero inactiva, y el movimiento sobrevive
    const lista = await app.inject({ method: 'GET', url: '/cuentas', headers: auth(tokenAdmin) });
    const gaspar = lista.json().find((c: { id: string }) => c.id === idGaspar);
    expect(gaspar.activa).toBe(false);
    expect(gaspar.totales.find((t: { moneda: string }) => t.moneda === 'ARS').salidas).toBe(10000);
    // Archivar por DELETE —el camino del botón de la pantalla— también tiene que dejarla
    // sin la marca de predeterminada, sino los cobros automáticos apuntan a una cuenta
    // inactiva y pasan a registrarse sin cuenta en silencio.
    expect(gaspar.esPredeterminada).toBe(false);
  });
});

describe('Cuentas de caja — permisos (la cajera no toca cuentas)', () => {
  it('CARGA (cajera) NO puede ver cuentas → 403', async () => {
    const res = await app.inject({ method: 'GET', url: '/cuentas', headers: auth(tokenCarga) });
    expect(res.statusCode).toBe(403);
  });

  it('CARGA (cajera) NO puede crear cuentas → 403', async () => {
    const res = await app.inject({ method: 'POST', url: '/cuentas', headers: auth(tokenCarga), payload: { nombre: 'Prohibida' } });
    expect(res.statusCode).toBe(403);
  });

  it('OPERADOR puede VER cuentas → 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/cuentas', headers: auth(tokenOperador) });
    expect(res.statusCode).toBe(200);
  });

  it('OPERADOR NO puede crear cuentas (solo el admin las define) → 403', async () => {
    const res = await app.inject({ method: 'POST', url: '/cuentas', headers: auth(tokenOperador), payload: { nombre: 'Operador intenta' } });
    expect(res.statusCode).toBe(403);
  });
});
