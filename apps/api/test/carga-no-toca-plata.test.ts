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

  it('PUT /propietarios/:id con CARGA → 403', async () => {
    // El email de un propietario es la LLAVE DE ENTRADA a su portal (el OTP se busca por él),
    // y el cbuAlias es el DESTINO de la rendición. Con el bug, un CARGA podía reescribir los
    // dos: quedarse con el acceso a la cartera de un tercero y desviar a dónde va la plata.
    // Los hermanos DELETE y PATCH /activo ya cortaban a CARGA; este PUT no.
    const r = await app.inject({
      method: 'PUT', url: '/propietarios/own_001', headers: auth(tCARGA),
      payload: { nombre: 'Tomado', apellido: 'Porelatacante', email: 'atacante@example.com', cbuAlias: 'atacante.mp' },
    });
    expect(r.statusCode).toBe(403); // con el bug: 200, y el propietario perdía su portal
  });

  it('el email y el CBU del propietario NO cambiaron', async () => {
    const o = await prisma.propietario.findUniqueOrThrow({ where: { id: 'own_001' } });
    expect(o.email).not.toBe('atacante@example.com');
    expect(o.cbuAlias ?? '').not.toBe('atacante.mp');
  });

  it('un OPERADOR SÍ puede ajustar el monto (no se rompió el caso de uso real)', async () => {
    const antes = await prisma.contrato.findUniqueOrThrow({ where: { id: CID } });
    const nuevo = Number(antes.monto) + 1;
    const r = await app.inject({ method: 'PATCH', url: `/contratos/${CID}/monto`, headers: auth(tOPERADOR), payload: { monto: nuevo } });
    expect(r.statusCode).toBe(200);
    // lo devolvemos a su valor original para no ensuciar la DB compartida
    await prisma.contrato.update({ where: { id: CID }, data: { monto: antes.monto } });
  });

  it('un OPERADOR SÍ puede editar un propietario (no se rompió el caso de uso real)', async () => {
    const antes = await prisma.propietario.findUniqueOrThrow({ where: { id: 'own_001' } });
    const r = await app.inject({
      method: 'PUT', url: '/propietarios/own_001', headers: auth(tOPERADOR),
      payload: { nombre: antes.nombre, apellido: antes.apellido ?? undefined, telefono: antes.telefono ?? undefined },
    });
    expect(r.statusCode).toBe(200);
  });
});

/**
 * La MISMA clase de agujero, en la ficha del propietario en vez de la del contrato.
 *
 * `propietarios.crear` también incluye a CARGA —el rol tipea altas— y gateaba tres campos que
 * no son datos de contacto:
 *   · `cbuAlias`                        → adónde se le transfiere AL DUEÑO
 *   · `cuenta-cobranza-directa`         → adónde transfiere EL INQUILINO (lo ve en la PWA)
 *   · `email`                           → la CREDENCIAL del portal: quien lo escribe recibe el
 *                                          OTP y entra a ver la cartera y la plata de ese dueño
 * Ninguno dejaba rastro, encima.
 */
