import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// Pedido de Camila (03/08/2026): "cuando registramos ingresos o salidas no pongamos
// propiedad de forma obligatoria, solamente opcional, y agreguemos cuenta; cuenta sí
// es obligatorio".
//
// Por la caja pasa plata que no es de ninguna unidad (gastos de la oficina, movimientos
// entre socios): antes había que elegir una propiedad cualquiera y eso le ensuciaba la
// rendición a ese propietario. Y del otro lado: si la plata no dice de qué cuenta salió
// o a cuál entró, los totales por cuenta nunca cierran contra el total de la caja.
//
// Esta suite cubre las dos mitades y —lo más importante— que un movimiento sin propiedad
// NO se le rinda a nadie.

let app: FastifyInstance;
let tokenAdmin: string;
const prismaTest = new PrismaClient();
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const MARCA = 'QA-PROP-OPCIONAL';

let idAmbas = '';
let idSoloSalida = '';
let idOtraEntrada = '';
let inmobiliariaId = '';

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const admin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  tokenAdmin = admin.json().token;

  const crear = (nombre: string, direccion: string) =>
    app.inject({ method: 'POST', url: '/cuentas', headers: auth(tokenAdmin), payload: { nombre, direccion } });
  idAmbas = (await crear(`${MARCA} efectivo`, 'AMBAS')).json().id;
  idSoloSalida = (await crear(`${MARCA} solo salida`, 'SALIDA')).json().id;
  idOtraEntrada = (await crear(`${MARCA} otra entrada`, 'ENTRADA')).json().id;
  const cuenta = await prismaTest.cuentaCaja.findUnique({ where: { id: idAmbas }, select: { inmobiliariaId: true } });
  inmobiliariaId = cuenta!.inmobiliariaId;
});

afterAll(async () => {
  await prismaTest.movimientoCaja.deleteMany({ where: { descripcion: { startsWith: MARCA } } });
  await prismaTest.cuentaCaja.deleteMany({ where: { id: { in: [idAmbas, idSoloSalida, idOtraEntrada].filter(Boolean) } } });
  await app.close();
  await prismaTest.$disconnect();
});

const cargar = (payload: Record<string, unknown>) =>
  app.inject({
    method: 'POST',
    url: '/caja/movimientos',
    headers: auth(tokenAdmin),
    payload: {
      tipo: 'GASTO',
      categoria: 'OTRO',
      descripcion: `${MARCA} movimiento`,
      monto: 5000,
      fecha: '2026-06-20',
      cuentaId: idAmbas,
      ...payload,
    },
  });

describe('Caja — la propiedad es opcional', () => {
  it('sin propiedadId → 200, queda sin propiedad y sin contrato', async () => {
    const res = await cargar({ propiedadId: undefined, descripcion: `${MARCA} gasto de oficina` });
    expect(res.statusCode).toBe(200);
    expect(res.json().propiedadId).toBeNull();
    // El contrato se derivaba de la propiedad: sin propiedad tiene que quedar null y no
    // colgarse del contrato de una unidad cualquiera.
    expect(res.json().contratoId).toBeNull();
  });

  it('con propiedadId null explícito → 200 (el front manda null, no undefined)', async () => {
    // El propio endpoint ya se comió este bug con `proveedor` y `comprobanteUrl`:
    // `.optional()` acepta undefined pero RECHAZA null, y toda la carga moría en 400.
    const res = await cargar({ propiedadId: null, descripcion: `${MARCA} null explicito` });
    expect(res.statusCode).toBe(200);
    expect(res.json().propiedadId).toBeNull();
  });

  it('sin propiedad NO engancha una propiedad cualquiera del tenant', async () => {
    // Prisma ignora las claves `undefined` de un where: si el lookup no fuera
    // condicional, `findFirst({ where: { id: undefined, inmobiliariaId } })` devolvía la
    // PRIMERA propiedad de la cartera y el gasto terminaba en la rendición del dueño
    // equivocado, sin un solo error.
    const res = await cargar({ propiedadId: undefined, descripcion: `${MARCA} sin enganche` });
    expect(res.statusCode).toBe(200);
    const mov = await prismaTest.movimientoCaja.findUnique({ where: { id: res.json().id } });
    expect(mov!.propiedadId).toBeNull();
  });

  it('una propiedad de OTRA inmobiliaria sigue dando 404', async () => {
    const ajena = await prismaTest.propiedad.findFirst({
      where: { inmobiliariaId: { not: inmobiliariaId } },
      select: { id: true },
    });
    if (!ajena) return; // el seed no tiene otra cartera: nada que verificar
    const res = await cargar({ propiedadId: ajena.id, descripcion: `${MARCA} tenant ajeno` });
    expect(res.statusCode).toBe(404);
  });

  it('con propiedad sigue funcionando igual que antes', async () => {
    const propia = await prismaTest.propiedad.findFirst({ where: { inmobiliariaId }, select: { id: true } });
    const res = await cargar({ propiedadId: propia!.id, descripcion: `${MARCA} con propiedad` });
    expect(res.statusCode).toBe(200);
    expect(res.json().propiedadId).toBe(propia!.id);
  });
});

