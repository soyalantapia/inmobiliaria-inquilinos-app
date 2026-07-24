import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';

/**
 * Cuentas de caja (pedido de Camila): la inmobiliaria define sus cuentas a gusto
 * ("Gaspar Mercado Pago", "efectivo", "Líder"…), cada una con una dirección permitida
 * (solo entrada / solo salida / ambas). Cada movimiento de caja sale de / entra a una,
 * y acá se ven los totales por cuenta. SOLO el admin las define (la cajera no las toca).
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const DIRECCION = z.enum(['ENTRADA', 'SALIDA', 'AMBAS']);

export async function cuentasRoutes(app: FastifyInstance) {
  // Lista de cuentas con su total: entradas (INGRESO_EXTRA), salidas (GASTO) y saldo.
  app.get('/cuentas', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'cuentas.ver');
    if (!u) return;
    const cuentas = await prisma.cuentaCaja.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      orderBy: [{ activa: 'desc' }, { nombre: 'asc' }],
    });
    const agg = await prisma.movimientoCaja.groupBy({
      by: ['cuentaId', 'tipo'],
      where: { inmobiliariaId: u.inmobiliariaId, cuentaId: { not: null } },
      _sum: { monto: true },
    });
    const totales = new Map<string, { entradas: number; salidas: number }>();
    for (const a of agg) {
      if (!a.cuentaId) continue;
      const t = totales.get(a.cuentaId) ?? { entradas: 0, salidas: 0 };
      const monto = Number(a._sum.monto ?? 0);
      if (a.tipo === 'INGRESO_EXTRA') t.entradas += monto;
      else if (a.tipo === 'GASTO') t.salidas += monto;
      totales.set(a.cuentaId, t);
    }
    return cuentas.map((c) => {
      const t = totales.get(c.id) ?? { entradas: 0, salidas: 0 };
      return {
        id: c.id,
        nombre: c.nombre,
        direccion: c.direccion,
        activa: c.activa,
        entradas: r2(t.entradas),
        salidas: r2(t.salidas),
        saldo: r2(t.entradas - t.salidas),
        cantidadMovimientos: 0, // (el detalle por movimiento va en /cuentas/:id/movimientos)
      };
    });
  });

  // Los movimientos de UNA cuenta (para ver el detalle de sus entradas y salidas).
  app.get('/cuentas/:id/movimientos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'cuentas.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    const cuenta = await prisma.cuentaCaja.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!cuenta) return reply.code(404).send({ message: 'Cuenta inexistente' });
    const movimientos = await prisma.movimientoCaja.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, cuentaId: id },
      select: {
        id: true,
        tipo: true,
        categoria: true,
        descripcion: true,
        monto: true,
        fecha: true,
        proveedor: true,
        propiedad: { select: { direccion: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 200,
    });
    return movimientos.map((m) => ({ ...m, monto: Number(m.monto) }));
  });

  // Crear una cuenta — SOLO admin (la cajera no define cuentas).
  app.post('/cuentas', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'cuentas.gestionar');
    if (!u) return;
    const body = z
      .object({ nombre: z.string().trim().min(2).max(80), direccion: DIRECCION.default('AMBAS') })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Poné un nombre de al menos 2 letras' });
    const cuenta = await prisma.cuentaCaja.create({
      data: { inmobiliariaId: u.inmobiliariaId, nombre: body.data.nombre, direccion: body.data.direccion },
    });
    return reply.code(201).send(cuenta);
  });

  // Editar nombre / dirección / archivar.
  app.patch('/cuentas/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'cuentas.gestionar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({
        nombre: z.string().trim().min(2).max(80).optional(),
        direccion: DIRECCION.optional(),
        activa: z.boolean().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos inválidos' });
    const cuenta = await prisma.cuentaCaja.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!cuenta) return reply.code(404).send({ message: 'Cuenta inexistente' });
    return prisma.cuentaCaja.update({ where: { id }, data: body.data });
  });

  // Borrar: si la cuenta ya tiene movimientos, se ARCHIVA (activa=false) para no romper
  // el historial de caja; si nunca se usó, se elimina de verdad.
  app.delete('/cuentas/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'cuentas.gestionar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const cuenta = await prisma.cuentaCaja.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!cuenta) return reply.code(404).send({ message: 'Cuenta inexistente' });
    const nMov = await prisma.movimientoCaja.count({ where: { cuentaId: id } });
    if (nMov > 0) {
      await prisma.cuentaCaja.update({ where: { id }, data: { activa: false } });
      return { archivada: true, movimientos: nMov };
    }
    await prisma.cuentaCaja.delete({ where: { id } });
    return { eliminada: true };
  });
}
