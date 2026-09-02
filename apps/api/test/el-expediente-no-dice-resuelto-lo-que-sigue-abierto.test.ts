/**
 * CUARTA AUDITORÍA · El expediente de la propiedad decía "Reclamo resuelto" para reclamos que
 * estaban abiertos ese mismo día.
 *
 * EL ESTADO QUE EL TIMELINE NO CONOCÍA. `resueltoAt` no significa "está resuelto": significa
 * "se resolvió alguna vez". Un reclamo REABIERTO —por PERSISTE del inquilino
 * (`operacion.ts:1097`) o por `POST /reclamos/:id/reabrir`— vuelve a EN_CURSO **conservando
 * `resueltoAt` a propósito**: es el ancla con la que `evaluarSla` reinicia el reloj, y los dos
 * lugares lo dejan escrito. O sea que "estado activo + `resueltoAt` no nulo" es un estado
 * declarado del sistema, no una inconsistencia.
 *
 * `propiedad-timeline.ts` no lo sabía: empujaba el hito mirando ÚNICAMENTE `resueltoAt`, y su
 * `select` ni siquiera traía `estado`. La operadora abría la ficha de la propiedad y el último
 * hito decía "Reclamo resuelto — 12/08/2026", sin ninguna marca de que el inquilino lo había
 * reabierto. Peor: un reclamo resuelto → reabierto → RECHAZADO figuraba para siempre como
 * resuelto, porque `/rechazar` tampoco limpia `resueltoAt`.
 *
 * LO QUE ESTOS CASOS FIJAN. Los tres caminos que producen esa combinación, cada uno con el
 * texto que la pantalla tiene que mostrar; y —lo que evita que el arreglo sea una amputación—
 * que el hito NO desaparezca: se sigue mostrando con la fecha real de la resolución y dice que
 * después se reabrió. La historia no se pierde; deja de mentir el estado.
 *
 * EL VECINO QUE YA LO HACÍA BIEN: `metricas.ts:200-204` y `plata.ts:2482-2488` exigen
 * `estado: { in: ['RESUELTO','CERRADO'] }` además del rango de `resueltoAt`. Es literalmente
 * el mismo criterio que se aplica acá.
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

const PREFIJO = 'QA expediente reabierto';
let contrato: { id: string; inmobiliariaId: string; propiedadId: string };

interface Hito {
  fecha: string;
  tipo: string;
  titulo: string;
  detalle: string;
  contratoId: string;
}

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  contrato = await prisma.contrato.findFirstOrThrow({
    where: { id: 'cnt_001' },
    select: { id: true, inmobiliariaId: true, propiedadId: true },
  });
}, 420_000);

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

/** Limpia ANTES de cada caso: un test en rojo no llega a su limpieza y envenena a los que siguen. */
async function limpiar(): Promise<void> {
  const ids = (
    await prisma.reclamo.findMany({ where: { descripcion: { startsWith: PREFIJO } }, select: { id: true } })
  ).map((r) => r.id);
  if (!ids.length) return;
  await prisma.reclamoEvento.deleteMany({ where: { reclamoId: { in: ids } } });
  await prisma.confirmacionReclamo.deleteMany({ where: { reclamoId: { in: ids } } });
  await prisma.cargoContrato.deleteMany({ where: { reclamoId: { in: ids } } });
  await prisma.reclamo.deleteMany({ where: { id: { in: ids } } });
}

/** Un reclamo del contrato de prueba, en curso. */
async function nuevoReclamo(sufijo: string): Promise<string> {
  const r = await prisma.reclamo.create({
    data: {
      inmobiliariaId: contrato.inmobiliariaId,
      contratoId: contrato.id,
      propiedadId: contrato.propiedadId,
      categoria: 'PLOMERIA',
      urgencia: 'MEDIA',
      descripcion: `${PREFIJO} — ${sufijo}`,
      estado: 'EN_CURSO',
    },
  });
  return r.id;
}

async function resolver(id: string, resolucion: string) {
  const r = await app.inject({
    method: 'POST',
    url: `/reclamos/${id}/resolver`,
    headers: auth(tAdmin),
    payload: { resolucion },
  });
  expect(r.statusCode).toBe(200);
}

/** Los hitos del expediente que corresponden a UN reclamo, ya filtrados por su fecha de alta. */
async function hitosDe(reclamoId: string): Promise<Hito[]> {
  const rec = await prisma.reclamo.findUniqueOrThrow({
    where: { id: reclamoId },
    select: { createdAt: true, descripcion: true },
  });
  const r = await app.inject({
    method: 'GET',
    url: `/propiedades/${contrato.propiedadId}/timeline`,
    headers: auth(tAdmin),
  });
  expect(r.statusCode).toBe(200);
  const eventos = r.json().eventos as Hito[];
  // Los hitos de reclamo de ESTE reclamo: el de apertura trae la descripción, y los de cierre
  // caen en el mismo instante o después. Se acota por fecha para no barrer los del seed.
  return eventos.filter(
    (e) =>
      e.tipo.startsWith('RECLAMO') &&
      (e.detalle.startsWith(PREFIJO) || new Date(e.fecha).getTime() >= new Date(rec.createdAt).getTime()),
  );
}

