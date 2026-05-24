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

export function diasHastaVencimiento(iso: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  return Math.floor((d.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

// Devuelve mes capitalizado + año ("Mayo 2026") — antes era minúscula
// ("mayo 2026") que se leía como typo. Consistente con la app del inquilino.
export function formatPeriodo(periodo: string): string {
  const [year, month] = periodo.split('-');
  if (!year || !month) return periodo;
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  const m = Number(month) - 1;
  return `${meses[m] ?? month} ${year}`;
}
