/**
 * Cuánto aporta UN contrato a los KPIs de plata del tablero — en un solo lugar.
 *
 * POR QUÉ EXISTE. La regla vivía como un `switch` adentro de `useDashboard`, y ahí se le escapó
 * el caso que más importa: **`VENCIDO` caía en el `default` y aportaba 0 a "Cobrado"**.
 *
 * Eso no es un caso raro. El server **deriva** VENCIDO para cualquier liquidación PENDIENTE o
 * PARCIAL cuyo vencimiento ya pasó, así que un pago parcial deja de ser `PARCIAL` **solo por el
 * calendario**. El comentario del hook prometía justo lo contrario —*"un PARCIAL suma lo ya
 * cobrado a Cobrado (antes desaparecía de los TRES KPIs)"*—, pero ese `case` sólo se alcanzaba
 * con un parcial NO vencido, o sea con un pago adelantado.
 *
 * EL ESCENARIO: cuota de $500.000 que vence el 10. El 5 pagan $300.000 → el tablero dice
 * "Cobrado $300.000". El 11, sin que pase nada, decía **"Cobrado $0"**, cobrabilidad 0%,
 * comisión $0 y "A rendir $0". El número bajaba solo, sin que nadie devolviera plata. `/pagos`,
 * que suma `montoPagado` sin mirar el estado, lo seguía contando: dos pantallas, dos respuestas.
 */

/** Lo mínimo que hace falta del contrato; se tipa así para poder probarlo sin armar el objeto entero. */
export interface ContratoParaKpi {
  estadoPagoActual: string;
  /** El canon del período. */
  monto: number;
  montoPagado?: number | null;
  saldo?: number | null;
  /** Todas las cuotas vencidas + mora. Es lo que se DEBE, no el canon. */
  deudaTotal?: number | null;
}

export interface PlataDelContrato {
  cobrado: number;
  porCobrar: number;
  mora: number;
}

const n = (x: number | null | undefined): number => x ?? 0;

/**
 * El reparto de un contrato entre los tres KPIs.
 *
 * `mora` usa `deudaTotal` —lo que se debe— y no el canon, así que **no hay doble conteo** con lo
 * que ese mismo contrato ya aportó a `cobrado`.
 */
export function plataDelContrato(c: ContratoParaKpi): PlataDelContrato {
  switch (c.estadoPagoActual) {
    case 'PAGADO':
      return { cobrado: c.montoPagado || c.monto, porCobrar: 0, mora: 0 };
    case 'PARCIAL':
      return {
        cobrado: n(c.montoPagado),
        porCobrar: c.saldo ?? Math.max(0, c.monto - n(c.montoPagado)),
        mora: 0,
      };
    case 'PENDIENTE':
      return { cobrado: 0, porCobrar: c.saldo ?? c.monto, mora: 0 };
    case 'VENCIDO':
      // Lo ya cobrado sigue cobrado aunque la cuota se atrase.
      return { cobrado: n(c.montoPagado), porCobrar: 0, mora: c.deudaTotal ?? c.saldo ?? c.monto };
    default:
      return { cobrado: 0, porCobrar: 0, mora: 0 };
  }
}

/**
 * Cuánto de lo cobrado de ESE contrato se puede rendir al dueño, antes de comisión.
 *
 * Se usa para la comisión y para el "A rendir". VENCIDO entra por el mismo motivo que arriba: lo
 * cobrado antes de atrasarse sigue siendo rendible.
 */
export function cobradoRendible(c: ContratoParaKpi): number {
  if (c.estadoPagoActual === 'PAGADO') return c.montoPagado || c.monto;
  if (c.estadoPagoActual === 'PARCIAL' || c.estadoPagoActual === 'VENCIDO') return n(c.montoPagado);
  return 0;
}
