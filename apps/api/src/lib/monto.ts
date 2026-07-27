/**
 * Parseo de montos escritos por humanos (extracto de banco, planilla de cartera).
 * FUENTE ÚNICA: lo usan el matching bancario y la importación de cartera. Antes cada
 * uno tenía su propio normalizador y los dos estaban rotos de formas distintas.
 */
/**
 * Parsea un monto de extracto bancario respetando el formato ARGENTINO (punto = miles,
 * coma = decimales), sin romperse con el formato en-US.
 *
 * Antes era `Number(String(v).replace(/[^\d.-]/g, ''))`, que dejaba el punto de miles y
 * lo interpretaba como decimal: "150.000" entraba como **150** (mil veces menos) y
 * "250000,50" como 25000050 (cien veces más), porque la coma se borraba. Ese monto se
 * persiste en CreditoDetectado y de ahí pasa tal cual al Pago conciliado.
 *
 * Regla: el ÚLTIMO separador decide. Si lo siguen 1 o 2 dígitos es el decimal; si lo
 * siguen 3 es separador de miles (1.000). Sin separadores, todo es entero.
 */
export function parsearMonto(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const original = String(v ?? '').trim();
  if (!original) return NaN;
  // Contabilidad: (1.234,56) = negativo. También un '-' en cualquier posición.
  const negativo = /^\(.*\)$/.test(original) || original.includes('-');
  const limpio = original.replace(/[^\d.,]/g, '');
  if (!limpio) return NaN;

  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  const sep = Math.max(ultimaComa, ultimoPunto);
  if (sep >= 0) {
    const decimales = limpio.length - sep - 1;
    if (decimales === 1 || decimales === 2) {
      const entero = limpio.slice(0, sep).replace(/[.,]/g, '');
      const frac = limpio.slice(sep + 1);
      const n = Number(`${entero || '0'}.${frac}`);
      return Number.isFinite(n) ? (negativo ? -n : n) : NaN;
    }
  }
  // Sin decimales reales: todos los separadores son de miles.
  const n = Number(limpio.replace(/[.,]/g, ''));
  return Number.isFinite(n) ? (negativo ? -n : n) : NaN;
}
