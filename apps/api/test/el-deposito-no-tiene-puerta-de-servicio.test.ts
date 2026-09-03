/**
 * TERCERA AUDITORÍA · El depósito se resolvía con permiso de OPERADOR entrando por la baja.
 *
 * `POST /contratos/:id/deposito/resolver` (plata.ts) exige `deposito.devolver` —SÓLO ADMIN—
 * y lo dice al lado: "NO `contratos.crear`, que incluye a OPERADOR y CARGA. Devolver o
 * ejecutar el depósito mueve plata de un tercero y es irreversible".
 *
 * `POST /contratos/:id/finalizar` acepta EL MISMO body (`decisionDeposito` DEVOLVER/NETEAR/
 * EJECUTAR + monto), escribe LOS MISMOS campos y aplica la misma retención contra la deuda…
 * gateado con `contratos.crear`. La capacidad ADMIN existía y se saltaba entrando por la
 * puerta de al lado. Y el diálogo de baja del panel ofrecía los chips a cualquiera.
 *
 * Dos agravantes que van en el mismo arreglo:
 *  - No validaba que el depósito siguiera RETENIDO (el dedicado sí, con 409): resolver dos
 *    veces pisaba `depositoDevueltoMonto` y volvía a imputar la garantía contra la deuda.
 *  - No registraba UN SOLO evento de auditoría: ni del depósito, ni de la baja, ni de la
 *    penalidad. La acción más irreversible de la app era anónima.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): neutralizando el guard nuevo de
 * core.ts —`if (resuelveDeposito && !rolTienePermiso(u.rol, 'deposito.devolver'))`— el primer
 * caso pasa de 403 a 200 y el contrato de la OPERADORA queda RESCINDIDO con el depósito
 * DEVUELTO. Neutralizando el 409 de `estadoDeposito !== 'RETENIDO'`, el caso de la doble
 * resolución pasa de 409 a 200. Y sacando los `registrarEvento`, los dos últimos quedan en 0.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let tOperador = '';
let tAdmin = '';
let inmobiliariaId = '';
let idOperadora = '';

const DEPOSITO = 500_000;
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

// Cuatro contratos PROPIOS: finalizar es destructivo y esta base la comparten los 140
// archivos de la suite. Se apoyan en una propiedad existente, pero como NINGUNO es su
// `contratoActual`, el updateMany de la propiedad que hace finalizar no la toca.
let cOperadora = ''; // OPERADOR intenta resolver el depósito
let cOperadoraMantener = ''; // OPERADOR da de baja sin tocarlo (control positivo)
let cAdmin = ''; // ADMIN sí puede (control positivo)
let cYaResuelto = ''; // depósito ya devuelto antes de la baja

async function nuevoContrato(propiedadId: string, estadoDeposito: 'RETENIDO' | 'DEVUELTO') {
  const c = await prisma.contrato.create({
    data: {
      inmobiliariaId,
      propiedadId,
      monto: 300_000,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2027-12-31'),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 6,
      estado: 'ACTIVO',
      depositoGarantia: DEPOSITO,
      estadoDeposito,
      ...(estadoDeposito === 'DEVUELTO'
        ? { depositoDevueltoMonto: DEPOSITO, depositoDevueltoAt: new Date() }
        : {}),
    },
  });
  return c.id;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  const base = await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tOperador = await loginTest(app, 'luciana@delsol.com', 'delsol123');
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  // 🔴 SCOPEADO AL TENANT DEL SEED. Estaba SIN `where`: agarraba la primera propiedad de
  // CUALQUIER inmobiliaria. Mientras la base sólo tuvo el tenant del seed no se notó, pero
  // basta con que otro archivo cree una propiedad ajena —cosa legítima, es como se prueba el
  // aislamiento— para que este test la agarre y el endpoint conteste 404 con el token del
  // seed. El rojo aparece acá y la causa está en el archivo de al lado.
  const prop = await prisma.propiedad.findFirstOrThrow({ where: { inmobiliariaId: base.inmobiliariaId }, select: { id: true, inmobiliariaId: true } });
  inmobiliariaId = prop.inmobiliariaId;
  const luciana = await prisma.usuario.findFirstOrThrow({ where: { email: 'luciana@delsol.com' } });
  idOperadora = luciana.id;
  cOperadora = await nuevoContrato(prop.id, 'RETENIDO');
  cOperadoraMantener = await nuevoContrato(prop.id, 'RETENIDO');
  cAdmin = await nuevoContrato(prop.id, 'RETENIDO');
  cYaResuelto = await nuevoContrato(prop.id, 'DEVUELTO');
});

afterAll(async () => {
  const ids = [cOperadora, cOperadoraMantener, cAdmin, cYaResuelto].filter(Boolean);
  if (ids.length) {
    // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá y no
    // reaparecer dos archivos después como un "Unique constraint failed" sin relación.
    await prisma.eventoAuditoria.deleteMany({ where: { entidadId: { in: ids } } });
    await prisma.cargoContrato.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.pago.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.contrato.deleteMany({ where: { id: { in: ids } } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('la baja no es una puerta de servicio al depósito', () => {
  it('el escenario se armó', () => {
    expect([cOperadora, cOperadoraMantener, cAdmin, cYaResuelto].every(Boolean)).toBe(true);
    expect(idOperadora).not.toBe('');
  });

  it('OPERADOR no puede devolver el depósito entrando por finalizar', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${cOperadora}/finalizar`,
      headers: auth(tOperador),
      payload: { tipo: 'RESCINDIDO', decisionDeposito: 'DEVOLVER', montoDepositoDevuelto: DEPOSITO },
    });
    expect(r.statusCode).toBe(403); // con el bug: 200
    expect(r.json().message).toContain('Admin');
  });

  it('y el 403 corta ANTES de tocar nada: el contrato sigue vivo y la garantía retenida', async () => {
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: cOperadora } });
    expect(c.estado).toBe('ACTIVO');
    expect(c.estadoDeposito).toBe('RETENIDO');
    expect(c.depositoDevueltoAt).toBeNull();
  });

  it('CONTROL POSITIVO — el mismo OPERADOR sí da de baja eligiendo "Después"', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${cOperadoraMantener}/finalizar`,
      headers: auth(tOperador),
      payload: { tipo: 'RESCINDIDO', decisionDeposito: 'MANTENER', motivoRescision: 'Se muda' },
    });
    expect(r.statusCode).toBe(200);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: cOperadoraMantener } });
    expect(c.estado).toBe('RESCINDIDO');
    // El corte es sobre la DECISIÓN del depósito, no sobre la baja: la garantía queda
    // RETENIDA esperando a un Admin, que es justo lo que el mensaje del 403 le dice.
    expect(c.estadoDeposito).toBe('RETENIDO');
  });

  it('CONTROL POSITIVO — un ADMIN sí resuelve el depósito en la misma llamada', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${cAdmin}/finalizar`,
      headers: auth(tAdmin),
      payload: { tipo: 'FINALIZADO', decisionDeposito: 'DEVOLVER', montoDepositoDevuelto: DEPOSITO },
    });
    expect(r.statusCode).toBe(200);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: cAdmin } });
    expect(c.estado).toBe('FINALIZADO');
    expect(c.estadoDeposito).toBe('DEVUELTO');
  });

  it('un depósito YA resuelto no se vuelve a resolver por la baja', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/contratos/${cYaResuelto}/finalizar`,
      headers: auth(tAdmin),
      // NETEAR sobre un depósito ya devuelto: con el bug se imputaba la garantía contra la
      // deuda POR SEGUNDA VEZ (`estadoDepositoContrato` calcula bruto − cargos abiertos, no
      // sabe nada de la resolución anterior) y se pisaba la fecha de la devolución real.
      payload: { tipo: 'RESCINDIDO', decisionDeposito: 'NETEAR', montoDepositoDevuelto: 0 },
    });
    expect(r.statusCode).toBe(409); // con el bug: 200
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: cYaResuelto } });
    expect(c.estado).toBe('ACTIVO');
    expect(Number(c.depositoDevueltoMonto)).toBe(DEPOSITO); // no se pisó
  });

  it('la baja deja rastro de QUIÉN la hizo', async () => {
    const ev = await prisma.eventoAuditoria.findMany({ where: { entidadId: cOperadoraMantener } });
    const baja = ev.find((e) => e.tipo === 'CONTRATO_DADO_DE_BAJA');
    expect(baja).toBeTruthy(); // con el bug: la lista entera venía vacía
    expect(baja?.autorId).toBe(idOperadora);
    expect(baja?.entidadDescripcion).toContain('rescindido');
    expect(baja?.entidadDescripcion).toContain('Se muda');
  });

  it('y el depósito resuelto por la baja aparece con el mismo tipo que por la puerta dedicada', async () => {
    const ev = await prisma.eventoAuditoria.findMany({ where: { entidadId: cAdmin } });
    expect(ev.some((e) => e.tipo === 'CONTRATO_DADO_DE_BAJA')).toBe(true);
    // `deposito/resolver` escribe PAGO_CONCILIADO con "Depósito devuelto · …". Es el mismo
    // hecho por otra puerta: quien audite la garantía de un contrato tiene que encontrarlo
    // filtrando una sola cosa.
    const dep = ev.find((e) => e.entidadDescripcion.startsWith('Depósito devuelto'));
    expect(dep).toBeTruthy();
    expect(dep?.tipo).toBe('PAGO_CONCILIADO');
  });
});
