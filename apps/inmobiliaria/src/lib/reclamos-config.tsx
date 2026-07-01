import { Flame, KeyRound, Plug, Wrench, Zap, type LucideIcon } from 'lucide-react';
import type { CategoriaReclamo, EstadoReclamo, UrgenciaReclamo } from './types';

export const categoriaIcono: Record<CategoriaReclamo, LucideIcon> = {
  PLOMERIA: Plug,
  ELECTRICIDAD: Zap,
  CERRADURA: KeyRound,
  CALEFACCION: Flame,
  OTRO: Wrench,
};

export const categoriaLabel: Record<CategoriaReclamo, string> = {
  PLOMERIA: 'Plomería',
  ELECTRICIDAD: 'Electricidad',
  CERRADURA: 'Cerradura',
  CALEFACCION: 'Calefacción',
  OTRO: 'Otro',
};

export const urgenciaConfig: Record<
  UrgenciaReclamo,
  { label: string; variant: 'secondary' | 'warning' | 'destructive' }
> = {
  BAJA: { label: 'Baja', variant: 'secondary' },
  MEDIA: { label: 'Media', variant: 'warning' },
  ALTA: { label: 'Alta', variant: 'warning' },
  EMERGENCIA: { label: 'Emergencia', variant: 'destructive' },
};

export const estadoConfig: Record<
  EstadoReclamo,
  { label: string; variant: 'destructive' | 'warning' | 'success' | 'secondary' }
> = {
  ABIERTO: { label: 'Abierto', variant: 'destructive' },
  EN_CURSO: { label: 'En curso', variant: 'warning' },
  RESUELTO: { label: 'Resuelto', variant: 'success' },
  CERRADO: { label: 'Cerrado', variant: 'secondary' },
  RECHAZADO: { label: 'Rechazado', variant: 'secondary' },
};

// Fecha relativa para reclamos del inmo. Consistente con la app inquilino:
// - <1 min: "recién"
// - <60 min: "hace X min"
// - <24 hs: "hace X h"
// - <7 días: "hace X días"
// - mismo año: "5 may" (no "5/5" — más legible)
// - otro año: "15 ene 2024"
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function tiempoRelativo(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} día${d === 1 ? '' : 's'}`;
  const fecha = new Date(iso);
  const mes = MESES_CORTOS[fecha.getMonth()];
  const esMismoAnio = fecha.getFullYear() === new Date().getFullYear();
  return esMismoAnio
    ? `${fecha.getDate()} ${mes}`
    : `${fecha.getDate()} ${mes} ${fecha.getFullYear()}`;
}

/**
 * Antigüedad del inquilino en la propiedad a partir de la fecha de inicio del
 * contrato: "1 año y 2 meses", "8 meses", "20 días". Devuelve null si no hay
 * fecha o es futura (contrato que aún no arrancó). Pensado para el reclamo, para
 * dar contexto de cuánto hace que vive ahí.
 */
export function tiempoEnPropiedad(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const inicio = new Date(iso).getTime();
  if (Number.isNaN(inicio)) return null;
  const dias = Math.floor((Date.now() - inicio) / 86_400_000);
  if (dias < 0) return null;
  if (dias < 31) return `${dias} día${dias === 1 ? '' : 's'}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${meses} mes${meses === 1 ? '' : 'es'}`;
  const anios = Math.floor(meses / 12);
  const mesesRest = meses % 12;
  const aStr = `${anios} año${anios === 1 ? '' : 's'}`;
  return mesesRest === 0 ? aStr : `${aStr} y ${mesesRest} mes${mesesRest === 1 ? '' : 'es'}`;
}
