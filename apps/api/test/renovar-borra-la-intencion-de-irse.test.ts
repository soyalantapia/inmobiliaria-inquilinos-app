/**
 * CUARTA AUDITORÍA · Renovar un contrato no limpiaba la intención NO_RENOVAR.
 *
 * EL DEFECTO. `IntencionRenovacion` es 1:1 con el contrato y su único writer era
 * `POST /renovaciones/:contratoId/decision`. La transacción de `POST /contratos/:id/renovar`
 * extiende `fechaFin`, fija el canon, reajusta cuotas y devenga los períodos nuevos — y no la
 * tocaba. Quedaba un contrato ACTIVO con plazo extendido y, colgada, una intención NO_RENOVAR
 * con una `fechaEgreso` que ya no va a pasar.
 *
 * LO QUE SE VE. En `/renovaciones` el contrato sigue contando en el KPI **"No renuevan"**, y su
 * tarjeta muestra *"Vence 31/08/2028"* y *"Se va el 30/09/2026"* una al lado de la otra, con el
 * badge "No renueva". El expediente de la propiedad también sigue empujando el hito "Aviso de
 * egreso del inquilino", que filtra sólo por `fechaEgreso != null`.
 *
 * EL VECINO QUE YA LO HACÍA BIEN. El propio endpoint de decisión (`operacion.ts:2148`) limpia
 * `fechaEgreso` cuando la decisión deja de ser NO_RENOVAR, «para que no quede una fecha huérfana
 * de un cambio de opinión». Renovar es exactamente ese cambio de opinión.
 *
 * POR QUÉ SIN_RESPUESTA Y NO RENOVAR. Ver el comentario del arreglo en `core.ts`: escribir
 * RENOVAR arreglaría el síntoma de hoy y crearía el mismo defecto con el signo cambiado —una
 * decisión que nadie tomó sobre el plazo NUEVO—. Queda anotado en `PARA-ALAN.md` por si se
 * prefiere lo otro.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

let app: FastifyInstance;
let tAdmin = '';
const prisma = new PrismaClient();
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const PIN_ADMIN = '1234';
let contrato: { id: string; inmobiliariaId: string; propiedadId: string | null; fechaFin: Date; monto: number };

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  const c = await prisma.contrato.findFirstOrThrow({
    where: { id: 'cnt_001' },
    select: { id: true, inmobiliariaId: true, propiedadId: true, fechaFin: true, monto: true },
  });
  contrato = { ...c, monto: Number(c.monto) };
}, 420_000);

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await restaurarContrato();
  await app.close();
  await prisma.$disconnect();
});

/**
 * La intención es 1:1 con el contrato: no se puede crear una "de prueba" al lado. Se borra
 * antes de cada caso y se restaura el contrato al final, porque renovar PISA `fechaFin` y
 * `monto` del contrato del seed y eso lo comparten los demás archivos del suite.
 */
async function limpiar(): Promise<void> {
  await prisma.intencionRenovacion.deleteMany({ where: { contratoId: contrato.id } });
  await restaurarContrato();
}

async function restaurarContrato(): Promise<void> {
  await prisma.contrato.update({
    where: { id: contrato.id },
    data: { fechaFin: contrato.fechaFin, monto: contrato.monto },
  });
  await prisma.renovacionContrato.deleteMany({ where: { contratoId: contrato.id, motivo: 'QA renovar intencion' } });
}

const FECHA_EGRESO = new Date('2026-09-30T00:00:00.000Z');

async function anotarNoRenueva() {
  const r = await app.inject({
    method: 'POST',
    url: `/renovaciones/${contrato.id}/decision`,
    headers: auth(tAdmin),
    payload: {
      decision: 'NO_RENOVAR',
      notas: 'Se muda a Rosario',
      fechaEgreso: FECHA_EGRESO.toISOString(),
      pin: PIN_ADMIN,
    },
  });
  expect(r.statusCode).toBe(200);
}

async function renovar() {
  const nuevaFin = new Date(contrato.fechaFin.getTime());
  nuevaFin.setUTCFullYear(nuevaFin.getUTCFullYear() + 2);
  const r = await app.inject({
    method: 'POST',
    url: `/contratos/${contrato.id}/renovar`,
    headers: auth(tAdmin),
    payload: {
      fechaFinNueva: nuevaFin.toISOString(),
      montoNuevo: contrato.monto + 100_000,
      montoDesde: '2099-01',
      motivo: 'QA renovar intencion',
    },
  });
  expect(r.statusCode, `renovar devolvió ${r.statusCode}: ${r.body.slice(0, 200)}`).toBe(200);
  return nuevaFin;
}

