/**
 * Qué parte de lo cobrado es ALQUILER — el número del que salen la comisión y la rendición.
 *
 * Existe porque el panel lo calculaba en dos lugares y sólo uno estaba bien.
 *
 * La regla, que es la del server (`plata.ts`, al armar la rendición): de lo que entró, la
 * porción de alquiler sale de prorratear contra la **base**, y la base es alquiler + expensas
 * **sin la mora**. La mora no se rinde al propietario y no se comisiona.
 *
 * Dónde se rompía: el KPI del dashboard usaba `l.montoTotal` como base, y ese `montoTotal` NO
 * es el de la fila — viene decorado por `conSaldo` (`apps/api/src/lib/saldos.ts`), que le suma
 * el punitorio calculado al día. El tipo del panel lo dice en su propio comentario ("Mora al
 * día incluida en montoTotal/saldo"), y el comentario de al lado afirmaba lo contrario: que
 * "el cap deja afuera la mora". No la dejaba.
 *
 * Mientras no hay mora los dos denominadores coinciden, que es por qué nadie lo vio. Con un
 * pago parcial sobre una liquidación atrasada se separan: el panel mostraba 45,45 donde la
 * rendición iba a pagar 50.
 *
 * Por eso `base` es un parámetro y no se deduce acá: los dos callers la arman distinto (uno
 * resta el punitorio del total decorado, el otro suma alquiler + expensas) y lo que importa es
 * que ninguno de los dos incluya la mora. Pedirla explícita obliga a decidirlo en cada uso.
 */
export function porcionAlquilerCobrada(p: {
  /** Alquiler devengado del período (sin expensas, sin mora). */
  alquiler: number;
  /** Alquiler + expensas. SIN mora — ese es el punto. */
  base: number;
  /** Lo efectivamente cobrado (pagos conciliados). Puede superar la base si pagó la mora. */
  cobrado: number;
}): number {
  if (p.base <= 0) return 0;
  // El cap corta la mora: pagar de más no aumenta lo que se rinde ni lo que se comisiona.
  const cobradoCapeado = Math.min(p.cobrado, p.base);
  if (cobradoCapeado <= 0) return 0;
  return cobradoCapeado * (p.alquiler / p.base);
}
