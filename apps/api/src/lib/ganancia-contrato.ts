/**
 * Cálculo de la ganancia (comisión) de la inmobiliaria por contrato. Compartido por
 * GET /contratos/:id/ganancia y GET /propiedades/:id/ganancias para que ambos usen
 * exactamente la misma fórmula.
 *
 *  - `ganado`  = comisión REALIZADA/congelada: Σ(AlquilerRendido.monto × rendicion.comisionPct/100).
 *    `AlquilerRendido.monto` es la base bruta de alquiler del dueño (ya capea mora y excluye
 *    expensas); `plata.ts` congela `comisionMonto = Σ(monto) × comisionPct`, así que la parte de
 *    un contrato es lineal en su `monto`.
 *  - `proyeccion` = comisión sobre la vida del contrato: Σ(liquidacion.montoAlquiler) × tasa.
 *  - `tasa` = Σ(participación/100 × propietario.comisionPct/100) de los dueños de la propiedad.
 *
 * LOCKED: solo sobre alquiler; en PROPIETARIO_DIRECTO la inmo no comisiona → todo 0.
 */
export const r2c = (n: number) => Math.round(n * 100) / 100;

/**
 * Tasa de comisión ponderada por los dueños de una propiedad (0.08 = 8%).
 *
 * ⚠️ Las participaciones que entran acá NO se filtran por `Propietario.activo`, y
 * es a propósito. La tasa es Σ(participación × comisionPct) sobre el 100% de la
 * propiedad: sacar del cálculo a un dueño dado de baja no lo saca de la escritura,
 * sólo hace que la suma dé de menos y la inmobiliaria comisione menos de lo que
 * le corresponde. La baja lógica corta el ACCESO al portal, no la titularidad.
 *
 * Si un dueño realmente dejó de serlo, lo que hay que cambiar es el reparto de
 * participaciones (`PUT /propiedades/:id/participaciones`), no este cálculo.
 *
 * La misma fórmula está duplicada inline en `plata.ts` (cierre de caja): si esta
 * regla cambia, hay que tocar los dos lados.
 */
export function tasaComisionDeParticipaciones(
  participaciones: { porcentaje: number; propietario: { comisionPct: number } | null }[],
): number {
  return participaciones.reduce(
    (acc, p) => acc + (p.porcentaje / 100) * ((p.propietario?.comisionPct ?? 0) / 100),
    0,
  );
}

export interface Ganancia {
  modoCobranza: string;
  /** tasa como % (ej. 8). */
  tasaComision: number;
  ganado: number;
  proyeccion: number;
  faltaGanar: number;
}

/**
 * Combina los agregados ya calculados en el resultado final.
 * @param modoCobranza     del contrato ('INMOBILIARIA' | 'PROPIETARIO_DIRECTO')
 * @param totalAlquiler    Σ montoAlquiler de las liquidaciones del contrato
 * @param tasa             tasa ponderada (0.08 = 8%)
 * @param rendido          Σ(AlquilerRendido.monto × rendicion.comisionPct/100) del contrato
 */
export function armarGanancia(
  modoCobranza: string,
  totalAlquiler: number,
  tasa: number,
  rendido: number,
): Ganancia {
  const directo = modoCobranza !== 'INMOBILIARIA';
  const ganado = directo ? 0 : r2c(rendido);
  const proyeccion = directo ? 0 : r2c(totalAlquiler * tasa);
  return {
    modoCobranza,
    tasaComision: directo ? 0 : r2c(tasa * 100),
    ganado,
    proyeccion,
    faltaGanar: r2c(Math.max(proyeccion - ganado, 0)),
  };
}
