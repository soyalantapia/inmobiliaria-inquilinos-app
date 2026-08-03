import { computarLiquidacionesContrato, type ContratoParaLiquidar } from './liquidaciones.js';
import type { PeriodoAnterior } from './estado-inicial-contrato.js';

export type RevisionAprobacion = {
  periodosDeclarados: PeriodoAnterior[];
  alAprobar: {
    cuotasAGenerar: number;
    rangoCuotas: { desde: string; hasta: string } | null;
    conciliado: { periodos: number; monto: number };
    deudaInicial: { periodos: number; capital: number; mora: number };
  };
};

/**
 * Resumen de lo que va a pasar cuando se apruebe un contrato que está en BORRADOR.
 *
 * 🔴 Las cuotas salen de `computarLiquidacionesContrato`, la MISMA función pura que
 * `generarLiquidacionesContrato` usa para crearlas de verdad. No se recalcula ningún
 * monto acá: si el número que se muestra saliera de otro lado, podría divergir del
 * que se ejecuta.
 *
 * Un período PARCIAL cuenta en los DOS lados: lo pagado va a `conciliado` y el
 * remanente a `deudaInicial`. `periodos` de cada lado NO son conjuntos disjuntos.
 */
export function resumenRevisionAprobacion(
  contrato: ContratoParaLiquidar,
  periodos: PeriodoAnterior[],
  now: Date,
): RevisionAprobacion {
  const futuras = computarLiquidacionesContrato(contrato, now);
  const totalPorPeriodo = new Map(futuras.map((l) => [l.periodo, Number(l.montoTotal)]));

  let conciliadoMonto = 0;
  let conciliadoPeriodos = 0;
  let deudaCapital = 0;
  let deudaPeriodos = 0;
  let deudaMora = 0;

  for (const p of periodos) {
    const total = totalPorPeriodo.get(p.periodo);
    // Un período declarado que el devengo no genera es el bug i36: no lo inventamos,
    // lo salteamos — aplicarEstadoInicial lo va a rechazar con 400 al aprobar.
    if (total == null) continue;
    if (p.moraManual != null) deudaMora += Math.max(0, p.moraManual);

    if (p.estado === 'PAGADO') {
      conciliadoMonto += total;
      conciliadoPeriodos += 1;
    } else if (p.estado === 'PARCIAL') {
      const pagado = p.montoPagado ?? 0;
      conciliadoMonto += pagado;
      conciliadoPeriodos += 1;
      deudaCapital += Math.max(0, total - pagado);
      deudaPeriodos += 1;
    } else {
      deudaCapital += total;
      deudaPeriodos += 1;
    }
  }

  const primera = futuras[0];
  const ultima = futuras[futuras.length - 1];
  return {
    periodosDeclarados: periodos,
    alAprobar: {
      cuotasAGenerar: futuras.length,
      rangoCuotas: primera && ultima ? { desde: primera.periodo, hasta: ultima.periodo } : null,
      conciliado: { periodos: conciliadoPeriodos, monto: conciliadoMonto },
      deudaInicial: { periodos: deudaPeriodos, capital: deudaCapital, mora: deudaMora },
    },
  };
}
