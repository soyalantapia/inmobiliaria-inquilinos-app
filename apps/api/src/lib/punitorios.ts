/**
 * Punitorio por mora, calculado ON-READ (no se congela en la DB: crece cada día
 * hasta que se paga). Mismo modelo LINEAL que ya usa el front del inquilino
 * (apps/inquilino/src/lib/punitorios.ts):
 *
 *   punitorio = base × (tasaDiaria% / 100) × díasAtraso
 *
 * - `base`: monto sobre el que corre la mora (el montoTotal de la liquidación).
 * - `tasaDiaria`: % por día del contrato (`Contrato.tasaPunitorioDiaria`). Si es
 *    null/0 → NO hay mora (opt-in: sólo cobran los contratos con tasa cargada).
 * - `díasAtraso`: días desde el vencimiento hasta `asOf` (0 si aún no venció).
 * - `asOf`: hoy para una liquidación impaga (sigue corriendo); la fecha de pago
 *    para una ya PAGADA (la mora se congela cuando se saldó).
 */
export function calcularPunitorio(
  base: number,
  tasaDiaria: number | null | undefined,
  fechaVencimiento: Date | string,
  asOf: Date,
): number {
  if (!tasaDiaria || tasaDiaria <= 0 || base <= 0) return 0;
  const venc = new Date(fechaVencimiento);
  venc.setUTCHours(0, 0, 0, 0);
  const ref = new Date(asOf);
  ref.setUTCHours(0, 0, 0, 0);
  const dias = Math.max(0, Math.floor((ref.getTime() - venc.getTime()) / 86400000));
  if (dias === 0) return 0;
  return Math.round(base * (tasaDiaria / 100) * dias * 100) / 100;
}
