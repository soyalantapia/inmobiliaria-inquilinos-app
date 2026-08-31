/**
 * El signo de la moneda, en un solo lugar.
 *
 * POR QUÉ EXISTE. El ternario `moneda === 'USD' ? 'US$' : '$'` estaba escrito a mano en cuatro
 * lugares de `plata.ts` y **faltaba en otros nueve**, que imprimían `$` fijo. El resultado no es
 * cosmético: el MISMO hecho quedaba con dos asientos que se contradicen en el libro de auditoría
 * —cobrar un cargo escribía `$800` y deshacerlo `US$800`—, que es la fuente que se consulta
 * cuando un propietario o un inquilino reclama por plata.
 *
 * El docblock de `Liquidacion.moneda` en el schema dice que ese campo se agregó justamente
 * porque *"el portal del propietario mostraba los dólares con signo de pesos"*. Las nueve líneas
 * eran sobrevivientes de esa limpieza.
 *
 * Con una función, el décimo lugar lo escribe bien quien no conozca la historia.
 */

/** `US$` para dólares, `$` para pesos. */
export function sim(moneda: string | null | undefined): string {
  return moneda === 'USD' ? 'US$' : '$';
}

/** El símbolo pegado al número, que es como se escribe en todos los asientos. */
export function montoConSigno(monto: number, moneda: string | null | undefined): string {
  return `${sim(moneda)}${monto}`;
}
