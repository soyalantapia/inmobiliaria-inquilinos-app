'use client';

/**
 * Ecosistema — RED COMPARTIDA de profesionales. Directorio y ficha técnica
 * reputacional cross-tenant (agregada + anonimizada; el backend nunca devuelve
 * dirección, inquilino, comentarios ni fotos). Prod-only: la demo no tiene red.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import type { CategoriaProfesional } from '@/lib/mock-data';

export interface RedProfesionalItem {
  id: string;
  nombre: string;
  categoria: CategoriaProfesional;
  zona: string;
  /** Tiene póliza de seguro vigente (se computa server-side). */
  asegurado: boolean;
  ratingPromedio: number;
  reseñas: number;
  trabajos: number;
  enMiCartera: boolean;
}

export interface RedProfesionalFicha extends RedProfesionalItem {
  aseguradora: string | null;
  polizaVence: string | null;
  asignados: number;
  resueltos: number;
  tasaResolucion: number;
  tiempoPromedioHoras: number | null;
  categorias: string[];
  zonas: string[];
  preciosPorCategoria: { categoria: string; min: number; max: number; promedio: number; n: number }[];
  trabajosRecientes: { categoria: string; ciudad: string | null; estrellas: number | null; fecha: string }[];
  contacto: { telefono: string; email: string | null } | null;
}

export interface DatosSeguro {
  aseguradora?: string;
  nroPoliza?: string;
  polizaVence?: string | null;
}

/** Carga/actualiza el seguro de un profesional de MI cartera (self-serve). */
export async function cargarSeguroApi(redId: string, datos: DatosSeguro): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/red/profesionales/${redId}/seguro`, { method: 'PUT', body: JSON.stringify(datos) });
}

export interface RedFiltros {
  categoria?: CategoriaProfesional;
  zona?: string;
  q?: string;
}

export function useRedProfesionales(filtros: RedFiltros): {
  profesionales: RedProfesionalItem[];
  cargando: boolean;
  isError: boolean;
} {
  const params = new URLSearchParams();
  if (filtros.categoria) params.set('categoria', filtros.categoria);
  if (filtros.zona) params.set('zona', filtros.zona);
  if (filtros.q) params.set('q', filtros.q);
  const qs = params.toString();
  const q = useQuery({
    queryKey: ['red-profesionales', qs],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<RedProfesionalItem[]>(`/red/profesionales${qs ? `?${qs}` : ''}`);
    },
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  if (!apiEnabled) return { profesionales: [], cargando: false, isError: false };
  if (q.isError) return { profesionales: [], cargando: false, isError: true };
  return { profesionales: q.data ?? [], cargando: q.isPending, isError: false };
}

export function useFichaRed(id: string | null): {
  ficha: RedProfesionalFicha | null;
  cargando: boolean;
  isError: boolean;
} {
  const q = useQuery({
    queryKey: ['red-profesional', id],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<RedProfesionalFicha>(`/red/profesionales/${id}`);
    },
    enabled: apiEnabled && !!id,
    staleTime: 30_000,
    retry: false,
  });
  if (!apiEnabled) return { ficha: null, cargando: false, isError: false };
  if (q.isError) return { ficha: null, cargando: false, isError: true };
  return { ficha: q.data ?? null, cargando: q.isPending, isError: false };
}

export async function publicarProfesionalApi(id: string): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/profesionales/${id}/publicar`, { method: 'POST' });
}
export async function despublicarProfesionalApi(id: string): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/profesionales/${id}/despublicar`, { method: 'POST' });
}
/** Contrata de la red → crea mi ficha privada linkeada. Devuelve el id de mi ficha. */
export async function contratarDeRedApi(redId: string): Promise<string> {
  await ensureApiSession();
  const prof = await apiFetch<{ id: string }>(`/red/profesionales/${redId}/contratar`, { method: 'POST' });
  return prof.id;
}
