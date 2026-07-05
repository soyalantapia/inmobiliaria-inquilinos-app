'use client';

/**
 * Persistencia local de los pagos informados por el inquilino.
 *
 * v1 → un PagoInformado por liquidación (one-shot, no parciales).
 * v2 → ARRAY de PagoInformado por liquidación. Permite parciales: el
 *      inquilino puede pagar X (con comprobante), después pagar el
 *      saldo (otro comprobante), etc.
 *
 * La migración v1 → v2 es transparente: cuando leemos un liqId que
 * tiene una entrada v1, la envolvemos en `{v:2, pagos:[v1payload]}`,
 * persistimos y borramos la entrada vieja.
 *
 * En backend real esto vive en la tabla `Pago` (con FK a Liquidación)
 * y los parciales son N filas con `imputacionParcial = true`.
 */

import type { ExtraccionIA } from './extraccion-ia';

const KEY_V1_PREFIX = 'llave:pago';
const KEY_V2_PREFIX = 'llave:pagos:v2';

export type EstadoLocalPago = 'INFORMADO' | 'CONCILIADO' | 'RECHAZADO';
export type TipoPago = 'TOTAL' | 'PARCIAL';

export interface PagoInformado {
  v: number;
  /** ID interno del pago (nonce). Permite que haya N pagos por liqId. */
  id: string;
  liqId: string;
  /** TOTAL = monto cubre el saldo; PARCIAL = sólo una parte. */
  tipo: TipoPago;
  estado: EstadoLocalPago;
  monto: number;
  nroOperacion: string | null;
  comprobanteFileName: string | null;
  comprobanteDataUrl: string | null;
  comprobanteSize: number;
  comprobanteMime: string;
  enviadoAt: string;
  /**
   * Lectura por IA del comprobante. Opcional para no romper datos
   * pre-existentes; se setea cuando el inquilino sube el archivo.
   */
  extraccionIA?: ExtraccionIA;
  /**
   * Quién informó el pago (solo prod/API, viene de `PagoDeLiquidacion.autor`):
   * 'vos' | 'otro' | null. En la demo offline queda undefined (no hay co-inquilinos
   * reales que informen), así que la etiqueta no se muestra.
   */
  autor?: 'vos' | 'otro' | null;
}

interface PagosWrapper {
  v: 2;
  pagos: PagoInformado[];
}

const buildKeyV1 = (liqId: string) => `${KEY_V1_PREFIX}:${liqId}`;
const buildKeyV2 = (liqId: string) => `${KEY_V2_PREFIX}:${liqId}`;

