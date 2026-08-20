/**
 * T-65 · El reclamo que cerró el profesional sin pagador dejaba el costo sin cobrarle a nadie.
 *
 * EL CASO. `POST /visitas-publicas/listo` —el profesional por link mágico— escribe
 * `costoTrabajo` y pone el reclamo en RESUELTO. Pero el `pagador` sólo lo escriben
 * `/reclamos/:id/clasificar` y `/reclamos/:id/resolver`, y los dos rebotaban con 409 una vez
 * cerrado. Con `pagador: null`, `imputarCostoReclamo` hace early-return: **no se le cobra a
 * nadie**. No aparece en `/mis-cargos`, no descuenta del depósito, y la rendición lo ignora
 * porque no es PROPIETARIO. El costo del arreglo se evapora, y quedaba irrecuperable.
 *
 * Y NO ES UN CASO RARO. El diálogo de asignar profesional del panel
 * (`asignar-profesional-dialog.tsx`) pega directo a `/reclamos/:id/asignar` y abre el WhatsApp
 * con el link mágico sin pasar nunca por la clasificación — la card de asignar ni siquiera está
 * deshabilitada cuando falta el pagador. O sea que `pagador: null` es el **default del camino
 * más rápido** para mandar un profesional.
 *
 * EL RESCATE va en `/clasificar` y no relajando `/resolver`, porque `/resolver` incrementa
 * `cantTrabajos` (que `/listo` ya incrementó → +2 trabajos por uno), pisa `resueltoAt` —ancla
 * del SLA y filtro de período de la rendición— y manda un segundo mail al inquilino.
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
let token = '';
const auth = () => ({ authorization: `Bearer ${token}` });

let reclamoId = '';
let contratoId = '';

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const r = await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'luciana@delsol.com', password: 'delsol123' }, // OPERADOR
  });
  token = r.json().token;

  const contrato = await prisma.contrato.findFirst({ select: { id: true, inmobiliariaId: true } });
  if (!contrato) return;
  contratoId = contrato.id;
  // El estado EXACTO que deja /visitas-publicas/listo: RESUELTO, con costo, sin pagador.
  const rec = await prisma.reclamo.create({
    data: {
      inmobiliariaId: contrato.inmobiliariaId,
      contratoId: contrato.id,
      categoria: 'PLOMERIA',
      descripcion: 'T-65 — pérdida en la cocina, cerrada por el profesional',
      urgencia: 'MEDIA',
      estado: 'RESUELTO',
      resueltoAt: new Date(),
      costoTrabajo: 50_000,
      // pagador queda null: es el agujero.
    },
  });
  reclamoId = rec.id;
});

afterAll(async () => {
  if (reclamoId) {
    await prisma.cargoContrato.deleteMany({ where: { reclamoId } }).catch(() => {});
    await prisma.reclamoEvento.deleteMany({ where: { reclamoId } }).catch(() => {});
    await prisma.reclamo.delete({ where: { id: reclamoId } }).catch(() => {});
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('T-65 — rescatar el cierre sin pagador', () => {
  it('el escenario se armó', () => {
    expect(reclamoId).not.toBe('');
  });

  it('antes de clasificar no hay ningún cargo: la plata no se le cobró a nadie', async () => {
    const cargo = await prisma.cargoContrato.findUnique({ where: { reclamoId } });
    expect(cargo).toBeNull();
  });

  it('clasificar un RESUELTO sin pagador ahora se acepta', async () => {
    const r = await app.inject({
      method: 'POST', url: `/reclamos/${reclamoId}/clasificar`, headers: auth(),
      payload: { pagador: 'INQUILINO' },
    });
    // Con el bug: 409 "El reclamo ya está cerrado. Reabrilo antes de cambiar quién paga."
    expect(r.statusCode).toBe(200);
  });

  it('y AHORA sí existe el cargo, por el monto que declaró el profesional', async () => {
    const cargo = await prisma.cargoContrato.findUnique({ where: { reclamoId } });
    expect(cargo).not.toBeNull();
    expect(Number(cargo!.monto)).toBe(50_000);
    expect(cargo!.contraDeposito).toBe(false);
    expect(cargo!.contratoId).toBe(contratoId);
  });

  it('reclasificar de nuevo NO duplica el cargo: el helper es idempotente por reclamoId', async () => {
    const r = await app.inject({
      method: 'POST', url: `/reclamos/${reclamoId}/clasificar`, headers: auth(),
      payload: { pagador: 'PROPIETARIO' },
    });
    // Ya tiene pagador, así que deja de ser el caso de rescate y vuelve a regir el guard de
    // estado: el reclamo está cerrado ⇒ 409. Lo que importa es que no se duplicó nada.
    expect(r.statusCode).toBe(409);
    const cargos = await prisma.cargoContrato.findMany({ where: { reclamoId } });
    expect(cargos).toHaveLength(1);
  });

  it('un reclamo cerrado CON pagador sigue sin poder reclasificarse', async () => {
    const otro = await prisma.reclamo.create({
      data: {
        inmobiliariaId: (await prisma.contrato.findFirstOrThrow({ select: { inmobiliariaId: true } })).inmobiliariaId,
        contratoId, categoria: 'OTRO', descripcion: 'T-65 control', urgencia: 'BAJA',
        estado: 'RESUELTO', costoTrabajo: 10_000, pagador: 'PROPIETARIO',
      },
    });
    const r = await app.inject({
      method: 'POST', url: `/reclamos/${otro.id}/clasificar`, headers: auth(),
      payload: { pagador: 'INQUILINO' },
    });
    expect(r.statusCode).toBe(409);
    await prisma.reclamo.delete({ where: { id: otro.id } }).catch(() => {});
  });
});
