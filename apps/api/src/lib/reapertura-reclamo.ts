/**
 * Quién reabrió un reclamo — el dato que la app del inquilino estaba adivinando mal.
 *
 * EL PROBLEMA. Un reclamo REABIERTO es "estado activo + `resueltoAt` no nulo", y hay dos
 * caminos que lo producen:
 *   - el INQUILINO marca PERSISTE (`/mis-reclamos/:id/confirmar`) → EN_CURSO + un evento
 *     `MENSAJE_INQUILINO` con lo que escribió;
 *   - la INMOBILIARIA lo reabre (`POST /reclamos/:id/reabrir`, T-63, para corregir un monto
 *     mal tipeado) → EN_CURSO + un evento `EN_CURSO` con el motivo.
 *
 * La pantalla del inquilino distinguía uno del otro con esta regla, escrita cuando el segundo
 * camino todavía no existía: «en prod no hay ConfirmacionReclamo PERSISTE, así que EN_CURSO +
 * resolución previa sólo puede venir del PERSISTE del inquilino». Dejó de ser cierta el día que
 * se agregó `/reabrir`, y desde entonces, cuando la inmobiliaria reabría un reclamo, al inquilino
 * le aparecía **«Reportaste que sigue»**: la app le atribuía una acción que nunca hizo.
 *
 * POR QUÉ ACÁ Y NO EN LA PANTALLA. La inferencia se hace sobre el log de eventos, o sea que es
 * exactamente la clase de regla que envejece mal en silencio: cuando aparezca un tercer camino
 * de reapertura, tiene que romperse UN test, no quedar mintiendo en una card. Vive del lado del
 * server, es pura y las dos apps la reciben ya resuelta.
 *
 * POR QUÉ NO UN ESTADO `REABIERTO` EN EL ENUM. Es lo que `/reabrir` ya descartó por escrito:
 * pide una migración por una etiqueta, y el estado al que vuelve el reclamo ES "en curso".
 */

/** Quién deshizo el cierre. `null` = no está reabierto, o no hay con qué saberlo. */
export type OrigenReapertura = 'INQUILINO' | 'INMOBILIARIA';

interface EventoMinimo {
  tipo: string;
  fecha: Date;
}

interface ReclamoMinimo {
  estado: string;
  resueltoAt: Date | null;
  eventos?: EventoMinimo[];
}

/**
 * `null` si el reclamo no está reabierto —incluido RECHAZADO, que es terminal aunque conserve
 * `resueltoAt`— o si los eventos no alcanzan para saber quién fue. No se adivina: una card que
 * no sabe quién lo reabrió puede decirlo en neutro; una que se lo atribuye al inquilino
 * equivocado, no.
 */
export function origenDeReapertura(reclamo: ReclamoMinimo): OrigenReapertura | null {
  if (reclamo.resueltoAt === null) return null;
  // Terminales: no hay reapertura que atribuir.
  if (reclamo.estado === 'RESUELTO' || reclamo.estado === 'CERRADO' || reclamo.estado === 'RECHAZADO') {
    return null;
  }
  const corte = reclamo.resueltoAt.getTime();
  // El PRIMER evento posterior a la resolución es el que la deshizo. Los que vengan después
  // —el inquilino comentando sobre un reclamo que ya reabrió la inmobiliaria, o la inmobiliaria
  // tomando uno que reabrió el inquilino— no cambian de quién fue la reapertura.
  const posteriores = [...(reclamo.eventos ?? [])]
    .filter((e) => e.fecha.getTime() > corte)
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  for (const e of posteriores) {
    // El PERSISTE del inquilino deja su mensaje en la misma transacción que el cambio de estado.
    if (e.tipo === 'MENSAJE_INQUILINO') return 'INQUILINO';
    // `/reabrir` y `/tomar` escriben `EN_CURSO`; los dos son la inmobiliaria.
    if (e.tipo === 'EN_CURSO') return 'INMOBILIARIA';
  }
  return null;
}