function generarPagoId(): string {
  return `pgi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Migración transparente v1 → v2. Si existe una entrada v1 para el
 * liqId, la convierte en array (un único elemento), persiste como v2 y
 * borra la v1.
 */
function migrarSiHaceFalta(liqId: string): PagosWrapper | null {
  if (typeof window === 'undefined') return null;
  try {
    const v2raw = window.localStorage.getItem(buildKeyV2(liqId));
    if (v2raw) {
      const parsed = JSON.parse(v2raw) as PagosWrapper;
      if (parsed.v === 2 && Array.isArray(parsed.pagos)) return parsed;
    }
    const v1raw = window.localStorage.getItem(buildKeyV1(liqId));
    if (!v1raw) return null;
    const v1 = JSON.parse(v1raw) as Omit<PagoInformado, 'id' | 'tipo'> & {
      v: number;
    };
    if (v1.v !== 1) return null;
    const migrado: PagoInformado = {
      ...v1,
      v: 1,
      id: generarPagoId(),
      tipo: 'TOTAL', // los v1 son siempre totales (no había parciales)
    };
    const wrapper: PagosWrapper = { v: 2, pagos: [migrado] };
    window.localStorage.setItem(buildKeyV2(liqId), JSON.stringify(wrapper));
    window.localStorage.removeItem(buildKeyV1(liqId));
    return wrapper;
  } catch {
    return null;
  }
}

/** Lista todos los pagos informados para una liquidación. */
export function listarPagosDeLiq(liqId: string): PagoInformado[] {
  const wrapper = migrarSiHaceFalta(liqId);
  return wrapper?.pagos ?? [];
}

/** Guarda un wrapper v2 directamente (uso interno). */
function persistirPagos(liqId: string, pagos: PagoInformado[]): void {
  if (typeof window === 'undefined') return;
  try {
    const wrapper: PagosWrapper = { v: 2, pagos };
    window.localStorage.setItem(buildKeyV2(liqId), JSON.stringify(wrapper));
  } catch {
    // ignore
  }
}

/**
 * Agrega un pago nuevo (parcial o total) al listado de la liquidación.
 * Devuelve el pago persistido (con `id` ya generado).
 */
export function agregarPago(
  payload: Omit<PagoInformado, 'v' | 'id'>,
): PagoInformado {
  const pago: PagoInformado = {
    ...payload,
    v: 1,
    id: generarPagoId(),
  };
  const previos = listarPagosDeLiq(payload.liqId);
  persistirPagos(payload.liqId, [...previos, pago]);
  return pago;
}

/* ============================================================
 * API legacy v1
 *
 * Se mantiene para que el resto del código que todavía usaba el
 * "un pago por liq" no se rompa. Internamente delega a la API v2.
 * ============================================================ */

/** Reemplaza todos los pagos previos por uno nuevo (uso legacy). */
export function guardarPagoInformado(
  payload: Omit<PagoInformado, 'v' | 'id' | 'tipo'> & { tipo?: TipoPago },
): PagoInformado {
  const pago: PagoInformado = {
    ...payload,
    v: 1,
    id: generarPagoId(),
    tipo: payload.tipo ?? 'TOTAL',
  };
  persistirPagos(payload.liqId, [pago]);
  return pago;
}

/** Devuelve el pago MÁS RECIENTE para la liquidación. */
export function leerPagoInformado(liqId: string): PagoInformado | null {
  const pagos = listarPagosDeLiq(liqId);
  if (pagos.length === 0) return null;
  return pagos[pagos.length - 1] ?? null;
}

/** Borra todos los pagos de la liquidación. */
export function olvidarPagoInformado(liqId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(buildKeyV2(liqId));
    window.localStorage.removeItem(buildKeyV1(liqId));
  } catch {
    // ignore
  }
}

/* ============================================================
 * Helpers para parciales
 * ============================================================ */

/**
 * Total informado por el inquilino para una liquidación: suma de los
 * montos de todos los pagos (parciales + total) que NO fueron rechazados
 * por el inmo (los rechazados no cuentan al saldo).
 *
 * Importante: acá contamos también los que están INFORMADO (en
 * revisión) porque el inquilino confía en que ya pagó esa plata.
 * Si el inmo después rechaza, el saldo "vuelve a aparecer" y el
 * inquilino debe re-informar (esa transición la maneja la UI con
 * el banner de rechazo).
 */
export function totalInformadoParaLiq(liqId: string): number {
  return listarPagosDeLiq(liqId)
    .filter((p) => p.estado !== 'RECHAZADO')
    .reduce((acc, p) => acc + p.monto, 0);
}

/**
 * Saldo pendiente para una liquidación dada. Devuelve max(0, total - informado).
 * El "total" es lo que el inquilino debería pagar (monto liquidación
 * + punitorios). El llamador es responsable de pasar ese número.
 */
export function saldoPendiente(liqId: string, totalAPagar: number): number {
  return Math.max(0, Math.round(totalAPagar - totalInformadoParaLiq(liqId)));
}

/**
 * Estado agregado de la liquidación desde el lado del inquilino:
 * - SIN_INFORMAR: no hay ningún pago todavía
 * - PARCIAL: hay informado(s) que no cubren el total
 * - COMPLETO: la suma de informados cubre el total
 */
export type EstadoAgregadoLiq = 'SIN_INFORMAR' | 'PARCIAL' | 'COMPLETO';

export function estadoAgregadoLiq(
  liqId: string,
  totalAPagar: number,
): EstadoAgregadoLiq {
  const pagos = listarPagosDeLiq(liqId);
  if (pagos.length === 0) return 'SIN_INFORMAR';
  const informado = totalInformadoParaLiq(liqId);
  if (informado >= totalAPagar) return 'COMPLETO';
  return 'PARCIAL';
}
