/**
 * CUARTA AUDITORÍA · Tres defectos del mismo circuito: el link mágico del profesional.
 *
 * ── 1. `/listo` no era atómico ────────────────────────────────────────────────────────
 *
 * La transición a LISTO (con `listoAt`, `notaFinal` y `montoCobrado`) y el evento VISITA_LISTO
 * se escribían **fuera** de la transacción que cierra el reclamo e imputa el costo. Si
 * `imputarCostoReclamo` tiraba, la tx hacía rollback y el handler contestaba 409 — pero la
 * visita **ya había quedado en LISTO**. Y en el reintento `transicionar` devolvía
 * `transiciono: false` y el early-return respondía **200**: el reclamo no se cerraba nunca, el
 * costo no se imputaba nunca, y no quedaba ninguna señal de que faltó algo.
 *
 * El caso llega solo: basta con clasificar un reclamo con `pagador: 'DEPOSITO'` sobre un
 * contrato **sin depósito** —`/clasificar` no valida eso—. El profesional cierra, se come un
 * 409 redactado para la operadora del panel, toca de nuevo, ve "Trabajo cerrado", y los
 * $180.000 no se le cobran a nadie.
 *
 * ── 2. El JWT sobrevivía al vencimiento del link ──────────────────────────────────────
 *
 * Las reglas de vigencia (48 h post-LISTO, reclamo CERRADO o RECHAZADO, 60 días de antigüedad)
 * vivían **sólo** en `GET /visitas-publicas/:token`. El guard que revalida cada escritura no
 * miraba nada de eso: sólo que la visita existiera y coincidieran profesional y tenant. Una
 * sesión de tres días emitida antes seguía escribiendo cuando el link ya contestaba 410 —
 * incluido `POST /listo`, que imputa plata. `uploads.ts` sí revalidaba: el vecino que estaba
 * bien.
 *
 * ── 3. Las respuestas del profesional devolvían el token ──────────────────────────────
 *
 * Los cuatro endpoints devolvían la fila entera. Eso anula el "regenerar link": quien conserva
 * un JWT viejo lee el token NUEVO en la respuesta de cualquier escritura y vuelve a entrar.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): sacando `linkDeVisitaVencido` del
 * guard, el caso del reclamo RECHAZADO deja escribir. Volviendo la transición de `/listo`
 * afuera de la tx, el reintento contesta 200 con el reclamo abierto y sin imputar.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let inmobiliariaId = '';
/**
 * Contrato PROPIO y sin depósito, para el caso en que `imputarCostoReclamo` tiene que fallar.
 *
 * La primera versión de este archivo le ponía `depositoGarantia: null` a `cnt_001`, que es del
 * seed. Aunque lo restaurara al final, una corrida interrumpida lo dejaba roto — y pasó: con
 * el depósito en null, `imputar-reclamo-ya-cobrado.test.ts` empezó a fallar **en aislamiento**,
 * y el rojo se lee como una regresión del código bajo prueba. Un fixture propio no tiene ese
 * problema.
 */
let contratoSinDeposito = '';

const P = 'circ_';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar() {
  await prisma.cargoContrato.deleteMany({ where: { reclamoId: { startsWith: P } } });
  await prisma.visitaProfesional.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.reclamoEvento.deleteMany({ where: { reclamoId: { startsWith: P } } });
  await prisma.reclamo.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.profesional.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.liquidacion.deleteMany({ where: { contratoId: { startsWith: P } } });
  await prisma.contrato.deleteMany({ where: { id: { startsWith: P } } });
}

/** Un reclamo con su visita y su link, listo para que el profesional entre. */
async function armar(sufijo: string, opts: { estadoReclamo?: 'EN_CURSO' | 'RECHAZADO'; estadoVisita?: 'EN_CAMINO' | 'CONFIRMADA'; pagador?: 'DEPOSITO' | 'PROPIETARIO' } = {}) {
  const prof = await prisma.profesional.create({
    data: {
      id: `${P}prof${sufijo}`,
      inmobiliariaId,
      nombre: `Profesional ${sufijo}`,
      categoria: 'PLOMERO',
      zona: 'CABA',
      telefono: '11 4444 4444',
    },
  });
  const rec = await prisma.reclamo.create({
    data: {
      id: `${P}rec${sufijo}`,
      inmobiliariaId,
      contratoId: contratoSinDeposito,
      propiedadId: 'prp_001',
      categoria: 'PLOMERIA',
      urgencia: 'MEDIA',
      descripcion: `Reclamo ${sufijo} (cuarta auditoría)`,
      estado: opts.estadoReclamo ?? 'EN_CURSO',
      profesionalId: prof.id,
      ...(opts.pagador ? { pagador: opts.pagador } : {}),
    },
  });
  const visita = await prisma.visitaProfesional.create({
    data: {
      id: `${P}vis${sufijo}`,
      inmobiliariaId,
      reclamoId: rec.id,
      profesionalId: prof.id,
      token: `${P}token${sufijo}`,
      estado: opts.estadoVisita ?? 'EN_CAMINO',
      confirmadaAt: new Date(),
      ...(opts.estadoVisita === 'EN_CAMINO' ? { enCaminoAt: new Date() } : {}),
    },
  });
  return { reclamoId: rec.id, visitaId: visita.id, token: visita.token };
}