describe('Caja — un movimiento sin propiedad no se le rinde a nadie', () => {
  it('los gastos huérfanos quedan fuera de la consulta de rendición', async () => {
    // La rendición filtra `propiedadId: { in: [...] }`. En SQL un NULL nunca cae dentro
    // de un IN, así que el huérfano queda afuera — pero eso es un detalle sutil del
    // motor, no una decisión escrita. Este test lo fija como garantía.
    const res = await cargar({ propiedadId: undefined, descripcion: `${MARCA} huerfano rendicion` });
    expect(res.statusCode).toBe(200);
    const propIds = (await prismaTest.propiedad.findMany({ where: { inmobiliariaId }, select: { id: true } })).map(
      (p) => p.id,
    );
    const alcanzados = await prismaTest.movimientoCaja.findMany({
      where: { inmobiliariaId, propiedadId: { in: propIds }, tipo: 'GASTO' },
      select: { id: true },
    });
    expect(alcanzados.map((m) => m.id)).not.toContain(res.json().id);
  });
});

describe('Cuenta predeterminada — dónde caen los cobros automáticos', () => {
  it('marcar una cuenta como predeterminada la deja marcada', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idAmbas}`,
      headers: auth(tokenAdmin),
      payload: { esPredeterminada: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().esPredeterminada).toBe(true);
  });

  it('marcar otra desmarca la anterior (hay una sola por inmobiliaria)', async () => {
    // Sin el desmarcado dentro de la misma transacción, el índice UNIQUE PARCIAL
    // devolvería un P2002 crudo (500) en vez de cambiar la predeterminada.
    const res = await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idOtraEntrada}`,
      headers: auth(tokenAdmin),
      payload: { esPredeterminada: true },
    });
    expect(res.statusCode).toBe(200);
    const marcadas = await prismaTest.cuentaCaja.findMany({
      where: { inmobiliariaId, esPredeterminada: true },
      select: { id: true },
    });
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]!.id).toBe(idOtraEntrada);
  });

  it('una cuenta de SOLO SALIDA no puede ser la predeterminada → 409', async () => {
    // El movimiento automático es un INGRESO: si la predeterminada no acepta entradas,
    // el cobro no tendría dónde caer.
    const res = await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idSoloSalida}`,
      headers: auth(tokenAdmin),
      payload: { esPredeterminada: true },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/solo salida/i);
  });

  it('archivar por PATCH le saca la marca', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idOtraEntrada}`,
      headers: auth(tokenAdmin),
      payload: { activa: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().esPredeterminada).toBe(false);
    await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idOtraEntrada}`,
      headers: auth(tokenAdmin),
      payload: { activa: true },
    });
  });

  // 🔴 El de arriba daba FALSO VERDE por sí solo: el botón Archivar de la pantalla NO
  // usa el PATCH, llama al DELETE (que archiva cuando la cuenta tiene movimientos). Ese
  // camino no limpiaba la marca, así que quedaba en una cuenta archivada, el lookup del
  // cobro automático —que exige activa— no encontraba ninguna, y todos los cobros
  // pasaban a registrarse sin cuenta mientras la card seguía diciendo que entraban ahí.
  it('archivar por DELETE (el camino del botón de la pantalla) TAMBIÉN le saca la marca', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idAmbas}`,
      headers: auth(tokenAdmin),
      payload: { esPredeterminada: true },
    });
    // El DELETE sólo archiva si la cuenta tiene movimientos; sino la borra de verdad.
    await cargar({ cuentaId: idAmbas, descripcion: `${MARCA} para que archive` });
    const res = await app.inject({ method: 'DELETE', url: `/cuentas/${idAmbas}`, headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    expect(res.json().archivada).toBe(true);
    const cuenta = await prismaTest.cuentaCaja.findUnique({ where: { id: idAmbas } });
    expect(cuenta!.activa).toBe(false);
    expect(cuenta!.esPredeterminada).toBe(false);
    await prismaTest.cuentaCaja.update({ where: { id: idAmbas }, data: { activa: true } });
  });

  it('quitar la marca a mano deja a la inmobiliaria sin predeterminada', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idAmbas}`,
      headers: auth(tokenAdmin),
      payload: { esPredeterminada: true },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idAmbas}`,
      headers: auth(tokenAdmin),
      payload: { esPredeterminada: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().esPredeterminada).toBe(false);
    const marcadas = await prismaTest.cuentaCaja.count({
      where: { inmobiliariaId, esPredeterminada: true },
    });
    expect(marcadas).toBe(0);
  });

  // 🔴 Antes esto daba 409 sin salida: el diálogo de edición manda SIEMPRE la dirección,
  // y como la primera cuenta que acepta entradas se marca sola, alguien que nunca marcó
  // nada no podía editar su única cuenta. El error le pedía "marcá otra que acepte
  // entradas" — y no tenía otra.
  it('pasar la predeterminada a SOLO SALIDA no explota: le quita la marca y guarda', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idAmbas}`,
      headers: auth(tokenAdmin),
      payload: { esPredeterminada: true },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idAmbas}`,
      headers: auth(tokenAdmin),
      payload: { nombre: `${MARCA} efectivo`, direccion: 'SALIDA' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().direccion).toBe('SALIDA');
    expect(res.json().esPredeterminada).toBe(false);
    await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idAmbas}`,
      headers: auth(tokenAdmin),
      payload: { direccion: 'AMBAS' },
    });
  });
});

describe('Cobro automático de un cargo — cae en la cuenta predeterminada', () => {
  it('saldar un cargo registra el INGRESO_EXTRA en la cuenta predeterminada', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/cuentas/${idAmbas}`,
      headers: auth(tokenAdmin),
      payload: { esPredeterminada: true },
    });
    const contrato = await prismaTest.contrato.findFirst({
      where: { id: 'cnt_001' },
      select: { id: true, inmobiliariaId: true, propiedadId: true },
    });
    const cargo = await prismaTest.cargoContrato.create({
      data: {
        inmobiliariaId: contrato!.inmobiliariaId,
        contratoId: contrato!.id,
        tipo: 'REPARACION',
        concepto: `${MARCA} cargo con cuenta`,
        monto: 12345,
        contraDeposito: false,
      },
    });
    const res = await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const mov = await prismaTest.movimientoCaja.findFirst({
      where: { contratoId: contrato!.id, descripcion: { contains: `${MARCA} cargo con cuenta` } },
    });
    expect(mov).toBeTruthy();
    expect(mov!.cuentaId).toBe(idAmbas);
    await prismaTest.movimientoCaja.deleteMany({ where: { id: mov!.id } });
    await prismaTest.cargoContrato.deleteMany({ where: { id: cargo.id } });
  });

  it('sin cuenta predeterminada el cobro se registra IGUAL, sin cuenta', async () => {
    // Innegociable: este cobro no puede fallar por una cuenta sin configurar. Perder el
    // registro de la plata es exactamente el bug que el bloque existe para evitar.
    await prismaTest.cuentaCaja.updateMany({ where: { inmobiliariaId }, data: { esPredeterminada: false } });
    const contrato = await prismaTest.contrato.findFirst({
      where: { id: 'cnt_001' },
      select: { id: true, inmobiliariaId: true },
    });
    const cargo = await prismaTest.cargoContrato.create({
      data: {
        inmobiliariaId: contrato!.inmobiliariaId,
        contratoId: contrato!.id,
        tipo: 'REPARACION',
        concepto: `${MARCA} cargo sin predeterminada`,
        monto: 777,
        contraDeposito: false,
      },
    });
    const res = await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const mov = await prismaTest.movimientoCaja.findFirst({
      where: { contratoId: contrato!.id, descripcion: { contains: `${MARCA} cargo sin predeterminada` } },
    });
    expect(mov).toBeTruthy();
    expect(mov!.cuentaId).toBeNull();
    await prismaTest.movimientoCaja.deleteMany({ where: { id: mov!.id } });
    await prismaTest.cargoContrato.deleteMany({ where: { id: cargo.id } });
  });
});

