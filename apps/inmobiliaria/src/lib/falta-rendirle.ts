/**
 * "¿Le falta rendirle a este dueño?" — UNA sola definición.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. El predicado vivía copiado tres veces en la pantalla de
 * propietarios —el filtro `?filtro=sin-rendir`, el contador "por rendir" y el botón de cada
 * tarjeta— y las tres copias decían `totalRecibirMes > 0`. Ese número **vale 0 cuando el dueño
 * cobró en DOS monedas**: el hook lo pone así a propósito, para no mostrar una suma cruda de
 * pesos con dólares. O sea que el cero no significa "no hay nada que rendir", y las tres copias
 * lo leían como si sí.
 *
 * EL EFECTO. Un dueño con un contrato en pesos y otro en dólares aparecía con badge "Al día",
 * el botón **Rendir** en gris, fuera del filtro y fuera del contador — en la misma tarjeta que
 * le decía al operador *"Cobros en pesos y dólares · rendí cada moneda por separado"*. No
 * estaba trabado: estaba **invisible**. Y lo único imposible era EMPEZAR, porque una vez rendida
 * una moneda por otra vía el botón se habilitaba solo.
 *
 * `monedasMes.length > 1` es el mismo criterio que ya usaba bien `rendir-propietario-dialog`,
 * un archivo más allá. El dato bueno estaba; lo que faltaba era usarlo acá.
 */

/** Lo mínimo que hace falta para decidir. Se tipa así para poder probarlo sin armar un Propietario entero. */
export interface DueñoParaRendir {
  totalRecibirMes: number;
  monedasMes?: string[];
}

/** Cobró en más de una moneda este mes: hay algo que rendir, pero no UN número que lo resuma. */
export function tieneMezclaDeMonedas(p: DueñoParaRendir): boolean {
  return (p.monedasMes?.length ?? 0) > 1;
}

/**
 * Hay algo para rendirle y todavía no se hizo.
 *
 * `yaRendido` viene de afuera (el mapa de rendiciones del período) para que esta función sea
 * pura y no tenga que saber de dónde sale.
 */
export function faltaRendirle(p: DueñoParaRendir, yaRendido: boolean): boolean {
  if (yaRendido) return false;
  return p.totalRecibirMes > 0 || tieneMezclaDeMonedas(p);
}
