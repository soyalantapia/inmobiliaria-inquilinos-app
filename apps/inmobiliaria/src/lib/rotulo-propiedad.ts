/**
 * Cómo se nombra una propiedad en pantalla.
 *
 * POR QUÉ EXISTE: la inmobiliaria no identifica las unidades por la calle. Textual de
 * la prueba del 03/08: "yo me guío directamente por el complejo. Nosotros cuando
 * decimos Lourdes no le decimos nunca Artigas la dirección" y "poneme Castillo planta
 * baja, que en grande me salga el complejo que yo te cargué".
 *
 * El dato ya existía (`Propiedad.complejo`, migración 20260714000000, y el nombre del
 * `Consorcio` cuando la propiedad cuelga de uno) y el API ya lo devolvía — pero el panel
 * sólo lo usaba para BUSCAR, nunca para mostrar. Estas dos funciones son el único lugar
 * donde se decide el rótulo, para que no vuelva a haber tres criterios distintos.
 *
 * Prioridad: consorcio real > complejo (texto libre) > dirección.
 * Si no hay referencia, cae a la dirección sola: nunca queda vacío.
 */

export interface PropiedadRotulable {
  direccion: string;
  complejo?: string | null;
  consorcio?: { nombre: string } | null;
}

/** El nombre por el que la inmobiliaria la reconoce. Es lo que va EN GRANDE. */
export function rotuloPrincipal(p: PropiedadRotulable): string {
  const ref = p.consorcio?.nombre?.trim() || p.complejo?.trim() || '';
  return ref || p.direccion;
}

/**
 * El dato secundario, para no perder la dirección real (hace falta para el contrato,
 * el reclamo y para que el profesional sepa a dónde ir). Vacío si el principal YA es
 * la dirección, para no repetirla dos veces.
 */
export function rotuloSecundario(p: PropiedadRotulable): string {
  const ref = p.consorcio?.nombre?.trim() || p.complejo?.trim() || '';
  return ref ? p.direccion : '';
}

/** Una sola línea, para selects, tablas angostas y textos de WhatsApp. */
export function rotuloEnLinea(p: PropiedadRotulable): string {
  const sec = rotuloSecundario(p);
  return sec ? `${rotuloPrincipal(p)} · ${sec}` : rotuloPrincipal(p);
}
