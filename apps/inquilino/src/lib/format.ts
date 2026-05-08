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

export function formatPeriodo(periodo: string): string {
  const [year, month] = periodo.split('-');
  if (!year || !month) return periodo;
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const m = Number(month) - 1;
  return `${meses[m] ?? month} ${year}`;
}

export function diasHastaVencimiento(iso: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(iso);
  venc.setHours(0, 0, 0, 0);
  return Math.round((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}
