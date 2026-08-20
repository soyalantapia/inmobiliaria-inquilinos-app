/**
 * Enumeración canónica de los períodos de un contrato — FUENTE ÚNICA de verdad,
 * compartida por el back (devengo real, apps/api/src/lib/liquidaciones.ts) y por
 * el front (paso "Períodos anteriores" del wizard de alta). Antes el wizard
 * reimplementaba esta lógica client-side (`calcularPeriodosVencidos`) y divergía
 * del back en el tratamiento del primer mes: un contrato que empieza a mitad de
 * mes (ej. 15/07) con diaPago temprano (ej. 5) hacía que el front listara un
 * período '2026-07' que el back NUNCA devenga (lo saltea porque su vencimiento
 * caería ANTES del inicio). Ese período huérfano tumbaba el alta entera (400 +
 * rollback en aplicarEstadoInicial). Con una sola implementación no puede volver
 * a pasar: el conjunto que muestra el front es exactamente el que devenga el back.
 *
 * Puro (sin DB, sin Prisma, sin React): sirve en Node y en el browser. `now` es
 * inyectable (determinismo en los tests). Trabaja SIEMPRE en UTC — igual que el
 * back — para evitar el corrimiento por huso que daba mezclar fechas locales.
 */

export type PeriodoContrato = {
  /** Período 'YYYY-MM'. */
  periodo: string;
  /** Fecha de vencimiento del período (UTC, medianoche). */
  vencimiento: Date;
  /** true si el vencimiento ya pasó respecto de `now` (venc < now). */
  vencido: boolean;
};

export type ParamsEnumerarPeriodos = {
  fechaInicio: Date | string;
  fechaFin: Date | string;
  diaPago: number;
  /**
   * Mes desde el que ESTE contrato devenga, si difiere de `fechaInicio` (cartera
   * importada). null/undefined = devengar desde `fechaInicio`.
   */
  devengarDesde?: Date | string | null;
};

/**
 * Enumera los períodos de un contrato desde su arranque hasta el MES QUE VIENE
 * inclusive (o hasta el mes de `fechaFin` si es antes), una entrada por mes.
 *
 * Reglas (idénticas al devengo del back):
 *  - Arranque = MAYOR entre `devengarDesde` y `fechaInicio` (nunca antes del inicio real).
 *  - PRIMER MES: si su vencimiento (min(diaPago, últimoDíaDelMes)) cae ANTES del
 *    arranque, se saltea (esa cuota no podía pagarse antes de existir el contrato).
 *    Solo aplica al primer período; los siguientes ya vencen tras el inicio.
 *  - Vencimiento = min(diaPago, últimoDíaDelMes) de cada mes.
 *  - Tope = el menor entre (mes que viene) y (mes de fin del contrato).
 *
 * El front toma el SUBCONJUNTO con `vencido === true` (los períodos anteriores a
 * declarar); el back usa todos (para devengar el actual + el siguiente).
 */
export function enumerarPeriodosContrato(params: ParamsEnumerarPeriodos, now: Date): PeriodoContrato[] {
  const fechaInicio = new Date(params.fechaInicio);
  const fechaFin = new Date(params.fechaFin);
  const devengarDesde = params.devengarDesde != null ? new Date(params.devengarDesde) : null;

  // Arranque: nunca antes del inicio real (por seguridad, MAYOR de los dos).
  const inicio = devengarDesde && devengarDesde > fechaInicio ? devengarDesde : fechaInicio;
  const fin = fechaFin;

  // Tope = el menor entre (mes que viene) y (mes de fin del contrato).
  const proximoMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const finMes = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), 1));
  const tope = proximoMes < finMes ? proximoMes : finMes;
  const topeY = tope.getUTCFullYear();
  const topeM = tope.getUTCMonth();

  let y = inicio.getUTCFullYear();
  let m = inicio.getUTCMonth();

  // PRIMER DEVENGO: si el contrato arranca a mitad de mes y el diaPago es temprano,
  // el vencimiento del primer período caería ANTES de `inicio` → se saltea ese mes.
  {
    const diasMes = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const dia = Math.min(params.diaPago, diasMes);
    const vencPrimero = new Date(Date.UTC(y, m, dia));
    if (vencPrimero < inicio) {
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }

  const out: PeriodoContrato[] = [];
  let guard = 0;
  while (guard < 600) {
    const periodo = `${y}-${String(m + 1).padStart(2, '0')}`;
    const diasMes = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const dia = Math.min(params.diaPago, diasMes);
    const venc = new Date(Date.UTC(y, m, dia));
    out.push({ periodo, vencimiento: venc, vencido: venc < now });
    // Generamos hasta el tope inclusive; si el inicio ya superó el tope
    // (contrato futuro), queda solo el primer mes.
    if (y > topeY || (y === topeY && m >= topeM)) break;
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    guard += 1;
  }

  return out;
}