describe('el expediente de la propiedad no da por resuelto lo que sigue abierto', () => {
  it('🔴 reabierto por el PANEL: el hito no dice "Reclamo resuelto" a secas', async () => {
    const id = await nuevoReclamo('canilla que gotea');
    await resolver(id, 'Se cambió la arandela');
    const reabrir = await app.inject({
      method: 'POST',
      url: `/reclamos/${id}/reabrir`,
      headers: auth(tAdmin),
      payload: { motivo: 'El monto del profesional estaba mal tipeado' },
    });
    expect(reabrir.statusCode).toBe(200);

    const hitos = await hitosDe(id);
    // Con el bug: el último hito era 'RECLAMO_RESUELTO' / "Reclamo resuelto", sin ninguna marca.
    expect(hitos.some((h) => h.tipo === 'RECLAMO_RESUELTO')).toBe(false);
  });

  it('🔴 reabierto por el INQUILINO (PERSISTE): tampoco', async () => {
    const id = await nuevoReclamo('sigue perdiendo agua');
    await resolver(id, 'Se ajustó el flexible');
    // El camino real del inquilino deja EN_CURSO conservando resueltoAt (operacion.ts:1097).
    await prisma.reclamo.update({ where: { id }, data: { estado: 'EN_CURSO' } });

    const hitos = await hitosDe(id);
    expect(hitos.some((h) => h.tipo === 'RECLAMO_RESUELTO')).toBe(false);
  });

  it('🔴 el caso peor: resuelto → reabierto → RECHAZADO figuraba resuelto para siempre', async () => {
    const id = await nuevoReclamo('humedad en el techo');
    await resolver(id, 'Se selló la junta');
    await app.inject({
      method: 'POST',
      url: `/reclamos/${id}/reabrir`,
      headers: auth(tAdmin),
      payload: { motivo: 'Vuelve a filtrar por el mismo lugar' },
    });
    const rech = await app.inject({
      method: 'POST',
      url: `/reclamos/${id}/rechazar`,
      headers: auth(tAdmin),
      payload: { motivo: 'Corresponde al consorcio, no a la propiedad' },
    });
    expect(rech.statusCode).toBe(200);
    // `/rechazar` no limpia resueltoAt: la fila queda RECHAZADO con la fecha de la resolución.
    const fila = await prisma.reclamo.findUniqueOrThrow({ where: { id }, select: { estado: true, resueltoAt: true } });
    expect(fila.estado).toBe('RECHAZADO');
    expect(fila.resueltoAt).not.toBeNull();

    const hitos = await hitosDe(id);
    expect(hitos.some((h) => h.tipo === 'RECLAMO_RESUELTO')).toBe(false);
  });

  it('la historia NO se pierde: el hito sigue estando, con la fecha real y diciendo que se reabrió', async () => {
    // Esto es lo que separa el arreglo de una amputación. El reclamo SE RESOLVIÓ el día que dice
    // —y esa resolución movió plata—, así que borrar el hito sería otra mentira. Lo que cambia es
    // que deja de presentarse como el estado actual.
    const id = await nuevoReclamo('cerradura trabada');
    await resolver(id, 'Se lubricó el bombín');
    const antes = await prisma.reclamo.findUniqueOrThrow({ where: { id }, select: { resueltoAt: true } });
    await app.inject({
      method: 'POST',
      url: `/reclamos/${id}/reabrir`,
      headers: auth(tAdmin),
      payload: { motivo: 'Volvió a trabarse a los dos días' },
    });

    const hitos = await hitosDe(id);
    const reapertura = hitos.find((h) => h.tipo === 'RECLAMO_REABIERTO');
    expect(reapertura).toBeTruthy();
    expect(reapertura!.titulo).toMatch(/reabierto/i);
    // La fecha es la de la resolución de verdad, no la de hoy: es el dato que tenemos.
    expect(reapertura!.fecha.slice(0, 10)).toBe(antes.resueltoAt!.toISOString().slice(0, 10));
    // Y el texto de aquella resolución sigue a la vista, que es lo que la operadora necesita leer.
    expect(reapertura!.detalle).toContain('Se lubricó el bombín');
  });

  it('CONTROL POSITIVO — un reclamo que SÍ está resuelto sigue mostrando su hito', async () => {
    const id = await nuevoReclamo('luz del palier quemada');
    await resolver(id, 'Se cambió la lámpara');

    const hitos = await hitosDe(id);
    const resuelto = hitos.find((h) => h.tipo === 'RECLAMO_RESUELTO');
    expect(resuelto).toBeTruthy();
    expect(resuelto!.titulo).toBe('Reclamo resuelto');
    expect(resuelto!.detalle).toContain('Se cambió la lámpara');
    expect(hitos.some((h) => h.tipo === 'RECLAMO_REABIERTO')).toBe(false);
  });

  it('CONTROL POSITIVO — un reclamo CERRADO por el inquilino también', async () => {
    const id = await nuevoReclamo('persiana atascada');
    await resolver(id, 'Se destrabó la cinta');
    // Conforme del inquilino: CERRADO, que es un cierre tan válido como RESUELTO.
    await prisma.reclamo.update({ where: { id }, data: { estado: 'CERRADO' } });

    const hitos = await hitosDe(id);
    expect(hitos.some((h) => h.tipo === 'RECLAMO_RESUELTO')).toBe(true);
  });

  it('un reclamo nunca resuelto no inventa ningún hito de cierre', async () => {
    const id = await nuevoReclamo('timbre sin sonido');
    const hitos = await hitosDe(id);
    expect(hitos.some((h) => h.tipo === 'RECLAMO_RESUELTO' || h.tipo === 'RECLAMO_REABIERTO')).toBe(false);
    expect(hitos.some((h) => h.tipo === 'RECLAMO_ABIERTO')).toBe(true);
  });
});
