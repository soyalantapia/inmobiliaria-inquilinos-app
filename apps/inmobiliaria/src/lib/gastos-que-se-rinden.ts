/**
 * Qué gastos de caja se le descuentan de verdad a un propietario, y cuáles no.
 *
 * EL DEFECTO. El KPI «A rendir a propietarios» del tablero restaba **todos** los gastos con
 * `descontadoEnRendicion: false`. Pero un gasto **sin propiedad** —el alquiler de la oficina, los
 * sueldos, un adelanto entre cajas— no es de la propiedad de nadie, y el propio schema lo dice:
 *
 * > «CONSECUENCIA DE PLATA, deliberada: la rendición filtra los gastos por
 * > `propiedadId IN propIdsConIngreso`, así que un movimiento sin propiedad **NUNCA se le
 * > descuenta a un propietario**.»
 *
 * O sea que su `descontadoEnRendicion` **nunca pasa a true**, porque no hay rendición que lo
 * marque. No es un pendiente: es un gasto de la inmobiliaria que quedó parado en la puerta.
 *
 * Y el tablero se lo restaba a lo que hay que rendirle a los dueños, **todos los meses y para
 * siempre**. El error crece: cada mes de alquiler de oficina y cada sueldo se suma al descuento
 * y nunca sale. El número que la administradora mira para saber cuánto debe rendir es cada vez
 * más chico que la deuda real.
 *
 * LA REGLA. Sólo descuenta lo que la rendición podría descontar: un gasto **con propiedad** que
 * todavía no se rindió. Es la misma condición que aplica el backend, escrita de este lado.
 *
 * ⚠️ LO QUE ESTO NO ARREGLA: la suma sigue mezclando monedas. Un gasto de USD 500 resta 500 del
 * total en pesos. Es un problema del KPI entero —`alquilerCobrado` mezcla igual— y no de estos
 * gastos, así que se arregla aparte; está anotado en `PARA-ALAN.md`.
 */

export interface GastoDeCaja {
  tipo: string;
  /** `null` = movimiento propio de la inmobiliaria, no imputable a ninguna propiedad. */
  propiedadId: string | null;
  descontadoEnRendicion: boolean;
  monto: number;
}

/**
 * ¿Este movimiento va a salir de lo que se le rinde a un propietario?
 *
 * Las tres condiciones son necesarias, y la del medio es la que faltaba.
 */
export function seLeDescuentaAlPropietario(m: GastoDeCaja): boolean {
  if (m.tipo !== 'GASTO') return false;
  // Sin propiedad no hay propietario a quien descontárselo. La rendición nunca lo toma, así que
  // su flag se queda en `false` para siempre y restarlo es restar una deuda que no existe.
  if (m.propiedadId === null) return false;
  return !m.descontadoEnRendicion;
}

/** Lo que todavía hay que descontarle a los propietarios en la próxima rendición. */
export function gastosPendientesDeRendir(movimientos: readonly GastoDeCaja[]): number {
  return movimientos.filter(seLeDescuentaAlPropietario).reduce((a, m) => a + m.monto, 0);
}
