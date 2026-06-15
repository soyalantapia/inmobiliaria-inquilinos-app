'use client';

/**
 * Red de profesionales del panel desde el API real (GET /profesionales), con
 * fallback al store local solo en build demo (!apiEnabled). Mapea la respuesta
 * Prisma al tipo ProfesionalAdmin que renderiza la pantalla. El API todavía no
 * expone los derivados de la operación (cant. de trabajos / último trabajo): se
 * dejan en 0 / null y la UI los completa con reclamos y calificaciones locales.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import { listarProfesionalesAdmin } from '@/lib/profesionales-storage';
import type { CategoriaProfesional, ProfesionalAdmin } from '@/lib/mock-data';

interface ProfesionalApi {
  id: string;
  nombre: string;
  categoria: CategoriaProfesional;
  telefono: string;
  email: string | null;
  rating: number | string;
  activo: boolean;
  zona: string | null;
  notas: string | null;
  createdAt: string;
}

function mapProfesional(p: ProfesionalApi): ProfesionalAdmin {
  return {
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria,
    zona: p.zona ?? '',
    telefono: p.telefono,
    email: p.email ?? null,
    rating: p.rating != null ? Number(p.rating) : 0,
    // El API aún no expone estos derivados de la operación.
    cantTrabajos: 0,
    ultimoTrabajo: null,
    // El API no marca verificación; en prod no asumimos verificado.
    verificado: false,
    notas: p.notas ?? null,
    activo: p.activo,
  };
}

export function useProfesionales(): {
  profesionales: ProfesionalAdmin[];
  cargando: boolean;
  deApi: boolean;
} {
  const q = useQuery({
    queryKey: ['profesionales'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<ProfesionalApi[]>('/profesionales');
      return data.map(mapProfesional);
    },
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  if (!apiEnabled) return { profesionales: listarProfesionalesAdmin(), cargando: false, deApi: false };
  if (q.isError) return { profesionales: [], cargando: false, deApi: true };
  return { profesionales: q.data ?? [], cargando: q.isPending, deApi: true };
}
