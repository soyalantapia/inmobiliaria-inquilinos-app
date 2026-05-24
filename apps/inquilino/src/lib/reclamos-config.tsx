import {
  Droplets,
  Flame,
  KeyRound,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Categoria, EstadoReclamo, Urgencia } from './types';

// Mapeo categoría → icono Lucide. Plomería usa Droplets (gotas) y NO Plug
// (enchufe) — antes mapeaba a Plug y confundía con Electricidad en la lista,
// el form y el detalle.
export const categoriaIcono: Record<Categoria, LucideIcon> = {
  PLOMERIA: Droplets,
  ELECTRICIDAD: Zap,
  CERRADURA: KeyRound,
  CALEFACCION: Flame,
  OTRO: Wrench,
};

export const categoriaLabel: Record<Categoria, string> = {
  PLOMERIA: 'Plomería',
  ELECTRICIDAD: 'Electricidad',
  CERRADURA: 'Cerradura',
  CALEFACCION: 'Calefacción',
  OTRO: 'Otro',
};

export const urgenciaLabel: Record<Urgencia, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  EMERGENCIA: 'Emergencia',
};

export const urgenciaVariant: Record<
  Urgencia,
  'secondary' | 'warning' | 'destructive'
> = {
  BAJA: 'secondary',
  MEDIA: 'warning',
  ALTA: 'warning',
  EMERGENCIA: 'destructive',
};

export const estadoLabel: Record<EstadoReclamo, string> = {
  ABIERTO: 'Abierto',
  EN_CURSO: 'En curso',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
  RECHAZADO: 'Rechazado',
};

export const estadoVariant: Record<
  EstadoReclamo,
  'secondary' | 'warning' | 'success' | 'destructive'
> = {
  ABIERTO: 'destructive',
  EN_CURSO: 'warning',
  RESUELTO: 'success',
  CERRADO: 'secondary',
  RECHAZADO: 'secondary',
};

// Fecha relativa para reclamos:
// - <1 min: "recién"
// - <60 min: "hace X min"
// - <24 hs: "hace X h"
// - <7 días: "hace X días"
// - mismo año: "5 may" (sin año — implícito = año actual)
// - otro año: "15 ene 2024" — antes devolvíamos solo "DD/MM" para reclamos
//   viejos del historial, dejando al usuario adivinando el año (A3 del audit).
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
  const esMismoAnio = fecha.getFullYear() === new Date().getFullYear();
  return fecha.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    ...(esMismoAnio ? {} : { year: 'numeric' }),
  });
}
