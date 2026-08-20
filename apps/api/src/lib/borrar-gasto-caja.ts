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
 *
 * Y NO ES SÓLO EL GASTO. Un movimiento de caja también puede ser un INGRESO_EXTRA, y ésos se
 * rinden en `IngresoRendido`, no en `GastoRendido`. O sea que para un ingreso el candado miraba
 * un contador estructuralmente 0 y el borrado pasaba SIEMPRE mientras el flag estuviera en
 * `false` — que es exactamente lo que pasa con participaciones que no cubren el 100%. El ingreso
 * desaparecía de caja y el `IngresoRendido` quedaba huérfano: `refId` es un String sin FK, así
 * que la base no lo frena.
 */
export function sePuedeBorrarGastoDeCaja(p: {
  /** Cuántos `GastoRendido` (tipo CAJA) apuntan a este movimiento por `refId`. */
  gastosRendidosQueLoApuntan: number;
  /**
   * Cuántos `IngresoRendido` lo apuntan por `refId`. Es el ledger de los INGRESO_EXTRA: para
   * un ingreso, el contador de gastos es 0 por construcción y no protege nada.
   *
   * Opcional para no romper a los callers viejos, pero el de producción lo pasa.
   */
  ingresosRendidosQueLoApuntan?: number;
  /** El flag del movimiento. Se sigue mirando como red para filas viejas. */
  descontadoEnRendicion: boolean;
}): boolean {
  if (p.gastosRendidosQueLoApuntan > 0) return false;
  if ((p.ingresosRendidosQueLoApuntan ?? 0) > 0) return false;
  return !p.descontadoEnRendicion;
}
