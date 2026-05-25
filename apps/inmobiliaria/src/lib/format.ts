import type { Moneda } from './types';

const formatters: Record<Moneda, Intl.NumberFormat> = {
  ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
};

export function formatMonto(monto: number, moneda: Moneda = 'ARS'): string {
  return formatters[moneda].format(monto);
}

/**
 * Parsea una fecha respetando la zona horaria local del usuario.
 *
 * Tomar `new Date('2026-08-31')` directo es peligroso: JS lo interpreta
 * como UTC 00:00, y al renderizar en Argentina (UTC-3) muestra "30 ago"
 * — un día menos. Este wrapper detecta el formato yyyy-mm-dd "puro" y
 * lo construye con el constructor (year, month, day) que SÍ es local.
 * Para strings con hora explícita (ISO completo) deja que `new Date()`
 * haga su trabajo normalmente.
 */
function parseLocal(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

export function formatFecha(iso: string): string {
  const d = parseLocal(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Formato compacto: "7 abr" si es del año actual, "7 abr 2025" si es de
// otro. Para mostrar fechas en metalines/cards donde "07/04/2026" se ve
// pesado. Consistente con app del inquilino.
const MESES_CORTOS_FMT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export function formatFechaCorta(iso: string): string {
  const d = parseLocal(iso);
  const dia = d.getDate();
  const mes = MESES_CORTOS_FMT[d.getMonth()];
  const esMismoAnio = d.getFullYear() === new Date().getFullYear();
  return esMismoAnio ? `${dia} ${mes}` : `${dia} ${mes} ${d.getFullYear()}`;
}

/**
 * Rango de vigencia "X → Y" donde SIEMPRE se incluye el año en ambos
 * extremos, incluso si coinciden con el año actual. Esto evita la
 * confusión de "31 ago 2023 → 30 ago" donde el endpoint sin año hace
 * dudar de qué año cierra el contrato. Se usa en listas de contratos,
 * cards de propiedades y resúmenes de propietarios.
 */
export function formatRangoVigencia(inicioIso: string, finIso: string): string {
  const di = parseLocal(inicioIso);
  const df = parseLocal(finIso);
  const fmt = (d: Date) =>
    `${d.getDate()} ${MESES_CORTOS_FMT[d.getMonth()]} ${d.getFullYear()}`;
  return `${fmt(di)} → ${fmt(df)}`;
}

export function diasHastaVencimiento(iso: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = parseLocal(iso);
  d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

/** Período actual en formato yyyy-mm (igual que rendiciones-storage). */
export function periodoActualFormat(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
