/**
 * Qué boleta avisar arriba de la pantalla de Servicios, y hasta cuándo.
 *
 * LO QUE HACÍA. El banner elegía la boleta con `filter(dias <= 7)` + `sort` ascendente y
 * `[0]`. La variable se llamaba `proximaAVencer`, pero ascendente por días quiere decir que el
 * primero es **el más negativo**: con una boleta vencida hace 120 días y otra que vence en 3, el
 * banner mostraba la de hace 120. Y como el filtro no tenía piso, esa boleta vieja se quedaba
 * ahí para siempre, contando días hacia arriba.
 *
 * No es un detalle de copy: es la única alerta de la pantalla, y estaba ocupada por la boleta
 * menos accionable de todas, tapando la que vence esta semana.
 *
 * LA REGLA. Se avisa de lo que todavía se puede hacer algo:
 *   1. si hay vencidas RECIENTES (dentro de la ventana), la más reciente — "venció hace 3 días"
 *      es accionable; "hace 120" es ruido;
 *   2. si no, la próxima a vencer dentro de los 7 días;
 *   3. si no, nada.
 *
 * La ventana existe porque el inquilino **no puede marcar una boleta como paga en producción**
 * (no hay endpoint), así que una boleta vieja no tiene forma de salir de la lista: sin piso, el
 * banner era permanente por construcción.
 */

/** Días de vencida a partir de los cuales una boleta deja de ser una alerta. */
export const VENTANA_VENCIDA_DIAS = 30;
/** Días de anticipación con los que se avisa una boleta que todavía no venció. */
export const ANTICIPO_DIAS = 7;

export interface BoletaConDias<T> {
  b: T;
  dias: number;
}

export function boletaAAvisar<T>(
  sinPagar: readonly T[],
  diasHasta: (b: T) => number,
  ventanaVencida = VENTANA_VENCIDA_DIAS,
  anticipo = ANTICIPO_DIAS,
): BoletaConDias<T> | null {
  const conDias = sinPagar.map((b) => ({ b, dias: diasHasta(b) }));
  // 1. Vencidas recientes: la MÁS RECIENTE (la más cercana a hoy), no la más vieja.
  const vencidas = conDias
    .filter(({ dias }) => dias < 0 && dias >= -ventanaVencida)
    .sort((x, y) => y.dias - x.dias);
  if (vencidas.length > 0) return vencidas[0]!;
  // 2. Por vencer dentro del anticipo: la más próxima.
  const porVencer = conDias
    .filter(({ dias }) => dias >= 0 && dias <= anticipo)
    .sort((x, y) => x.dias - y.dias);
  return porVencer[0] ?? null;
}
