/**
 * Historial de canon de un contrato EN CURSO, declarado en el alta.
 *
 * El problema que resuelve: al cargar un contrato que arrancó hace meses, el
 * devengo generaba TODOS los períodos viejos al monto de HOY. En producción los 8
 * contratos con historia tienen `COUNT(DISTINCT montoAlquiler) = 1` — la deuda
 * vieja quedó cobrada al canon actual, que es plata que nadie debe.
 *
 * La solución NO inventa un writer nuevo de `montoAlquiler` (ya hay tres
 * desalineados): reusa el mecanismo de VIGENCIAS que `canonDelPeriodo` ya sabe
 * leer. El operador declara *"desde 2025-10 valía X, desde 2026-04 vale Y"* y acá
 * eso se traduce a filas de `AjusteAlquiler` RETROACTIVAS (una por cambio de
 * canon), que además dejan rastro auditable de por qué cada mes viejo se devengó
 * al precio que se devengó.
 *
 * Puro (sin DB): la validación corre ANTES de abrir la transacción del alta, así
 * un historial mal declarado devuelve 400 sin haber escrito nada.
 *
 * Vive en `shared` y NO en `apps/api` porque el wizard corre exactamente la misma
 * validación mientras se tipea, para que el error se vea antes de confirmar y no
 * como un 400 que tira el alta entera. Dos copias de la misma regla es el bug que
 * ya nos costó F4 (`venc < now` en el front contra `yaVencio` en el back).
 */

/** Una vigencia tal como la declara el wizard: "desde este mes, el canon es éste". */
export type VigenciaCanonInput = { desde: string; monto: number };

/** Fila de `AjusteAlquiler` a materializar (los campos propios de la vigencia). */
export type AjusteDeVigencia = { periodoDesde: string; montoAnterior: number; montoNuevo: number };

/**
 * Valida el historial declarado. Devuelve el mensaje de error (castellano, para
 * mandarlo tal cual en el 400) o `null` si está sano.
 *
 * Las reglas no son burocracia: cada una tapa una forma de que el contrato diga
 * una cosa y su historial otra.
 *  - ORDENADAS y sin repetir `desde`: la cadena de `montoAnterior` que se arma
 *    abajo asume orden; desordenada devengaría los meses al revés.
 *  - Ninguna ANTERIOR a `fechaInicio`: un canon de antes de que el contrato
 *    existiera no aplica a ningún período.
 *  - Ninguna POSTERIOR al mes en curso: eso es un ajuste futuro, no historia —
 *    va por POST /contratos/:id/ajustar, que además mueve `proximoAjuste`.
 *  - La ÚLTIMA tiene que coincidir con `monto`: si no, el contrato dice que hoy
 *    vale X y su propio historial dice que vale Y.
 */
export function validarVigenciasCanon(
  vigencias: VigenciaCanonInput[],
  ctx: { periodoInicio: string; periodoActual: string; montoContrato: number },
): string | null {
  if (vigencias.length === 0) return 'Declarás el historial de canon pero no mandaste ninguna vigencia';

  for (let i = 0; i < vigencias.length; i += 1) {
    const v = vigencias[i]!;
    if (v.desde < ctx.periodoInicio) {
      return `La vigencia de ${v.desde} es anterior al inicio del contrato (${ctx.periodoInicio})`;
    }
    if (v.desde > ctx.periodoActual) {
      return `La vigencia de ${v.desde} es posterior al mes en curso (${ctx.periodoActual}) — un canon futuro se carga como ajuste, no como historial`;
    }
    if (i > 0) {
      // Comparación lexicográfica de 'YYYY-MM': válida porque el formato es
      // ancho-fijo (lo garantiza el regex del endpoint).
      const previa = vigencias[i - 1]!;
      if (v.desde === previa.desde) return `La vigencia de ${v.desde} está repetida`;
      if (v.desde < previa.desde) {
        return `Las vigencias tienen que ir de la más vieja a la más nueva: ${v.desde} viene después de ${previa.desde}`;
      }
    }
  }

  const ultima = vigencias[vigencias.length - 1]!;
  if (ultima.monto !== ctx.montoContrato) {
    return `La última vigencia (${ultima.desde}) dice $${ultima.monto} pero el contrato dice $${ctx.montoContrato} — tienen que coincidir`;
  }
  return null;
}

/**
 * Traduce el historial a las filas de `AjusteAlquiler` que hay que crear.
 *
 * Una fila POR CAMBIO de canon: la vigencia más vieja no genera nada (es el punto
 * de partida, no un cambio), y `canonDelPeriodo` la alcanza igual retrocediendo
 * desde la fila siguiente vía `montoAnterior`. Una vigencia que repite el monto de
 * la anterior tampoco deja fila: no es un cambio, sería ruido en el historial de
 * ajustes, y la cadena de `montoAnterior` sigue dando el mismo resultado.
 *
 * Asume la entrada ya validada por `validarVigenciasCanon`.
 */
export function ajustesDeVigenciasCanon(vigencias: VigenciaCanonInput[]): AjusteDeVigencia[] {
  const out: AjusteDeVigencia[] = [];
  for (let i = 1; i < vigencias.length; i += 1) {
    const previa = vigencias[i - 1]!;
    const v = vigencias[i]!;
    if (previa.monto === v.monto) continue;
    out.push({ periodoDesde: v.desde, montoAnterior: previa.monto, montoNuevo: v.monto });
  }
  return out;
}
