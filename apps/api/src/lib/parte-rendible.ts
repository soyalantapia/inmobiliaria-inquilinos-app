/**
 * Cuánto de un ítem (un gasto, un reclamo, un ingreso extra) le corresponde rendir a ESTE
 * propietario en ESTA rendición.
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────────────────
 * Los tres descuentos de la rendición hacían esta misma cuenta, copiada tres veces, y se
 * fueron separando. Cuando se relevó el arrastre (T-23-N3-N2) aparecieron dos agujeros que son
 * exactamente el costo de esa divergencia:
 *
 * - los **ingresos extra** no tenían el tope GLOBAL que sí tenían los otros dos, así que un
 *   ingreso de $100 podía acreditarse $150 entre varios dueños — plata que SALE de la caja de
 *   la inmobiliaria;
 * - y los **reclamos** no filtraban por moneda, que sí filtraban los otros dos.
 *
 * Con la cuenta en un solo lugar, la próxima corrección entra una vez y no dos de tres.
 *
 * ── LOS DOS TOPES ─────────────────────────────────────────────────────────────────────────
 * 1. **Por dueño**: no puede llevarse más que su porcentaje del total, descontando lo que ya
 *    se le rindió de ese mismo ítem en rendiciones anteriores.
 * 2. **Global**: no puede llevarse más que lo que queda sin rendir del ítem entero, sumando
 *    TODOS los dueños. Sin este, al re-armarse las participaciones el ítem se pagaba dos veces:
 *    el dueño A rindió su 50%, después B pasó a 100% y se llevó el 100% de nuevo.
 *
 * Los dos son necesarios y ninguno implica al otro: el primero protege el reparto entre
 * co-dueños, el segundo protege el total.
 */
export interface ParteRendibleParams {
  /** El importe completo del ítem. */
  montoTotal: number;
  /** Qué porcentaje de la propiedad tiene este dueño (0-100). */
  porcentaje: number;
  /** Lo que a ESTE dueño ya se le rindió de este ítem, en rendiciones anteriores. */
  yaRendidoPorMi: number;
  /** Lo que se rindió de este ítem entre TODOS los dueños, en todas las rendiciones. */
  yaRendidoGlobal: number;
}

export function parteRendible(p: ParteRendibleParams): number {
  const leToca = p.montoTotal * (p.porcentaje / 100);
  const restanteMio = leToca - p.yaRendidoPorMi;
  const restanteGlobal = p.montoTotal - p.yaRendidoGlobal;
  // `max(0, ...)` al final: si cualquiera de los dos topes ya está cubierto —o pasado, por un
  // reparto que cambió— la parte es 0, nunca un negativo que le SUMARÍA al neto del dueño.
  return Math.max(0, Math.min(restanteMio, restanteGlobal));
}
