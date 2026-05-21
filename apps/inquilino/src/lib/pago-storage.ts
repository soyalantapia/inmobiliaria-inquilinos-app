'use client';

// Persistencia local del estado del pago. En backend real esto vive en la
// tabla `pagos` con estado = INFORMADO/CONCILIADO. Acá guardamos el snapshot
// suficiente para que la UI muestre "Pendiente de validación" después de
// que el inquilino sube el comprobante.

import type { ExtraccionIA } from './extraccion-ia';

const KEY_PREFIX = 'llave:pago';
const VERSION = 1;

export type EstadoLocalPago = 'INFORMADO' | 'CONCILIADO' | 'RECHAZADO';

export interface PagoInformado {
  v: number;
  liqId: string;
  estado: EstadoLocalPago;
  monto: number;
  nroOperacion: string | null;
  comprobanteFileName: string | null;
  comprobanteDataUrl: string | null; // preview de la imagen (solo si es jpg/png)
  comprobanteSize: number;
  comprobanteMime: string;
  enviadoAt: string; // ISO
  /**
   * Lectura por IA del comprobante (monto, fecha, CBU origen, banco,
   * titular, CUIT, nro de operación). Opcional para no romper datos
   * pre-existentes; se setea cuando el inquilino sube el archivo.
   */
  extraccionIA?: ExtraccionIA;
}

const buildKey = (liqId: string) => `${KEY_PREFIX}:${liqId}`;

export function guardarPagoInformado(payload: Omit<PagoInformado, 'v'>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      buildKey(payload.liqId),
      JSON.stringify({ v: VERSION, ...payload }),
    );
  } catch {
    // ignore
  }
}

export function leerPagoInformado(liqId: string): PagoInformado | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(buildKey(liqId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PagoInformado;
    if (parsed.v !== VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function olvidarPagoInformado(liqId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(buildKey(liqId));
}
