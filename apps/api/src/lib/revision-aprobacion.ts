import { computarLiquidacionesContrato, type ContratoParaLiquidar } from './liquidaciones.js';
import type { PeriodoAnterior } from './estado-inicial-contrato.js';
import { calcularMora, type EsquemaMora } from './punitorios.js';

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
 *
 * Mora de `deudaInicial`: un período ADEUDA o PARCIAL sin `moraManual` declarado
 * NO significa "sin mora" — `aplicarEstadoInicial` (estado-inicial-contrato.ts)
 * sólo escribe `montoPunitorioManual` cuando `moraManual != null`; si no vino,
 * la liquidación queda sin pisar y `calcularMora` (punitorios.ts) le aplica el
 * esquema del contrato ON-READ, creciendo por día. Para no anunciar $0 donde el
 * sistema va a cobrar punitorios, usamos la MISMA `calcularMora` — no
 * reimplementamos la aritmética — con el esquema efectivo (`resolverEsquemaMora`,
 * resuelto por el caller igual que GET /contratos/:id). Esa mora es "al día de
 * `now`": si el esquema es dinámico, mañana va a ser otro número — el caller
 * (front) tiene que avisarlo en el copy.
 */
export function resumenRevisionAprobacion(
  contrato: ContratoParaLiquidar,
  periodos: PeriodoAnterior[],
  now: Date,
  esquemaMora: EsquemaMora,
): RevisionAprobacion {
  const futuras = computarLiquidacionesContrato(contrato, now);
  const porPeriodo = new Map(futuras.map((l) => [l.periodo, l]));

  let conciliadoMonto = 0;
  let conciliadoPeriodos = 0;
  let deudaCapital = 0;
  let deudaPeriodos = 0;
  let deudaMora = 0;

  const moraDelPeriodo = (p: PeriodoAnterior, total: number, fechaVencimiento: Date | string): number =>
    p.moraManual != null
      ? Math.max(0, p.moraManual)
      : calcularMora(total, esquemaMora, fechaVencimiento, now);

  for (const p of periodos) {
    const liq = porPeriodo.get(p.periodo);
    // Un período declarado que el devengo no genera es el bug i36: no lo inventamos,
    // lo salteamos — aplicarEstadoInicial lo va a rechazar con 400 al aprobar.
    if (liq == null) continue;
    const total = Number(liq.montoTotal);

    if (p.estado === 'PAGADO') {
      // Espeja aplicarEstadoInicial: PAGADO no toca montoPunitorioManual, la mora
      // queda congelada en 0. Un moraManual declarado acá NUNCA se aplica — no
      // sumarlo, aunque venga en el período.
      conciliadoMonto += total;
      conciliadoPeriodos += 1;
    } else if (p.estado === 'PARCIAL') {
      const pagado = p.montoPagado ?? 0;
      conciliadoMonto += pagado;
      conciliadoPeriodos += 1;
      deudaCapital += Math.max(0, total - pagado);
      deudaPeriodos += 1;
      deudaMora += moraDelPeriodo(p, total, liq.fechaVencimiento);
    } else {
      deudaCapital += total;
      deudaPeriodos += 1;
      deudaMora += moraDelPeriodo(p, total, liq.fechaVencimiento);
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
