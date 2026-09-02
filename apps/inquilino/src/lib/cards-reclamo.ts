/**
 * Las dos decisiones de la pantalla del reclamo que leían el rastro de un cierre viejo como si
 * fuera el estado de hoy.
 *
 * POR QUÉ SON FUNCIONES Y NO CONDICIONES ADENTRO DEL JSX. Porque las dos se equivocaron por la
 * misma razón —una regla razonable que el producto dejó atrás— y adentro del render no había
 * forma de que un test se enterara. Acá sí: cuando aparezca un tercer camino de reapertura, o
 * cuando alguien limpie `ConfirmacionReclamo`, se pone rojo un caso en vez de aparecer una card
 * que miente.
 */

/** Quién deshizo el cierre. Lo resuelve el server (`api/src/lib/reapertura-reclamo.ts`). */
export type ReabiertoPor = 'INQUILINO' | 'INMOBILIARIA' | null;

/**
 * ¿Va la card verde «Resuelto · confirmado por vos»?
 *
 * La fila `ConfirmacionReclamo` con CONFORME es one-shot —tiene `@unique` por reclamo— y **nadie
 * la borra nunca**: no hay un solo `delete` ni `update` de esa tabla en toda la API. Y
 * `POST /reclamos/:id/reabrir` acepta reclamos CERRADOS. O sea que después de una reapertura el
 * CONFORME sigue puesto sobre un reclamo que hoy está en curso: sin mirar el estado, la pantalla
 * mostraba la card verde de cerrado Y la ámbar de reabierto, las dos juntas.
 */
export function mostrarConfirmadoPorVos(r: {
  decisionActual: 'CONFORME' | 'PERSISTE' | null;
  estado: string;
  resolucion: string | null;
}): boolean {
  if (r.decisionActual !== 'CONFORME' || !r.resolucion) return false;
  // El cierre tiene que seguir en pie, no sólo haber ocurrido alguna vez.
  return r.estado === 'CERRADO' || r.estado === 'RESUELTO';
}

/**
 * El título de la card ámbar de reapertura.
 *
 * Antes decía siempre «Reportaste que sigue», apoyado en un comentario que afirmaba que en prod
 * la combinación "EN_CURSO + resolución previa" sólo podía venir del PERSISTE del inquilino. Era
 * cierto hasta que se agregó `POST /reclamos/:id/reabrir` (T-63): desde entonces, cuando la
 * inmobiliaria reabría un reclamo para corregir un monto, la app le decía al inquilino que él
 * había reportado algo que nunca reportó.
 *
 * Cuando no se sabe quién fue, se dice en neutro. Es preferible a acusar al que no fue.
 */
export function tituloDeReapertura(reabiertoPor: ReabiertoPor): string {
  if (reabiertoPor === 'INQUILINO') return 'Reportaste que sigue';
  if (reabiertoPor === 'INMOBILIARIA') return 'La inmobiliaria lo reabrió';
  return 'Se reabrió';
}

/** El cuerpo de esa card, con el mismo criterio: nada que el dato no sostenga. */
export function textoDeReapertura(reabiertoPor: ReabiertoPor): string {
  const historial = 'Mirá el historial para seguir la conversación.';
  if (reabiertoPor === 'INQUILINO') {
    return `Le avisamos a la inmobiliaria para que vuelva a intervenir. ${historial}`;
  }
  if (reabiertoPor === 'INMOBILIARIA') return `Lo están revisando de nuevo. ${historial}`;
  return `Volvió a estar en curso. ${historial}`;
}
