/**
 * Qué parte de lo cobrado es ALQUILER. Es el número del que salen la comisión y la rendición.
 *
 * LA REGLA, en una línea: se capea lo cobrado al total de la cuota y recién ahí se prorratea.
 *
 *   - **El cap saca la mora.** Un pago que incluye punitorios hace `cobrado > total`. Sin cap,
 *     la porción de alquiler superaría el alquiler devengado: se rendiría de más y se
 *     comisionaría sobre la mora, que es ingreso de la inmobiliaria y no base de comisión.
 *   - **El prorrateo saca las expensas.** Van al consorcio, no al dueño. No hace falta restarlas
 *     aparte: la proporción `alquiler / total` ya las deja afuera.
 *   - **El guard de `base > 0` no es defensivo de más.** Una cuota en total 0 —un
 *     `SOLO_EXPENSAS` sin expensas cargadas— daría `0/0 = NaN`, y el NaN se propaga en silencio:
 *     se serializa como `null` y la pantalla se ve vacía en vez de fallar, o un `NaN > 0.01` da
 *     `false` y un guard deja pasar un cambio que debía frenar.
 *
 * POR QUÉ VIVE EN `shared` Y NO EN CADA APP. Estaba escrita CUATRO veces —`api/lib/cierre-caja`,
 * `api/lib/rendicion-pendiente`, la rendición en `api/routes/plata` y el KPI del panel— y el
 * documento de invariantes decía que las copias "coinciden", verificado leyendo. La lectura se
 * quedó corta: listaba las tres del server y no veía la del panel, que **había derivado** —
 * prorrateaba contra un total que YA traía la mora sumada, así que le mostraba a la inmobiliaria
 * menos alquiler cobrado del que la rendición efectivamente iba a pagar. Con mora, 45,45 donde
 * se pagaban 50.
 *
 * Una regla de plata copiada en cuatro lados no se sostiene con disciplina. Acá hay una sola, y
 * `packages/shared` es donde puede vivir porque tanto `apps/api` como `apps/inmobiliaria`
 * dependen de él.
 *
 * `test/prorrateo-sin-copias.test.ts` en `apps/api` se pone rojo si aparece una quinta copia.
 */
export interface ProrrateoParams {
  /** Alquiler devengado del período. Sin expensas, sin mora. */
  alquiler: number;
  /**
   * Alquiler + expensas. **SIN mora** — ese es el punto y el error fácil.
   *
   * Ojo de dónde sale: el `montoTotal` que devuelve el API viene decorado por `conSaldo` con el
   * punitorio al día. Ese NO sirve acá: hay que restarle `montoPunitorio`, o armar la base
   * sumando los componentes.
   */
  base: number;
  /** Lo efectivamente cobrado (pagos conciliados). Puede superar la base si pagó la mora. */
  cobrado: number;
}

export function porcionAlquilerCobrada(p: ProrrateoParams): number {
  if (!(p.base > 0)) return 0;
  // El cap corta la mora: pagar de más no aumenta lo que se rinde ni lo que se comisiona.
  const cobradoCapeado = Math.min(p.cobrado, p.base);
  // Un cobrado negativo no genera crédito a favor de nadie.
  if (cobradoCapeado <= 0) return 0;
  return cobradoCapeado * (p.alquiler / p.base);
}
