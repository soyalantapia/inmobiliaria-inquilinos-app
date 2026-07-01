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
 * Decora una liquidación con `montoPagado` (suma de conciliados), `montoPunitorio`
 * (mora al día, calculada por el caller) y `saldo` (total exigible − pagado, nunca
 * negativo). `pagadoMap` sale de montoPagadoPorLiquidacion.
 *
 * IMPORTANTE: el `montoTotal` devuelto es el TOTAL EXIGIBLE = base (montoTotal de la
 * DB) + `punitorio`. Así el front del inquilino (que hace montoOriginal = montoTotal
 * − montoPunitorio y totalAPagar = montoTotal) muestra base + mora sin cambios.
 * `punitorio` default 0 → sin mora (contratos sin tasa / endpoints que no la aplican).
 */
export function conSaldo<T extends { id: string; montoTotal: unknown }>(
  liq: T,
  pagadoMap: Map<string, number>,
  punitorio = 0,
): T & { montoPunitorio: number; montoTotal: number; montoPagado: number; saldo: number } {
  const montoPagado = pagadoMap.get(liq.id) ?? 0;
  const total = Math.round((Number(liq.montoTotal) + punitorio) * 100) / 100;
  return {
    ...liq,
    montoPunitorio: punitorio,
    montoTotal: total,
    montoPagado,
    saldo: Math.max(0, Math.round((total - montoPagado) * 100) / 100),
  };
}
