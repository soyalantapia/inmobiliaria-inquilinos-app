import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { conSaldo, montoPagadoPorLiquidacion } from '../lib/saldos.js';

const r2c = (n: number) => Math.round(n * 100) / 100;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Una liquidación está "vencida" si su estado ya es VENCIDO, o si sigue impaga
 * (PENDIENTE/PARCIAL) y su vencimiento ya pasó. Replicado on-read (el barrido que
 * persiste VENCIDO no toca contratos no-ACTIVO → en contratos pasados hay que derivarlo,
 * no confiar en el estado guardado). Mismo criterio que core.ts.
 */
function liqVencida(l: { estado: string; fechaVencimiento: Date | string }, now: Date): boolean {
  if (l.estado === 'VENCIDO') return true;
  if (l.estado === 'PENDIENTE' || l.estado === 'PARCIAL') return new Date(l.fechaVencimiento) < now;
  return false;
}

/**
 * Salud de pago de una propiedad a lo largo de su vida: por cada contrato (actual +
 * histórico) — deuda impaga que quedó, cuotas vencidas, comportamiento de pago
 * (a tiempo vs tarde, días de atraso) y el depósito en custodia. Todo derivado on-read
 * (las liquidaciones/pagos de contratos pasados no se borran). Sin migración; archivo
 * aparte (no toca core.ts).
 */
export async function propiedadSaludPagoRoutes(app: FastifyInstance) {
  app.get('/propiedades/:id/salud-pago', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const { id } = request.params as { id: string };
    const now = new Date();

    const propiedad = await prisma.propiedad.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true },
    });
    if (!propiedad) return reply.code(404).send({ message: 'Propiedad inexistente' });

    const contratos = await prisma.contrato.findMany({
      where: { propiedadId: id, inmobiliariaId: u.inmobiliariaId },
      select: {
        id: true,
        moneda: true,
        estado: true,
        depositoGarantia: true,
        estadoDeposito: true,
        depositoDevueltoMonto: true,
        depositoDevueltoAt: true,
        inquilinoTitular: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fechaInicio: 'desc' },
    });
    const contratoIds = contratos.map((c) => c.id);

    const liqs = contratoIds.length
      ? await prisma.liquidacion.findMany({
          where: { contratoId: { in: contratoIds }, inmobiliariaId: u.inmobiliariaId },
          select: {
            id: true,
            contratoId: true,
            montoTotal: true,
            montoPunitorio: true,
            estado: true,
            fechaVencimiento: true,
            fechaPago: true,
          },
        })
      : [];
    const pagadoMap = await montoPagadoPorLiquidacion(liqs.map((l) => l.id));

    // Agregación por contrato.
    const porContrato = new Map<
      string,
      { deudaImpaga: number; cuotasVencidas: number; pagadas: number; aTiempo: number; tarde: number; diasAtrasoTotal: number }
    >();
    for (const c of contratoIds) {
      porContrato.set(c, { deudaImpaga: 0, cuotasVencidas: 0, pagadas: 0, aTiempo: 0, tarde: 0, diasAtrasoTotal: 0 });
    }
    for (const l of liqs) {
      const agg = porContrato.get(l.contratoId);
      if (!agg) continue;
      const dec = conSaldo(l, pagadoMap, Number(l.montoPunitorio));
      if (liqVencida(l, now) && dec.saldo > 0) {
        agg.deudaImpaga += dec.saldo;
        agg.cuotasVencidas += 1;
      }
      // Comportamiento de pago: una cuota PAGADO cerró en fechaPago → comparamos con
      // el vencimiento (a tiempo si pagó antes o el mismo día).
      if (l.estado === 'PAGADO' && l.fechaPago) {
        agg.pagadas += 1;
        const dias = Math.floor((new Date(l.fechaPago).getTime() - new Date(l.fechaVencimiento).getTime()) / DIA_MS);
        if (dias > 0) {
          agg.tarde += 1;
          agg.diasAtrasoTotal += dias;
        } else {
          agg.aTiempo += 1;
        }
      }
    }

    const deudaPorMoneda = new Map<string, number>();
    let totCuotasVencidas = 0;
    let totPagadas = 0;
    let totATiempo = 0;
    let totTarde = 0;

    const salida = contratos.map((c) => {
      const a = porContrato.get(c.id)!;
      const deudaImpaga = r2c(a.deudaImpaga);
      if (deudaImpaga > 0) deudaPorMoneda.set(c.moneda, r2c((deudaPorMoneda.get(c.moneda) ?? 0) + deudaImpaga));
      totCuotasVencidas += a.cuotasVencidas;
      totPagadas += a.pagadas;
      totATiempo += a.aTiempo;
      totTarde += a.tarde;
      return {
        contratoId: c.id,
        inquilino: c.inquilinoTitular
          ? `${c.inquilinoTitular.nombre ?? ''} ${c.inquilinoTitular.apellido ?? ''}`.trim()
          : '',
        estado: c.estado,
        moneda: c.moneda,
        deudaImpaga,
        cuotasVencidas: a.cuotasVencidas,
        cuotasPagadas: a.pagadas,
        pagadasATiempo: a.aTiempo,
        pagadasTarde: a.tarde,
        diasAtrasoPromedio: a.pagadas ? Math.round(a.diasAtrasoTotal / a.pagadas) : 0,
        puntualidadPct: a.pagadas ? r2c((a.aTiempo / a.pagadas) * 100) : null,
        deposito:
          Number(c.depositoGarantia ?? 0) > 0
            ? {
                monto: Number(c.depositoGarantia),
                estado: c.estadoDeposito,
                devueltoMonto: c.depositoDevueltoMonto != null ? Number(c.depositoDevueltoMonto) : null,
                devueltoAt: c.depositoDevueltoAt,
              }
            : null,
      };
    });

    return {
      totales: {
        deudaImpagaPorMoneda: Object.fromEntries(deudaPorMoneda),
        cuotasVencidas: totCuotasVencidas,
        cuotasPagadas: totPagadas,
        pagadasATiempo: totATiempo,
        pagadasTarde: totTarde,
        puntualidadPct: totPagadas ? r2c((totATiempo / totPagadas) * 100) : null,
      },
      contratos: salida,
    };
  });
}
