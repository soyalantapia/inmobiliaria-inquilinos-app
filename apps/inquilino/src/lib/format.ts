import type { Moneda } from './types';

const formatters: Record<Moneda, Intl.NumberFormat> = {
  ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
};

export function formatMonto(monto: number, moneda: Moneda = 'ARS'): string {
  return formatters[moneda].format(monto);
}

/**
 * Parsea una fecha respetando la zona horaria local. Detecta 2 formatos
 * "calendáricos" y los normaliza a fecha local:
 *
 *  1. yyyy-mm-dd puro (ej. "2026-08-31").
 *  2. yyyy-mm-ddT00:00:00.000Z (típico de `new Date('yyyy-mm-dd').toISOString()`,
 *     que serializa un día calendárico como UTC 00:00).
 *
 * Cualquier otro ISO con hora explícita (`...T14:22:00-03:00`) se delega
 * a `new Date()` que ya hace lo correcto.
 */
export function parseLocal(iso: string): Date {
  const fechaPura = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (fechaPura) {
    return new Date(Number(fechaPura[1]), Number(fechaPura[2]) - 1, Number(fechaPura[3]));
  }
  const fechaUtcCero = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.000)?Z$/.exec(iso);
  if (fechaUtcCero) {
    return new Date(Number(fechaUtcCero[1]), Number(fechaUtcCero[2]) - 1, Number(fechaUtcCero[3]));
  }
  return new Date(iso);
}

export function formatFecha(iso: string): string {
  const d = parseLocal(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Formato compacto de fecha para filas estrechas — devuelve "7 abr" si es
// del año actual, "7 abr 2025" si es de otro año. Pensado para listas tipo
// /comprobantes donde el período ("Abril 2026") ya da el contexto y la
// fecha "07/04/2026" se truncaba feo.
//
// Construimos manual porque toLocaleDateString('es-AR', { month: 'short' })
// devuelve "31 de ago de 2025" con "de" que infla el ancho. Queremos
// "31 ago 2025" sin la preposición.
const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export function formatFechaCorta(iso: string): string {
  const d = parseLocal(iso);
  const dia = d.getDate();
  const mes = MESES_CORTOS[d.getMonth()];
  const esMismoAnio = d.getFullYear() === new Date().getFullYear();
  return esMismoAnio ? `${dia} ${mes}` : `${dia} ${mes} ${d.getFullYear()}`;
}

/** Período actual en formato yyyy-mm. Sirve para construir strings
 * dinámicos como "Estado al mes de Mayo 2026" sin hardcodear el período. */
export function periodoActualFormat(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Rango de vigencia "X → Y" donde SIEMPRE se incluye el año en ambos
 * extremos, incluso si coinciden con el año actual. Evita la confusión
 * de "31 ago 2023 → 30 ago" donde el endpoint sin año hace dudar de
 * cuándo cierra el contrato. Espejo del helper homónimo en inmo.
 */
export function formatRangoVigencia(inicioIso: string, finIso: string): string {
  const di = parseLocal(inicioIso);
  const df = parseLocal(finIso);
  const fmt = (d: Date) =>
    `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
  return `${fmt(di)} → ${fmt(df)}`;
}

// Formato del período de una liquidación. Devuelve mes capitalizado +
// año: "Abril 2026" (antes "abril 2026", que se leía como typo).
export function formatPeriodo(periodo: string): string {
  const [year, month] = periodo.split('-');
  if (!year || !month) return periodo;
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const m = Number(month) - 1;
  return `${meses[m] ?? month} ${year}`;
}

export function diasHastaVencimiento(iso: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = parseLocal(iso);
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