const intencion = () => prisma.intencionRenovacion.findUnique({ where: { contratoId: contrato.id } });

describe('renovar limpia la intención de irse', () => {
  it('🔴 después de renovar, el contrato no sigue contando como "no renueva"', async () => {
    await anotarNoRenueva();
    await renovar();

    const i = await intencion();
    expect(i, 'la fila tiene que seguir existiendo, sólo cambiada').toBeTruthy();
    // Con el bug: seguía en NO_RENOVAR y el KPI "No renuevan" lo contaba.
    expect(i!.decision).not.toBe('NO_RENOVAR');
  });

  it('🔴 y la tarjeta deja de decir "se va el 30/09" al lado de la nueva fecha de vencimiento', async () => {
    await anotarNoRenueva();
    const nuevaFin = await renovar();

    const i = await intencion();
    // Con el bug: `fechaEgreso` seguía puesta y la tarjeta mostraba las dos fechas juntas.
    expect(i!.fechaEgreso).toBeNull();
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: contrato.id }, select: { fechaFin: true } });
    expect(c.fechaFin.toISOString().slice(0, 10)).toBe(nuevaFin.toISOString().slice(0, 10));
  });

  it('🔴 el expediente deja de empujar el hito "Aviso de egreso del inquilino"', async () => {
    // El hito filtra SÓLO por `fechaEgreso != null` (`propiedad-timeline.ts:103`), así que la
    // fecha huérfana lo mantenía vivo para siempre.
    await anotarNoRenueva();
    const antes = await app.inject({
      method: 'GET',
      url: `/propiedades/${contrato.propiedadId}/timeline`,
      headers: auth(tAdmin),
    });
    expect(antes.json().eventos.some((e: { tipo: string }) => e.tipo === 'AVISO_EGRESO')).toBe(true);

    await renovar();

    const despues = await app.inject({
      method: 'GET',
      url: `/propiedades/${contrato.propiedadId}/timeline`,
      headers: auth(tAdmin),
    });
    expect(despues.json().eventos.some((e: { tipo: string }) => e.tipo === 'AVISO_EGRESO')).toBe(false);
  });

  it('el comentario de la decisión vieja tampoco sobrevive', async () => {
    // "Se muda a Rosario" describe un plan que ya no va a pasar: dejarlo colgado de la
    // intención nueva es la misma clase de mentira que la fecha.
    await anotarNoRenueva();
    await renovar();
    const i = await intencion();
    expect(i!.comentario).toBeNull();
    expect(i!.decididoAt).toBeNull();
  });

  it('CONTROL POSITIVO — renovar un contrato sin intención registrada no inventa una', async () => {
    // Nadie anotó nada: renovar es un hecho del contrato, no una decisión que alguien haya
    // dicho. Inventar la fila sería llenar la pantalla de decisiones que nunca se tomaron.
    expect(await intencion()).toBeNull();
    await renovar();
    expect(await intencion()).toBeNull();
  });

  it('CONTROL POSITIVO — una intención de OTRO contrato no se toca', async () => {
    const otro = await prisma.contrato.findFirstOrThrow({
      where: { inmobiliariaId: contrato.inmobiliariaId, id: { not: contrato.id }, estado: 'ACTIVO' },
      select: { id: true },
    });
    await prisma.intencionRenovacion.deleteMany({ where: { contratoId: otro.id } });
    await prisma.intencionRenovacion.create({
      data: {
        inmobiliariaId: contrato.inmobiliariaId,
        contratoId: otro.id,
        decision: 'NO_RENOVAR',
        fechaEgreso: FECHA_EGRESO,
        decididoAt: new Date(),
      },
    });
    try {
      await anotarNoRenueva();
      await renovar();
      const ajeno = await prisma.intencionRenovacion.findUniqueOrThrow({ where: { contratoId: otro.id } });
      expect(ajeno.decision).toBe('NO_RENOVAR');
      expect(ajeno.fechaEgreso).not.toBeNull();
    } finally {
      await prisma.intencionRenovacion.deleteMany({ where: { contratoId: otro.id } });
    }
  });
});
