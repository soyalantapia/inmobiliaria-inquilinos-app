import { prisma } from '../db.js';

/**
 * Saldo pagado por liquidación. La FUENTE DE VERDAD de "cuánto se pagó" son los
 * pagos CONCILIADO (no un campo denormalizado en Liquidacion que podría driftear):
 * lo agregamos on-read. Lo usan los endpoints de lectura (/mis-liquidaciones,
 * /liquidaciones, /contratos/:id) para exponer montoPagado + saldo, sin lo cual
 * ni el inquilino ni el detalle del contrato podían ver el impacto de un pago
 * parcial (seguían mostrando el montoTotal completo).
 *
 * ⚠️ NO FILTRA `condonado`, Y ES A PROPÓSITO. Condonar una deuda crea un `Pago` CONCILIADO
 * con `condonado: true` (`plata.ts`). Hay otros tres lugares que SÍ lo excluyen —la rendición
 * al propietario (`rendicion-pendiente.ts`), el portal del dueño y el cierre de caja
 * (`whereCierreDelDia` en `lib/cierre-caja.ts`)— porque los tres miden **plata que entró**, y
 * una condonación no entró.
 *
 * Acá se mide otra cosa: **lo que el inquilino DEBE**. Una deuda perdonada ya no se debe. Si
 * alguien "unifica la inconsistencia" agregando `condonado: false` a esta query, le vuelve a
 * cobrar al inquilino lo que la inmobiliaria le perdonó, y encima reaparece como deuda viva en
 * el dashboard. Hay un test que lo impide (`test/saldos.test.ts`).
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
 * Lo COBRADO DE VERDAD por liquidación: lo que la rendición al propietario puede pagar.
 *
 * Es la hermana de `montoPagadoPorLiquidacion` y mide lo OPUESTO. Aquélla contesta "¿cuánto
 * dejó de deber el inquilino?" —y ahí una condonación cuenta, porque la deuda se perdonó—.
 * Ésta contesta "¿cuánta plata entró que se le pueda transferir al dueño?", y ahí no:
 *
 *  - `condonado`: cancela deuda sin ingresar plata.
 *  - `migradoDeCartera`: los períodos que el alta de un contrato EN CURSO registra como
 *    pagados. Se cobraron y se liquidaron antes de que el sistema existiera.
 *
 * POR QUÉ HACE FALTA UNA SEGUNDA FUNCIÓN Y NO UN FLAG. El panel usaba `montoPagado` —el de
 * la deuda— para estimar lo que se le va a rendir al dueño, y `POST /rendiciones` filtra las
 * dos cosas. Modo de falla concreto: se condona el remanente de un contrato, la ficha del
 * propietario dice "Cobrado $500.000 · A recibir $450.000", el operador se lo dicta al dueño
 * por teléfono, aprieta Rendir y el server contesta 409 "todavía no hay cobros nuevos". Dos
 * pantallas del mismo panel contradiciéndose sobre el mismo dueño.
 *
 * NO se resuelve agregándole el filtro a la de arriba: eso le volvería a cobrar al inquilino
 * lo que se le perdonó, y hay un test que lo impide (`test/saldos.test.ts`). Son dos preguntas
 * distintas y necesitan dos respuestas.
 */
export async function montoCobradoRendiblePorLiquidacion(liqIds: string[]): Promise<Map<string, number>> {
  if (liqIds.length === 0) return new Map();
  const rows = await prisma.pago.groupBy({
    by: ['liquidacionId'],
    where: {
      liquidacionId: { in: liqIds },
      estado: 'CONCILIADO',
      condonado: false,
      migradoDeCartera: false,
    },
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
