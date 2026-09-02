/**
 * LA REGLA DE "ESTA VENCIDA", EN UN SOLO LUGAR.
 *
 * Vivía copiada en tres archivos y las copias divergieron. La que más costó es la tercera:
 * `anuncios.ts` derivaba el estado con `l.estado === 'VENCIDO'` a secas —o sea, mirando el enum
 * PERSISTIDO— y su comentario decía "Mismo derivado que GET /contratos". Era falso, y el costo
 * era plata: el barrido `marcarLiquidacionesVencidas` NO toca las PARCIAL a propósito, así que
 * la cuota de un inquilino que pagó una parte nunca vira a VENCIDO. Ese inquilino quedaba
 * afuera de `INQUILINOS_MOROSOS` (no es VENCIDO) y también de `INQUILINOS_PENDIENTES` (no es
 * PENDIENTE): **el que más necesita el aviso era el único que no lo recibía.**
 *
 * La cuarta copia era `lib/aplicar-deposito.ts`, con el nombre `esExigible` y el cuerpo
 * idéntico; ahora importa de acá.
 *
 * Que estén juntas no es prolijidad: es que la próxima corrección entre UNA vez.
 */
import { yaVencio } from '@llave/shared';

/**
 * Una liquidación cuenta como VENCIDA (a efectos de cobranza) si su estado ya es
 * VENCIDO, o si todavía no está paga (PENDIENTE/PARCIAL) y su vencimiento pasó.
 * El estado persistido sólo vira a VENCIDO cuando corre el barrido del devengo
 * (marcarLiquidacionesVencidas); esta derivación on-read cubre el hueco entre
 * corridas Y captura el parcial vencido (estado PARCIAL), que si no nunca volvía
 * a figurar como moroso en el panel (auditoría A2).
 */
export function liqVencida(l: { estado: string; fechaVencimiento: Date | string }, now: Date): boolean {
  if (l.estado === 'VENCIDO') return true;
  if (l.estado === 'PENDIENTE' || l.estado === 'PARCIAL') return yaVencio(l.fechaVencimiento, now);
  return false;
}

/**
 * Liquidación que define `estadoPagoActual` de un contrato. Prioridad:
 * (1) la vencida más reciente — la cobranza manda; (2) la del período en curso
 * o, si no existe, la más reciente NO futura; (3) contrato que recién arranca
 * (solo liqs futuras): la próxima. `liqs` DEBE venir ordenada periodo desc.
 *
 * Antes era `vencida ?? liqs[0]`: como el devengo genera la liq del mes
 * SIGUIENTE por adelantado, `[0]` era esa futura y un contrato con el mes en
 * curso PAGADO reportaba el estado de la cuota del mes que viene → el
 * dashboard "Plata · <mes>" mostraba Cobrado $0 con el mes al día, Por cobrar
 * con plata del mes siguiente, y un adelanto PARCIAL futuro hacía desaparecer
 * el contrato de todos los KPIs (bug "estadísticas principales", 07/07).
 * El período se toma en hora argentina (UTC-3), igual que /caja/cierre.
 */
export function liqQueDefineEstado<
  T extends { periodo: string; estado: string; fechaVencimiento: Date | string },
>(liqs: T[], now: Date): T | null {
  const periodoActual = new Date(now.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 7);
  return (
    liqs.find((l) => liqVencida(l, now)) ??
    liqs.find((l) => l.periodo <= periodoActual) ??
    liqs[0] ??
    null
  );
}
