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

/**
 * Formato humano de duración a partir de días. Genera siempre la misma
 * narrativa: "2 años y 3 meses", "11 meses", "20 días" — eligiendo la
 * granularidad correcta para el rango. Antes había tres formatos distintos
 * en /contrato ("27 meses todavía" + "2 años y 3 meses" + "830 días")
 * compitiendo en la misma pantalla.
 */
export function formatDuracion(dias: number): string {
  if (dias < 0) return 'vencido';
  if (dias < 31) return `${dias} día${dias === 1 ? '' : 's'}`;
  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return `${meses} mes${meses === 1 ? '' : 'es'}`;
  }
  const anios = Math.floor(dias / 365);
  const mesesRestantes = Math.floor((dias % 365) / 30);
  if (mesesRestantes === 0) {
    return `${anios} año${anios === 1 ? '' : 's'}`;
  }
  return `${anios} año${anios === 1 ? '' : 's'} y ${mesesRestantes} mes${mesesRestantes === 1 ? '' : 'es'}`;
}