/**
 * Argentina no aplica horario de verano desde 2009: el offset es fijo en UTC-3.
 * Se declara acá (y no en cada call site) porque el corte del día civil aparece
 * en varios lugares —cierre de caja, métricas, vencimientos— y cada copia a mano
 * es una oportunidad de que uno quede comparando contra UTC.
 */
const OFFSET_AR_MS = 3 * 60 * 60 * 1000;

/**
 * El día civil ARGENTINO de `instante`, normalizado a medianoche UTC — que es la
 * misma convención con la que se guardan las fechas civiles del sistema
 * (`fechaVencimiento` se arma con `Date.UTC(y, m, dia)`, ver arriba).
 *
 * Existe porque comparar una fecha civil contra `new Date()` corre el día: un
 * vencimiento del 10 vive en el instante `10T00:00Z`, que en Argentina son las
 * 21:00 del 9. Todo lo que compare "¿ya pasó esta fecha?" contra el instante UTC
 * da por vencido el día ANTERIOR, a las 21:00 hora local.
 */
export function diaCivilAR(instante: Date): Date {
  const ar = new Date(instante.getTime() - OFFSET_AR_MS);
  return new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()));
}

/**
 * Inverso de `diaCivilAR`: de una fecha CIVIL (guardada a medianoche UTC, como las que manda el
 * panel en `"YYYY-MM-DD"` o las que arma el parser del extracto bancario) a un INSTANTE
 * inequívoco dentro de ese día argentino — mediodía, bien lejos de los dos bordes.
 *
 * POR QUÉ HACE FALTA. `diaCivilAR` está escrito para INSTANTES. Si se le pasa una fecha civil
 * pelada, `D T00:00Z` son las 21:00 del día ANTERIOR en Argentina, así que devuelve `D − 1`
 * **siempre** — no es un borde, es un corrimiento constante. Todo cálculo de mora con un `asOf`
 * de fecha pelada perdía un día:
 *
 *  - cobro manual: el diálogo prefillea el saldo con la mora al instante y el guard la
 *    recalcula con un día menos, así que rechazaba con 400 el monto que él mismo propuso;
 *  - conciliación por extracto: ahí el monto NO se puede editar, así que un crédito por lo que
 *    la app le mostró al inquilino quedaba imposible de conciliar;
 *  - con mora de MONTO_FIJO por mes, un día de menos en un múltiplo de 30 se lleva un MES entero.
 */
export function instanteEnDiaCivilAR(fechaCivil: Date): Date {
  return new Date(fechaCivil.getTime() + OFFSET_AR_MS + 12 * 60 * 60 * 1000);
}

/**
 * ¿El día de pago YA PASÓ? (la cuota es deuda exigible).
 * El día del vencimiento NO cuenta: si vence el 10, recién es deuda el 11.
 */
export function yaVencio(fechaVencimiento: Date | string, now: Date): boolean {
  return new Date(fechaVencimiento) < diaCivilAR(now);
}

/**
 * ¿El día de pago todavía NO LLEGÓ? (la cuota es futura).
 * No es la negación de `yaVencio`: el propio día del vencimiento no es ninguna
 * de las dos cosas —ya está devengada pero todavía no es deuda—, y esa franja
 * es justamente la que hay que respetar.
 */
export function venceDespuesDeHoy(fechaVencimiento: Date | string, now: Date): boolean {
  return new Date(fechaVencimiento) > diaCivilAR(now);
}