describe('Caja — ids vacíos no llegan a la base', () => {
  it('propiedadId y cuentaId en "" se guardan como null, no como cadena vacía', async () => {
    // Un `""` es falsy: se saltea los guards de validación, pero sobrevive a un
    // `?? null` (que sólo atrapa null/undefined) y llegaría a la FK como cadena
    // vacía → 500. El panel manda null, pero la API es pública para el tenant.
    const res = await app.inject({
      method: 'POST',
      url: '/caja/movimientos',
      headers: auth(tokenAdmin),
      payload: {
        propiedadId: '',
        cuentaId: '',
        tipo: 'GASTO',
        categoria: 'OTRO',
        descripcion: `${MARCA} ids vacios`,
        monto: 100,
        fecha: '2026-06-20',
      },
    });
    // 400 porque falta la cuenta habiendo compatibles — lo importante es que NO sea 500.
    expect([200, 400]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.json().propiedadId).toBeNull();
      expect(res.json().cuentaId).toBeNull();
    }
  });

  it('con cuenta válida y propiedadId "" el movimiento entra sin propiedad', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/caja/movimientos',
      headers: auth(tokenAdmin),
      payload: {
        propiedadId: '',
        cuentaId: idAmbas,
        tipo: 'GASTO',
        categoria: 'OTRO',
        descripcion: `${MARCA} prop vacia con cuenta`,
        monto: 100,
        fecha: '2026-06-20',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().propiedadId).toBeNull();
    expect(res.json().cuentaId).toBe(idAmbas);
  });
});

