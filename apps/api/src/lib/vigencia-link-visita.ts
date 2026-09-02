/**
 * ¿Sigue vivo el link mágico de una visita?
 *
 * La regla vivía SÓLO en `GET /visitas-publicas/:token`, el endpoint que canjea el link por una
 * sesión. Pero esa sesión dura tres días, y el guard que la revalida en cada escritura
 * (`requireProfesionalVisita`) no miraba nada de esto: sólo que la visita existiera y que el
 * profesional y el tenant coincidieran.
 *
 * O sea que un JWT emitido ANTES del vencimiento seguía autorizando escrituras cuando el link
 * ya contestaba 410 — incluido `POST /listo`, que cierra el reclamo, escribe `costoTrabajo` e
 * imputa el costo contra el inquilino o el depósito. Plata escrita por un link que el propio
 * sistema declaró vencido.
 *
 * `uploads.ts` es el vecino que sí lo hacía: para el mismo tipo de token trae `estado` y
 * `reclamo.estado` y corta con 401. Por eso esto vive acá y no adentro de un handler: para que
 * los tres lugares apliquen LA MISMA regla y no vuelvan a divergir.
 */

/** Ventana de gracia tras terminar el trabajo, para que el profesional vea la confirmación. */
export const GRACIA_POST_LISTO_MS = 48 * 60 * 60 * 1000;
/** Tope duro de vida del link, contado desde que se abrió el reclamo. */
export const VIDA_MAX_LINK_MS = 60 * 24 * 60 * 60 * 1000;

/** Lo mínimo que hay que traer de la base para decidir. La visita no tiene `createdAt`, pero es
 *  1:1 con el reclamo (`reclamoId @unique`), así que su antigüedad sirve de reloj. */
export type VisitaParaVigencia = {
  listoAt: Date | null;
  reclamo: { estado: string; createdAt: Date };
};

export function linkDeVisitaVencido(visita: VisitaParaVigencia, ahora: Date = new Date()): boolean {
  const t = ahora.getTime();
  // (a) Trabajo terminado: ventana de gracia y después el link muere.
  if (visita.listoAt && t - new Date(visita.listoAt).getTime() > GRACIA_POST_LISTO_MS) return true;
  // (b) Reclamo cerrado o rechazado: no hay trabajo que hacer, no hay razón para entrar.
  if (visita.reclamo.estado === 'CERRADO' || visita.reclamo.estado === 'RECHAZADO') return true;
  // (c) Tope duro por antigüedad, para el link que quedó abierto y nunca se completó.
  if (t - new Date(visita.reclamo.createdAt).getTime() > VIDA_MAX_LINK_MS) return true;
  return false;
}
