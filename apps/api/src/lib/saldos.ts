import { prisma } from '../db.js';

/**
 * Saldo pagado por liquidación. La FUENTE DE VERDAD de "cuánto se pagó" son los
 * pagos CONCILIADO (no un campo denormalizado en Liquidacion que podría driftear):
 * lo agregamos on-read. Lo usan los endpoints de lectura (/mis-liquidaciones,
 * /liquidaciones, /contratos/:id) para exponer montoPagado + saldo, sin lo cual
 * ni el inquilino ni el detalle del contrato podían ver el impacto de un pago
 * parcial (seguían mostrando el montoTotal completo).
 */
export async function montoPagadoPorLiquidacion(liqIds: string[]): Promise<Map<string, number>> {
  if (liqIds.length === 0) return new Map();
  const rows = await prisma.pago.groupBy({
    by: ['liquidacionId'],
    where: { liquidacionId: { in: liqIds }, estado: 'CONCILIADO' },
    _sum: { monto: true },
  });
  return new Map(rows.map((r) => [r.liquidacionId, Number(r._sum.monto ?? 0)]));
}

/**
 * Decora una liquidación con `montoPagado` (suma de conciliados) y `saldo`
 * (montoTotal − pagado, nunca negativo). `pagadoMap` sale de
 * montoPagadoPorLiquidacion; una liq sin pagos conciliados queda montoPagado=0.
 */
export function conSaldo<T extends { id: string; montoTotal: unknown }>(
  liq: T,
  pagadoMap: Map<string, number>,
): T & { montoPagado: number; saldo: number } {
  const montoPagado = pagadoMap.get(liq.id) ?? 0;
  return { ...liq, montoPagado, saldo: Math.max(0, Number(liq.montoTotal) - montoPagado) };
}