/** Canjea el link por la sesión de profesional. */
async function entrar(token: string): Promise<string> {
  const r = await app.inject({ method: 'GET', url: `/visitas-publicas/${token}` });
  expect(r.statusCode, `el canje de ${token} devolvió ${r.statusCode}`).toBe(200);
  // El campo es `sesion`, no `token`: el token es el del LINK y la respuesta no lo repite.
  return r.json().sesion as string;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const c = await prisma.contrato.create({
    data: {
      id: `${P}cnt`,
      inmobiliariaId,
      propiedadId: 'prp_001',
      monto: 300_000,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2099-12-31'),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
      estado: 'ACTIVO',
      moneda: 'ARS',
      moraTipo: 'SIN_MORA',
      // Sin depósito: es lo que hace fallar la imputación con `pagador: DEPOSITO`.
      depositoGarantia: null,
      // Y `devengarDesde` en 2099 para que el cron no le agregue cuotas.
      devengarDesde: new Date('2099-01-01'),
    },
  });
  contratoSinDeposito = c.id;
}, 420_000);

afterAll(async () => {
  // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('el link vencido no escribe, aunque la sesión siga viva', () => {
  it('🔴 con el reclamo RECHAZADO, el JWT ya emitido deja de servir', async () => {
    // Se entra con el reclamo vivo —el canje exige que lo esté— y después se rechaza.
    const { token, reclamoId } = await armar('A');
    const jwt = await entrar(token);
    await prisma.reclamo.update({ where: { id: reclamoId }, data: { estado: 'RECHAZADO' } });

    // El canje del link ya contesta 410…
    const canje = await app.inject({ method: 'GET', url: `/visitas-publicas/${token}` });
    expect(canje.statusCode).toBe(410);

    // …y ahora la sesión tampoco escribe. Con el bug: 200, y `/listo` imputaba plata.
    const r = await app.inject({
      method: 'POST',
      url: '/visitas-publicas/listo',
      headers: auth(jwt),
      payload: { notaFinal: 'Cerrado con un link muerto' },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json().message).toMatch(/venc/i);
  });

  it('y la visita no se movió', async () => {
    const v = await prisma.visitaProfesional.findUniqueOrThrow({ where: { id: `${P}visA` } });
    expect(v.estado).toBe('EN_CAMINO');
    expect(v.listoAt).toBeNull();
  });
});

describe('cerrar el trabajo es todo o nada', () => {
  it('🔴 si la imputación falla, la visita NO queda cerrada a medias', async () => {
    // `pagador: DEPOSITO` sobre un contrato sin depósito: `imputarCostoReclamo` tira.
    const { token } = await armar('B', { pagador: 'DEPOSITO' });
    const jwt = await entrar(token);

    const r = await app.inject({
      method: 'POST',
      url: '/visitas-publicas/listo',
      headers: auth(jwt),
      payload: { notaFinal: 'Arreglado', montoCobrado: 180000 },
    });
    // El 409 sigue estando: la imputación no se puede hacer.
    expect(r.statusCode).toBe(409);

    // Lo que cambia: la visita NO quedó en LISTO. Con el bug, sí — y el reintento devolvía
    // 200 sin imputar nunca.
    const v = await prisma.visitaProfesional.findUniqueOrThrow({ where: { id: `${P}visB` } });
    expect(v.estado).toBe('EN_CAMINO');
    expect(v.listoAt).toBeNull();
    expect(v.notaFinal).toBeNull();
  });

  it('ni deja el evento del cierre en la timeline', async () => {
    const ev = await prisma.reclamoEvento.count({
      where: { reclamoId: `${P}recB`, tipo: 'VISITA_LISTO' },
    });
    expect(ev).toBe(0);
  });

  it('y el reintento vuelve a intentarlo de verdad: sigue dando 409, no 200', async () => {
    // Con el bug: 200 y "Trabajo cerrado" en la pantalla del profesional, con el reclamo
    // abierto y el costo sin imputar. El silencio era el problema, no el 409.
    const jwt = await entrar(`${P}tokenB`);
    const r = await app.inject({
      method: 'POST',
      url: '/visitas-publicas/listo',
      headers: auth(jwt),
      payload: { notaFinal: 'Arreglado', montoCobrado: 180000 },
    });
    expect(r.statusCode).toBe(409);
    const rec = await prisma.reclamo.findUniqueOrThrow({ where: { id: `${P}recB` } });
    expect(rec.estado).toBe('EN_CURSO');
  });

  it('CONTROL POSITIVO — con el pagador que sí se puede imputar, cierra entero', async () => {
    const { token } = await armar('C', { pagador: 'PROPIETARIO' });
    const jwt = await entrar(token);
    const r = await app.inject({
      method: 'POST',
      url: '/visitas-publicas/listo',
      headers: auth(jwt),
      payload: { notaFinal: 'Listo el arreglo', montoCobrado: 50000 },
    });
    expect(r.statusCode).toBe(200);
    const v = await prisma.visitaProfesional.findUniqueOrThrow({ where: { id: `${P}visC` } });
    expect(v.estado).toBe('LISTO');
    const rec = await prisma.reclamo.findUniqueOrThrow({ where: { id: `${P}recC` } });
    expect(rec.estado).toBe('RESUELTO');
    expect(Number(rec.costoTrabajo)).toBe(50000);
    // Y el evento del cierre quedó, en la misma transacción.
    expect(await prisma.reclamoEvento.count({ where: { reclamoId: rec.id, tipo: 'VISITA_LISTO' } })).toBe(1);
  });
});

describe('las respuestas del profesional no le repiten el token', () => {
  it('regenerar el link no se anula solo', async () => {
    // Con el bug: el que conserva un JWT viejo leía el token NUEVO en la respuesta de
    // cualquier escritura y volvía a entrar.
    const { token } = await armar('D', { estadoVisita: 'CONFIRMADA' });
    const jwt = await entrar(token);
    const r = await app.inject({
      method: 'POST',
      url: '/visitas-publicas/en-camino',
      headers: auth(jwt),
      payload: {},
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().estado).toBe('EN_CAMINO'); // sigue devolviendo lo que la pantalla usa
    expect(r.json().token).toBeUndefined();
    expect(r.body).not.toContain(token);
  });
});
