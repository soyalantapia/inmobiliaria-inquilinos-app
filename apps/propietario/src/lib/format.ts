/** Formatos compartidos por las cuatro pestañas del portal. */

export const money = (n: number, moneda: 'ARS' | 'USD' = 'ARS'): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(n);

export const fecha = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

export const periodoLargo = (p: string): string => {
  const [y, m] = p.split('-');
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${meses[Number(m) - 1] ?? p} ${y}`;
};
