/**
 * Qué le cobramos a esta persona, y cómo lo nombramos.
 *
 * POR QUÉ EXISTE: hay ocupantes que **no pagan alquiler**. El alquiler lo arregla el
 * propietario directo con ellos y la inmobiliaria sólo administra el consorcio — Camila,
 * 03/08 `[30:04]`. El backend ya lo modela (`Contrato.tipoContrato = SOLO_EXPENSAS`, que es
 * el único caso en el que el alta acepta `monto === 0`), pero la PWA nunca leyó el campo:
 * le mostraba "Alquiler $0" en el desglose y "Alquiler actual $0" como titular del contrato.
 *
 * Estas funciones son el único lugar donde se decide, para que no queden cinco criterios
 * distintos repartidos por las pantallas.
 */

import type { Contrato, Liquidacion } from './types';

/**
 * ¿Esta persona sólo paga expensas?
 *
 * Se responde por `tipoContrato` y NO por `montoActual === 0`: un contrato en borrador o mal
 * cargado también puede tener monto 0 sin ser de solo expensas, y ahí el rótulo correcto sigue
 * siendo "alquiler". La ausencia del campo (contrato viejo, o el server que no lo mandó) cuenta
 * como alquiler normal: es el comportamiento que la app tuvo siempre.
 */
export function esSoloExpensas(contrato: Pick<Contrato, 'tipoContrato'> | null | undefined): boolean {
  return contrato?.tipoContrato === 'SOLO_EXPENSAS';
}

/**
 * ¿Corresponde mostrar la fila "Alquiler" en el desglose de un período?
 *
 * Va por el dato del período y no por `tipoContrato` a propósito: el desglose recibe la
 * liquidación, no el contrato, y lo que tiene que explicar es **este** importe. Si el alquiler
 * devengado del mes es 0, la fila no aporta nada y "Alquiler $0" sólo confunde. Es el mismo
 * criterio que la fila de Expensas de al lado, que ya se muestra sólo si hay monto.
 */
export function mostrarFilaAlquiler(liq: Pick<Liquidacion, 'montoAlquiler'>): boolean {
  return Number(liq.montoAlquiler) > 0;
}

/**
 * El monto mensual que esta persona realmente debe, y cómo llamarlo. Es el titular de la
 * pantalla de contrato.
 *
 * Para un solo-expensas, `montoActual` es 0 y el número que le importa son las expensas. Si el
 * contrato no las tiene cargadas devolvemos `null` en vez de $0: preferimos no mostrar la cifra
 * antes que mostrar una que miente.
 */
export function montoMensual(contrato: Contrato): { label: string; monto: number | null } {
  if (esSoloExpensas(contrato)) {
    return { label: 'Expensas por mes', monto: contrato.montoExpensas ?? null };
  }
  return { label: 'Alquiler actual', monto: contrato.montoActual };
}

/**
 * Monto de referencia para comparar contra una deuda acumulada (lo que se debe "por mes").
 *
 * Existe por un bug concreto del checkout: se calculaba
 * `contrato?.montoActual ?? liq.montoAlquiler`, y `??` **no** cae en `0`, sólo en null/undefined.
 * Con un solo-expensas (`montoActual === 0`) la referencia quedaba en 0 y el banner de "tu deuda
 * es alta, podés pactar un plan" se disparaba con **cualquier** saldo — incluido un único
 * período al día.
 */
export function montoMensualDeReferencia(
  contrato: Contrato | null | undefined,
  liq: Pick<Liquidacion, 'montoAlquiler' | 'montoExpensas' | 'montoTotal'>,
): number {
  if (esSoloExpensas(contrato)) {
    return Number(contrato?.montoExpensas) || Number(liq.montoExpensas) || Number(liq.montoTotal);
  }
  // `|| ` y no `??`: un 0 acá es "no lo sé", no "cero pesos por mes".
  return Number(contrato?.montoActual) || Number(liq.montoAlquiler) || Number(liq.montoTotal);
}
