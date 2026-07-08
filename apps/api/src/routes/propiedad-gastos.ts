import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';

const r2c = (n: number) => Math.round(n * 100) / 100;

/**
 * Gastos / mantenimiento invertido en una propiedad a lo largo de su vida: los
 * MovimientoCaja de tipo GASTO imputados a la propiedad (`propiedadId`, ya indexado),
 * con total y desglose por categoría. Es "cuánto se gastó en esta propiedad". Sin
 * migración; archivo aparte (no toca plata.ts, que tiene el alta de gastos).
 */
export async function propiedadGastosRoutes(app: FastifyInstance) {
  app.get('/propiedades/:id/gastos', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const { id } = request.params as { id: string };

    const propiedad = await prisma.propiedad.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true },
    });
    if (!propiedad) return reply.code(404).send({ message: 'Propiedad inexistente' });

    const movimientos = await prisma.movimientoCaja.findMany({
      where: { propiedadId: id, inmobiliariaId: u.inmobiliariaId, tipo: 'GASTO' },
      select: {
        id: true,
        categoria: true,
        descripcion: true,
        monto: true,
        fecha: true,
        proveedor: true,
        contratoId: true,
        comprobanteUrl: true,
      },
      orderBy: { fecha: 'desc' },
    });

    let total = 0;
    const porCategoria = new Map<string, { monto: number; cantidad: number }>();
    for (const m of movimientos) {
      const monto = Number(m.monto);
      total += monto;
      const cat = porCategoria.get(m.categoria) ?? { monto: 0, cantidad: 0 };
      cat.monto += monto;
      cat.cantidad += 1;
      porCategoria.set(m.categoria, cat);
    }

    return {
      total: r2c(total),
      cantidad: movimientos.length,
      porCategoria: Object.fromEntries(
        [...porCategoria.entries()].map(([cat, v]) => [cat, { monto: r2c(v.monto), cantidad: v.cantidad }]),
      ),
      gastos: movimientos.map((m) => ({
        id: m.id,
        categoria: m.categoria,
        descripcion: m.descripcion,
        monto: Number(m.monto),
        fecha: m.fecha,
        proveedor: m.proveedor,
        contratoId: m.contratoId,
        comprobanteUrl: m.comprobanteUrl,
      })),
    };
  });
}
