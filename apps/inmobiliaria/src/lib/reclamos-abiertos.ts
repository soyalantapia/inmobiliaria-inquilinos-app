/**
 * "¿Este reclamo está abierto, y de qué propiedad es?" — una sola definición.
 *
 * POR QUÉ EXISTE. El mismo rótulo se calculaba de tres maneras distintas, y el operador ve las
 * tres al mismo tiempo:
 *
 *   · `/estadísticas` contaba los reclamos **creados** en el mes, sin filtrar por estado: los
 *     RECHAZADOS sumaban a "abiertos", y un reclamo creado y resuelto en el mes sumaba a esa
 *     tarjeta **y** a la de "resueltos", que se leen como excluyentes;
 *   · el tablero, `/propiedades` y el filtro "Con problemas" matcheaban el reclamo contra el
 *     **contrato actual** de la propiedad;
 *   · `/reclamos` los desglosa por estado, que es otra pregunta y está bien.
 *
 * EL DEFECTO DEL MATCH POR CONTRATO. Al finalizar un contrato, el server pone
 * `contratoActualId: null` en la propiedad, y al firmar uno nuevo lo reapunta. El reclamo
 * ABIERTO del contrato viejo deja de matchear con **ninguna** propiedad y se cae de los tres
 * lugares a la vez.
 *
 * El escenario: humedad ABIERTA en Belgrano 1200. El inquilino se va el 31/08 y se finaliza el
 * contrato. Ese mismo día `/reclamos` la sigue mostrando con su badge rojo, el tablero dice
 * **"Reclamos abiertos: 0"** y la unidad deja de aparecer "Con problemas". La humedad sigue ahí.
 *
 * `propiedadId` es el vínculo estable: **el reclamo es del inmueble**; el contrato es sólo quién
 * lo ocupaba cuando se abrió.
 */

export interface ReclamoParaContar {
  estado: string;
  propiedadId?: string | null;
  contratoId?: string | null;
}

/** ABIERTO o EN_CURSO. RESUELTO, CERRADO y RECHAZADO no son "abiertos". */
export function estaAbierto(r: { estado: string }): boolean {
  return r.estado === 'ABIERTO' || r.estado === 'EN_CURSO';
}

/**
 * ¿Este reclamo es de esta propiedad?
 *
 * Por `propiedadId`, que no cambia. El match por contrato se conserva **sólo** como respaldo
 * para reclamos viejos que puedan tener `propiedadId` nulo — si mañana ese caso no existe, la
 * segunda rama se puede borrar sin cambiar nada.
 */
export function esDeLaPropiedad(
  r: ReclamoParaContar,
  propiedad: { id: string; contratoActualId?: string | null },
): boolean {
  if (r.propiedadId != null) return r.propiedadId === propiedad.id;
  return r.contratoId != null && r.contratoId === propiedad.contratoActualId;
}

/** Cuántos reclamos abiertos tiene una propiedad. */
export function reclamosAbiertosDe(
  reclamos: readonly ReclamoParaContar[],
  propiedad: { id: string; contratoActualId?: string | null },
): number {
  return reclamos.filter((r) => estaAbierto(r) && esDeLaPropiedad(r, propiedad)).length;
}
