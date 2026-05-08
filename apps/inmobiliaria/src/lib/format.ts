import type { Moneda } from './types';

const formatters: Record<Moneda, Intl.NumberFormat> = {
  ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
};

export function formatMonto(monto: number, moneda: Moneda = 'ARS'): string {
  return formatters[moneda].format(monto);
}

export function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
