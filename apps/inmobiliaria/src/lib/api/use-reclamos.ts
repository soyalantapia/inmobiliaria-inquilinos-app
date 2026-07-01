'use client';

/**
 * Reclamos del panel desde el API real (GET /reclamos), con fallback al store
 * local solo en build demo (!apiEnabled). Mapea al tipo Reclamo de la pantalla.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import { listarReclamos } from '@/lib/reclamos-store';
import type { Reclamo } from '@/lib/types';

interface ReclamoApi {
  id: string;
  contratoId: string;
  propiedadId: string | null;
  categoria: Reclamo['categoria'];
  descripcion: string;
  urgencia: Reclamo['urgencia'];
  estado: Reclamo['estado'];
  resolucion: string | null;
  createdAt: string;
  resueltoAt: string | null;
  fotoUrl: string | null;
  clasificacion: Reclamo['clasificacion'] | null;
  costoTrabajo: number | string | null;
  propiedad: { id: string; direccion: string; ciudad: string } | null;
  contrato: {
    id: string;
    fechaInicio: string | null;
    inquilinoTitular: { id: string; nombre: string; apellido: string | null; telefono: string | null } | null;
  } | null;
  profesional: { id: string; nombre: string; categoria: string; telefono: string | null; rating: number } | null;
}

function mapReclamo(r: ReclamoApi): Reclamo {
  return {
    id: r.id,
    contratoId: r.contratoId,
    inquilino: r.contrato?.inquilinoTitular
      ? `${r.contrato.inquilinoTitular.nombre} ${r.contrato.inquilinoTitular.apellido ?? ''}`.trim()
      : '—',
    direccion: r.propiedad?.direccion ?? '—',
    categoria: r.categoria,
    descripcion: r.descripcion,
    urgencia: r.urgencia,
    estado: r.estado,
    asignadoA: null,
    fotoUrl: r.fotoUrl,
    resolucion: r.resolucion,
    createdAt: r.createdAt,
    resueltoAt: r.resueltoAt,
    eventos: [],
    contratoDesde: r.contrato?.fechaInicio ?? null,
    clasificacion: r.clasificacion ?? null,
    profesionalAsignadoId: r.profesional?.id ?? null,
    profesionalAsignadoNombre: r.profesional?.nombre ?? null,
    profesionalAsignadoTelefono: r.profesional?.telefono ?? null,
    profesionalAsignadoCategoria: r.profesional?.categoria ?? null,
    costoTrabajo: r.costoTrabajo != null ? Number(r.costoTrabajo) : null,
    propiedadId: r.propiedadId,
  };
}

export function useReclamos(): { reclamos: Reclamo[] | null; cargando: boolean; deApi: boolean } {
  const q = useQuery({
    queryKey: ['reclamos'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<ReclamoApi[]>('/reclamos');
      return data.map(mapReclamo);
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  if (!apiEnabled) return { reclamos: listarReclamos(), cargando: false, deApi: false };
  if (q.isError) return { reclamos: [], cargando: false, deApi: true };
  return { reclamos: q.data ?? null, cargando: q.isPending, deApi: true };
}
