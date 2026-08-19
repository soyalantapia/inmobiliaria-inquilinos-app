/**
 * Normaliza un número de documento para GUARDARLO y para BUSCARLO.
 *
 * POR QUÉ: `Persona.dni` es la llave con la que el sistema decide si dos contratos son de la
 * MISMA persona (`@@unique([inmobiliariaId, dni])`, y `buscarOCrearPersona` lo consulta primero
 * porque es más estable que el email). Pero nadie lo normalizaba del lado que escribe: el alta
 * hacía `.trim()` y la importación de cartera también. O sea que una planilla con `20.123.456`
 * dejaba la ficha guardada con los puntos, y al tipear `20123456` no matcheaba **nada**: ni el
 * `contains` del buscador la traía, ni la dedup la unía — se creaba una Persona duplicada.
 *
 * Son justo las fichas viejas, las que Camila quería que el sistema reconociera. Y desde
 * T-24-N2 la **ausencia** del cartel "esta persona ya está en tu cartera" se lee como una
 * afirmación —"no está"— que en esos casos es falsa.
 *
 * Es el gemelo de `normalizarEmail`: mismo problema, mismo criterio, escribir y buscar con la
 * misma forma.
 *
 * ── LO QUE NO HACE ────────────────────────────────────────────────────────────────────────
 * **No convierte un CUIT en DNI.** La importación acepta `cuit` y `cuil` como sinónimos de la
 * columna DNI (`importacion-cartera.ts:30`), así que en esa columna conviven `20123456` y
 * `20123456789`. Recortar el CUIT a su DNI sería adivinar: el prefijo depende del género y el
 * dígito verificador del cálculo, y un recorte mal hecho fusionaría dos personas distintas bajo
 * una sola ficha. Unificar eso es una decisión de producto aparte; acá sólo se saca lo que no
 * es dígito.
 */
export function normalizarDni(input: string | undefined | null): string | null {
  const soloDigitos = (input ?? '').replace(/\D/g, '');
  // Vacío → null, no cadena vacía: la columna es opcional y `@@unique([inmobiliariaId, dni])`
  // trata los NULL como distintos entre sí, que es justo lo que hace falta para que muchas
  // personas sin documento cargado convivan. Un `''` sería un valor real y chocaría.
  return soloDigitos || null;
}
