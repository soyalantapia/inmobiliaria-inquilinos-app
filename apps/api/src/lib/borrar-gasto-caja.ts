/**
 * ¿Se puede borrar este movimiento de caja?
 *
 * Existe porque el candado que había miraba el campo equivocado. El borrado se protegía con
 * `descontadoEnRendicion: false`, y ese flag **no** significa "no se le descontó a nadie":
 * significa "todavía no se cubrió el 100%". Lo dice el propio armado de la rendición, en
 * `routes/plata.ts`: en multi-dueño el movimiento queda en `false` hasta que las partes suman
 * el total.
 *
 * Un departamento 50/50: se rinde a la primera dueña, se le descuentan $50.000, el flag sigue
 * en `false` porque falta el hermano, y el borrado pasaba. Ella quedaba con el descuento hecho
 * sobre un gasto que ya no existe, él no lo pagaba nunca, y el movimiento no estaba ni para
 * auditarlo. Con un solo dueño no pasa —la primera rendición cubre el 100% y el flag se pone en
 * `true`—, que es por qué duró: el caso roto es el minoritario.
 *
 * El registro que sí dice la verdad es `GastoRendido`: se escribe con la PRIMERA parte rendida,
 * mucho antes de que el flag cambie.
 */
export function sePuedeBorrarGastoDeCaja(p: {
  /** Cuántos `GastoRendido` (tipo CAJA) apuntan a este movimiento por `refId`. */
  gastosRendidosQueLoApuntan: number;
  /** El flag del movimiento. Se sigue mirando como red para filas viejas. */
  descontadoEnRendicion: boolean;
}): boolean {
  if (p.gastosRendidosQueLoApuntan > 0) return false;
  return !p.descontadoEnRendicion;
}
