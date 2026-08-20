/**
 * Qué cambió en el reparto de una propiedad: el diff entre cómo estaba y cómo queda.
 *
 * POR QUÉ EXISTE COMO FUNCIÓN PURA: el `PUT /propiedades/:id/participaciones` hace
 * `deleteMany` + `createMany`, o sea que **borra el estado anterior**. Si el cálculo del diff
 * viviera adentro del handler, no habría forma de testearlo sin una base — y es el dato del que
 * va a colgar un recorte de privacidad (qué le mostramos al comprador de una unidad sobre el
 * inquilino que ya vivía ahí). Acá se puede probar cada caso.
 */

export interface ParticipacionSimple {
  propietarioId: string;
  porcentaje: number;
}

export interface CambioReparto {
  propietarioId: string;
  /** null = ENTRÓ (no tenía participación antes). */
  porcentajeAnterior: number | null;
  /** null = SALIÓ (dejó de tener participación). */
  porcentajeNuevo: number | null;
}

/**
 * Devuelve SÓLO lo que cambió. Un dueño que sigue igual no genera fila: el historial tiene que
 * poder leerse como "acá pasó algo", no como una foto repetida en cada guardado — si no, el
 * primer registro de una persona dejaría de significar "desde cuándo es dueña".
 */
export function diffParticipaciones(
  antes: ParticipacionSimple[],
  despues: ParticipacionSimple[],
): CambioReparto[] {
  const mapaAntes = new Map(antes.map((p) => [p.propietarioId, p.porcentaje]));
  const mapaDespues = new Map(despues.map((p) => [p.propietarioId, p.porcentaje]));
  const ids = new Set([...mapaAntes.keys(), ...mapaDespues.keys()]);

  const cambios: CambioReparto[] = [];
  for (const propietarioId of ids) {
    const a = mapaAntes.get(propietarioId);
    const d = mapaDespues.get(propietarioId);
    // Sin cambio → no se registra. La comparación es exacta a propósito: `porcentaje` es un
    // Float que entra por un zod `.positive().max(100)`, no el resultado de una cuenta, así
    // que acá no hay error de coma flotante que tolerar.
    if (a === d) continue;
    cambios.push({
      propietarioId,
      porcentajeAnterior: a ?? null,
      porcentajeNuevo: d ?? null,
    });
  }
  return cambios;
}