describe('Cuentas — los totales no mezclan monedas', () => {
  it('un movimiento en USD y uno en ARS no se suman uno a uno', async () => {
    // Antes de este cambio el panel NUNCA reenviaba la moneda, así que todo se guardaba
    // en ARS y el total plano era consistente por accidente. Al arreglar el reenvío los
    // USD se persisten de verdad: sin desglosar, US$2.000 se leían como $2.000 en el
    // número que la inmobiliaria usa para saber cuánta plata tiene.
    const cuentaId = idOtraEntrada; // ENTRADA
    const r1 = await cargar({ cuentaId, tipo: 'INGRESO_EXTRA', moneda: 'ARS', monto: 1000, descripcion: `${MARCA} en pesos` });
    const r2 = await cargar({ cuentaId, tipo: 'INGRESO_EXTRA', moneda: 'USD', monto: 7, descripcion: `${MARCA} en dolares` });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);

    const res = await app.inject({ method: 'GET', url: '/cuentas', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const cuenta = res.json().find((c: { id: string }) => c.id === cuentaId);
    const ars = cuenta.totales.find((t: { moneda: string }) => t.moneda === 'ARS');
    const usd = cuenta.totales.find((t: { moneda: string }) => t.moneda === 'USD');
    expect(ars.entradas).toBe(1000);
    expect(usd.entradas).toBe(7);
    // Lo que importa: en ningún renglón aparece 1007.
    expect(cuenta.totales.some((t: { entradas: number }) => t.entradas === 1007)).toBe(false);
    // ARS primero, para que la card muestre lo normal arriba.
    expect(cuenta.totales[0].moneda).toBe('ARS');
  });

  it('una cuenta sin movimientos devuelve un renglón en cero', async () => {
    const res = await app.inject({ method: 'GET', url: '/cuentas', headers: auth(tokenAdmin) });
    const cuenta = res.json().find((c: { id: string }) => c.id === idSoloSalida);
    expect(cuenta.totales).toEqual([{ moneda: 'ARS', entradas: 0, salidas: 0, saldo: 0 }]);
  });

  it('el detalle de la cuenta trae la moneda de cada movimiento', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/cuentas/${idOtraEntrada}/movimientos`,
      headers: auth(tokenAdmin),
    });
    expect(res.statusCode).toBe(200);
    const dolar = res.json().find((m: { descripcion: string }) => m.descripcion.includes('en dolares'));
    expect(dolar.moneda).toBe('USD');
  });
});

describe('Cobro automático — respeta la moneda del cargo', () => {
  it('saldar un cargo en USD registra el ingreso en USD, no en pesos', async () => {
    // `CargoContrato` tiene su propia moneda, y el create de caja no la copiaba: se
    // guardaba con el default ARS y el MISMO número. Ese ingreso después no se le sumaba
    // al propietario en una rendición en dólares (la rendición filtra por moneda) y caía
    // en el renglón equivocado de los totales por cuenta.
    const contrato = await prismaTest.contrato.findFirst({
      where: { id: 'cnt_001' },
      select: { id: true, inmobiliariaId: true },
    });
    const cargo = await prismaTest.cargoContrato.create({
      data: {
        inmobiliariaId: contrato!.inmobiliariaId,
        contratoId: contrato!.id,
        tipo: 'REPARACION',
        concepto: `${MARCA} cargo en dolares`,
        monto: 300,
        moneda: 'USD',
        contraDeposito: false,
      },
    });
    const res = await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const mov = await prismaTest.movimientoCaja.findFirst({
      where: { contratoId: contrato!.id, descripcion: { contains: `${MARCA} cargo en dolares` } },
    });
    expect(mov).toBeTruthy();
    expect(mov!.moneda).toBe('USD');
    expect(Number(mov!.monto)).toBe(300);
    await prismaTest.movimientoCaja.deleteMany({ where: { id: mov!.id } });
    await prismaTest.cargoContrato.deleteMany({ where: { id: cargo.id } });
  });
});
