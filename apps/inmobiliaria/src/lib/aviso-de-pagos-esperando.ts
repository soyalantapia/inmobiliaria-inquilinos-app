/**
 * P2 · «Si voy a caja, movimiento cero, no tengo tu pago».
 *
 * Camila lo dijo dos veces el 03/08 (`[31:45]` y `[48:31]`) y era razonable: acababa de informar
 * un pago desde el lado del inquilino, entró a Caja y vio un cero. De ahí a «el pago se perdió»
 * hay un paso, y lo dio.
 *
 * El pago estaba. Estaba `INFORMADO`, esperando que alguien lo validara, y **Caja es de gastos**:
 * un pago recién entra cuando se concilia. O sea que el comportamiento era correcto y lo que
 * faltaba era que la pantalla lo dijera — la campana avisa desde otra pantalla, así que quien
 * mira Caja sigue viendo el mismo cero y sacando la misma conclusión.
 *
 * ESTO VIVE APARTE DE LA PANTALLA a propósito: el `isError` del hook trae una regla que es fácil
 * de perder de vista al escribir JSX, y acá se puede poner en rojo.
 */

export interface AvisoPagosEsperando {
  titulo: string;
  detalle: string;
}

/**
 * El aviso de pagos esperando validación, o `null` si no hay nada honesto que decir.
 *
 * `fallo` NO es un detalle: `usePagosInformados` devuelve `pagos: []` cuando la query se cae, y
 * su propia documentación avisa de que eso **no significa «bandeja vacía»**. Con la red rota, un
 * cero es un dato que no medimos — y esta pantalla existe justamente porque un cero sin explicar
 * ya hizo creer una vez que un pago se había perdido. Callar es la única salida que no miente.
 */
export function avisoDePagosEsperando(opts: { cantidad: number; fallo: boolean }): AvisoPagosEsperando | null {
  if (opts.fallo) return null;
  if (opts.cantidad <= 0) return null;
  return {
    titulo:
      opts.cantidad === 1
        ? 'Hay 1 pago de un inquilino esperando que lo valides'
        : `Hay ${opts.cantidad} pagos de inquilinos esperando que los valides`,
    detalle: 'No entran acá hasta que los confirmes: esta pantalla es de gastos.',
  };
}
