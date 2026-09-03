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
    const u = await requireUsuario(request, reply, 'caja.ver');
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
        moneda: true,
        fecha: true,
        proveedor: true,
        contratoId: true,
        comprobanteUrl: true,
      },
      orderBy: { fecha: 'desc' },
    });

    // POR MONEDA, no un solo número. Antes `total` y `porCategoria` sumaban pesos con dólares
    // —el `select` ni siquiera traía `moneda`— y el panel lo imprimía con `formatMonto(..., 'ARS')`:
    // una plomería de US$ 800 y una expensa de $ 45.000 salían como «$ 45.800».
    // Mismo formato que `propiedad-ganancias.ts`, que ya devuelve `totalesPorMoneda`.
    const porMoneda = new Map<string, number>();
    const porCategoria = new Map<string, { monto: number; cantidad: number; moneda: string }>();
    for (const m of movimientos) {
      const monto = Number(m.monto);
      porMoneda.set(m.moneda, (porMoneda.get(m.moneda) ?? 0) + monto);
      const clave = `${m.categoria}|${m.moneda}`;
      const cat = porCategoria.get(clave) ?? { monto: 0, cantidad: 0, moneda: m.moneda };
      cat.monto += monto;
      cat.cantidad += 1;
      porCategoria.set(clave, cat);
    }

    return {
      totalesPorMoneda: [...porMoneda.entries()].map(([moneda, monto]) => ({ moneda, monto: r2c(monto) })),
      cantidad: movimientos.length,
      porCategoria: Object.fromEntries(
        [...porCategoria.entries()].map(([clave, v]) => [clave, { monto: r2c(v.monto), cantidad: v.cantidad, moneda: v.moneda }]),
      ),
      gastos: movimientos.map((m) => ({
        id: m.id,
        categoria: m.categoria,
        moneda: m.moneda,
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
