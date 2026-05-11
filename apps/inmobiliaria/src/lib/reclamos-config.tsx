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
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}