describe('CAZABUG — un rol CARGA no redirige la plata del propietario ni se mete en su portal', () => {
  const OWN = 'own_002'; // Silvana Morales, con cbuAlias y email cargados

  it('cambiarle el CBU/alias con CARGA → 403', async () => {
    const r = await app.inject({
      method: 'PUT', url: `/propietarios/${OWN}`, headers: auth(tCARGA),
      payload: { nombre: 'Silvana', apellido: 'Morales', cbuAlias: 'cuenta.del.atacante' },
    });
    expect(r.statusCode).toBe(403);
    const p = await prisma.propietario.findUniqueOrThrow({ where: { id: OWN } });
    expect(p.cbuAlias).toBe('morales.silvana.mp');
  });

  it('cambiarle el email de acceso al portal con CARGA → 403', async () => {
    // Es la credencial: con el email reescrito, el OTP del portal llega a la casilla nueva.
    const r = await app.inject({
      method: 'PUT', url: `/propietarios/${OWN}`, headers: auth(tCARGA),
      payload: { nombre: 'Silvana', apellido: 'Morales', email: 'atacante@ejemplo.com' },
    });
    expect(r.statusCode).toBe(403);
    const p = await prisma.propietario.findUniqueOrThrow({ where: { id: OWN } });
    expect(p.email).toBe('silvana.morales@hotmail.com');
  });

  it('cambiarle la comisión con CARGA → 403', async () => {
    const r = await app.inject({
      method: 'PUT', url: `/propietarios/${OWN}`, headers: auth(tCARGA),
      payload: { nombre: 'Silvana', apellido: 'Morales', comisionPct: 0 },
    });
    expect(r.statusCode).toBe(403);
  });

  it('la cuenta de cobranza DIRECTA (la que ve el inquilino) con CARGA → 403', async () => {
    const r = await app.inject({
      method: 'PUT', url: `/propietarios/${OWN}/cuenta-cobranza-directa`, headers: auth(tCARGA),
      payload: { banco: 'Banco X', titular: 'Atacante', cbu: '0'.repeat(22), alias: 'atacante.cbu' },
    });
    expect(r.statusCode).toBe(403);
    expect(await prisma.cuentaCobranzaDirecta.findUnique({ where: { propietarioId: OWN } })).toBeNull();
  });

  it('un PUT parcial NO le borra el CBU al propietario', async () => {
    // Segundo bug, encontrado por el test de abajo sin buscarlo: `cbuAlias: d.cbuAlias || null`
    // se escribía SIEMPRE, así que un PUT que no mandara el campo le vaciaba el CBU. Y sin CBU
    // `POST /rendiciones` corta con 409: al dueño no se le puede rendir hasta que alguien lo
    // vuelva a cargar. Todo con un 200 y un toast de "actualizado".
    //
    // Es la MISMA mina que el email tenía documentada y arreglada al lado, y que nunca se
    // aplicó a los vecinos.
    const r = await app.inject({
      method: 'PUT', url: `/propietarios/${OWN}`, headers: auth(tOPERADOR),
      payload: { nombre: 'Silvana', apellido: 'Morales' }, // sin cbuAlias, sin email, sin teléfono
    });
    expect(r.statusCode).toBe(200);
    const p = await prisma.propietario.findUniqueOrThrow({ where: { id: OWN } });
    expect(p.cbuAlias).toBe('morales.silvana.mp');
    expect(p.email).toBe('silvana.morales@hotmail.com');
    expect(p.telefono).toBe('+54 11 5234 8765');
    expect(p.cuit).toBeTruthy();
  });

  it('un `null` EXPLÍCITO sí le saca el CBU: querer borrarlo es legítimo', async () => {
    const r = await app.inject({
      method: 'PUT', url: `/propietarios/${OWN}`, headers: auth(tOPERADOR),
      payload: { nombre: 'Silvana', apellido: 'Morales', cbuAlias: null },
    });
    expect(r.statusCode).toBe(200);
    expect((await prisma.propietario.findUniqueOrThrow({ where: { id: OWN } })).cbuAlias).toBeNull();
    await prisma.propietario.update({ where: { id: OWN }, data: { cbuAlias: 'morales.silvana.mp' } });
    await prisma.eventoAuditoria.deleteMany({ where: { tipo: 'PROPIETARIO_CUENTA_CAMBIADA', entidadId: OWN } });
  });

  it('el corte es ANCHO: CARGA tampoco edita el teléfono', async () => {
    // Este test decía lo contrario. El corte se resolvió del lado ancho —toda la ficha— por
    // simetría con el DELETE y el PATCH /activo, y porque un gate que depende de QUÉ campos
    // vinieron en el body hay que volver a pensarlo cada vez que alguien toca el zod.
    //
    // El costo está asumido: CARGA no puede arreglarle un typo al teléfono de un propietario.
    // Si eso molesta en el uso real, el lugar de la discusión es el gate, no este test.
    const r = await app.inject({
      method: 'PUT', url: `/propietarios/${OWN}`, headers: auth(tCARGA),
      payload: { nombre: 'Silvana', apellido: 'Morales', telefono: '+54 11 5234 0000' },
    });
    expect(r.statusCode).toBe(403);
    expect((await prisma.propietario.findUniqueOrThrow({ where: { id: OWN } })).telefono).toBe('+54 11 5234 8765');
  });

  it('un OPERADOR cambia el CBU y queda REGISTRADO con el valor viejo y el nuevo', async () => {
    const r = await app.inject({
      method: 'PUT', url: `/propietarios/${OWN}`, headers: auth(tOPERADOR),
      payload: { nombre: 'Silvana', apellido: 'Morales', cbuAlias: 'morales.silvana.nueva' },
    });
    expect(r.statusCode).toBe(200);
    const ev = await prisma.eventoAuditoria.findFirst({
      where: { tipo: 'PROPIETARIO_CUENTA_CAMBIADA', entidadId: OWN },
      orderBy: { fecha: 'desc' },
    });
    expect(ev, 'cambiar el CBU tiene que dejar autor').toBeTruthy();
    expect(ev?.detalle).toContain('morales.silvana.mp');
    expect(ev?.detalle).toContain('morales.silvana.nueva');
    // Y se limpia: la DB es compartida entre archivos.
    await prisma.propietario.update({ where: { id: OWN }, data: { cbuAlias: 'morales.silvana.mp' } });
    await prisma.eventoAuditoria.deleteMany({ where: { tipo: 'PROPIETARIO_CUENTA_CAMBIADA', entidadId: OWN } });
  });

  it('guardar la ficha SIN cambiar nada no ensucia la auditoría', async () => {
    // El diálogo del panel manda todos los campos en cada guardado. Si el rastro se escribiera
    // por cada PUT, la pantalla de auditoría se llenaría de ruido y el evento que importa
    // —el CBU que cambió— quedaría enterrado.
    const r = await app.inject({
      method: 'PUT', url: `/propietarios/${OWN}`, headers: auth(tOPERADOR),
      payload: { nombre: 'Silvana', apellido: 'Morales', email: 'silvana.morales@hotmail.com', cbuAlias: 'morales.silvana.mp' },
    });
    expect(r.statusCode).toBe(200);
    expect(await prisma.eventoAuditoria.count({ where: { tipo: 'PROPIETARIO_CUENTA_CAMBIADA', entidadId: OWN } })).toBe(0);
  });
});
