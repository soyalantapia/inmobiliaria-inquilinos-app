import type { Liquidacion } from './types';

/**
 * Cuánto le falta pagar al inquilino por una liquidación — la ÚNICA fuente para las tres
 * pantallas que lo muestran (home, detalle del pago y comprobantes).
 *
 * POR QUÉ EXISTE: cada pantalla lo calculaba por su cuenta y no coincidían. El home y
 * Recibos descontaban el pago ya informado y en revisión; el DETALLE no, porque medía la
 * parcialidad con `liq.montoPagado`, que suma sólo los CONCILIADOS. Resultado: el inquilino
 * informaba un pago parcial, entraba al detalle y le seguía apareciendo el total completo,
 * como si no hubiera pagado nada. Dos pantallas, dos verdades sobre la misma deuda.
 *
 * La distinción que hay que sostener —y que es la razón de que esto sea sutil— es entre:
 *
 *   - CONCILIADO: la inmobiliaria ya lo validó. Bajó la deuda de verdad; el backend ya lo
 *     descontó en `liq.saldo` (ver lib/saldos.ts, que agrega sólo CONCILIADO).
 *   - INFORMADO: el inquilino avisó que transfirió y la inmobiliaria todavía no lo miró.
 *     NO bajó la deuda formalmente —si lo rechazan, vuelve— pero para él ya es plata que
 *     mandó. Mostrarle el total completo lo hace pagar dos veces; mostrarle cero lo hace
 *     creer que terminó cuando el pago todavía puede rechazarse.
 *
 * Por eso se devuelven separados: `faltaPagar` es lo que le queda por transferir, y
 * `enRevision` es lo que ya mandó y está esperando. La pantalla decide cómo contarlo,
 * pero el número sale de acá.
 */
export interface SaldoLiquidacion {
  /** Deuda exigible según el backend (total + mora − conciliados). Nunca negativa. */
  exigible: number;
  /** Monto ya informado y esperando validación. 0 si no hay ninguno vivo. */
  enRevision: number;
  /** Lo que todavía tiene que transferir: exigible − enRevision. Nunca negativa. */
  faltaPagar: number;
  /** ¿Ya hay algo pagado y validado? (para el "ya pagaste X de Y") */
  hayConciliado: boolean;
  /** ¿Informó algo que todavía nadie miró? */
  hayEnRevision: boolean;
}

/**
 * `totalFallback` es el total a pagar que calcula la pantalla (base + mora al día) y se usa
 * cuando el backend no mandó `saldo` — en el build demo, donde no hay API.
 */
export function saldoDeLiquidacion(liq: Liquidacion, totalFallback: number): SaldoLiquidacion {
  const exigible = Math.max(0, liq.saldo ?? totalFallback);

  // Sólo el pago INFORMADO vivo. Los RECHAZADO no cuentan (volvieron a ser deuda) y los
  // CONCILIADO ya están descontados en `saldo`: sumarlos acá los restaría dos veces.
  const enRevision = (liq.pagos ?? [])
    .filter((p) => p.estado === 'INFORMADO')
    .reduce((acc, p) => acc + p.monto, 0);

  return {
    exigible,
    enRevision,
    faltaPagar: Math.max(0, Math.round((exigible - enRevision) * 100) / 100),
    hayConciliado: (liq.montoPagado ?? 0) > 0,
    hayEnRevision: enRevision > 0,
  };
}
