/**
 * Normalizar un número que alguien tipeó, en un país donde el decimal se escribe con COMA.
 *
 * EL CASO REAL. El campo de comisión del alta filtraba con `replace(/[^\d.]/g, '')`. Esa clase
 * deja pasar el punto y **borra la coma**, así que «8,5» no quedaba en 8.5: quedaba en **85**.
 * Diez veces la comisión, sin un solo error a la vista y sin nada que se pusiera rojo.
 *
 * Lo peor es cuál era el camino roto: en Argentina el decimal se escribe con coma, o sea que
 * **el modo natural de tipearlo era el que fallaba**, y el que funcionaba —el punto— es el que
 * hay que saber usar.
 *
 * POR QUÉ ES UNA FUNCIÓN CON TEST Y NO UN `replace` MÁS EN EL `onChange`: porque el defecto vivió
 * meses en una sola línea de un handler, y una línea de handler no la mira nadie. Acá se puede
 * poner en rojo.
 */

/**
 * Deja sólo dígitos y UN separador decimal, con la coma convertida a punto.
 *
 * @param maxLargo tope de caracteres del resultado (el campo de comisión usa 5: «99.99»).
 */
export function numeroTipeado(valor: string, maxLargo = 5): string {
  // La coma PRIMERO: si se filtrara antes, ya no habría coma que convertir.
  const conPunto = valor.replace(',', '.');
  const limpio = conPunto.replace(/[^\d.]/g, '');
  // Un solo punto: «8.5.2» es un tipeo, no un número. Se queda con el primero y pega el resto.
  const partes = limpio.split('.');
  const normalizado = partes.length > 1 ? `${partes[0]}.${partes.slice(1).join('')}` : limpio;
  return normalizado.slice(0, maxLargo);
}
