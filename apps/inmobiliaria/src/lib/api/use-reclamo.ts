'use client';

/**
 * Detalle de un reclamo del panel desde el API real (GET /reclamos/:id) +
 * mutaciones (asignar profesional, resolver, rechazar, responder). Mapea al
 * tipo Reclamo de la pantalla, incluyendo los eventos reales del timeline.
 *
 * En build demo (!apiEnabled) cae al reclamos-store local (localStorage), que
 * es lo que la pantalla usaba antes — así la demo no se rompe.
 */
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import { obtenerReclamo } from '@/lib/reclamos-store';
import { profesionalCategoriaLabelAdmin, type CategoriaProfesional } from '@/lib/mock-data';
import type { EventoReclamo, Reclamo } from '@/lib/types';

interface EventoApi {
  id: string;
  tipo: EventoReclamo['tipo'];
  autor: string;
  contenido: string | null;
  fecha: string;
}

interface ReclamoDetalleApi {
  id: string;
  contratoId: string;
  propiedadId: string | null;
  categoria: Reclamo['categoria'];
  descripcion: string;
  urgencia: Reclamo['urgencia'];
  estado: Reclamo['estado'];
  asignadoA: string | null;
  resolucion: string | null;
  createdAt: string;
  resueltoAt: string | null;
  fotoUrl: string | null;
  clasificacion: Reclamo['clasificacion'] | null;
  costoTrabajo: number | string | null;
  costoTrabajoNotas: string | null;
  propiedad: { id: string; direccion: string; ciudad: string } | null;
  contrato: {
    id: string;
    inquilinoTitular: {
      id: string;
      nombre: string;
      apellido: string | null;
      telefono: string | null;
      email: string | null;
    } | null;
  } | null;
  profesional: {
    id: string;
    nombre: string;
    categoria: CategoriaProfesional | string;
    telefono: string | null;
  } | null;
  rating: { estrellas: number; comentario: string | null; enviadoAt: string } | null;
  eventos?: EventoApi[];
}

function categoriaProfLabel(cat: CategoriaProfesional | string | null): string | null {
  if (!cat) return null;
  return profesionalCategoriaLabelAdmin[cat as CategoriaProfesional] ?? cat;
}

function mapReclamo(r: ReclamoDetalleApi): Reclamo {
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
    asignadoA: r.asignadoA ?? null,
    fotoUrl: r.fotoUrl,
    resolucion: r.resolucion,
    createdAt: r.createdAt,
    resueltoAt: r.resueltoAt,
    eventos: (r.eventos ?? []).map((e) => ({
      id: e.id,
      tipo: e.tipo,
      autor: e.autor,
      contenido: e.contenido,
      fecha: e.fecha,
    })),
    clasificacion: r.clasificacion ?? null,
    profesionalAsignadoId: r.profesional?.id ?? null,
    profesionalAsignadoNombre: r.profesional?.nombre ?? null,
    profesionalAsignadoTelefono: r.profesional?.telefono ?? null,
    profesionalAsignadoCategoria: categoriaProfLabel(r.profesional?.categoria ?? null),
    costoTrabajo: r.costoTrabajo != null ? Number(r.costoTrabajo) : null,
    costoTrabajoNotas: r.costoTrabajoNotas ?? null,
    propiedadId: r.propiedadId,
    ratingInquilino: r.rating
      ? { estrellas: r.rating.estrellas, comentario: r.rating.comentario, enviadoAt: r.rating.enviadoAt }
      : null,
  };
}

export interface ContactoInquilino {
  telefono: string | null;
  email: string | null;
}

export interface UseReclamoResult {
  reclamo: Reclamo | null | undefined;
  cargando: boolean;
  deApi: boolean;
  /** Contacto real del inquilino del API en prod; null en demo (lo resuelve el mock). */
  contacto: ContactoInquilino | null;
  asignar: (profesionalId: string) => Promise<void>;
  resolver: (resolucion: string) => Promise<void>;
  rechazar: (motivo: string) => Promise<void>;
  responder: (mensaje: string) => Promise<void>;
}

export function useReclamo(id: string | undefined): UseReclamoResult {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['reclamo', id],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<ReclamoDetalleApi>(`/reclamos/${id}`);
      const contacto: ContactoInquilino = {
        telefono: data.contrato?.inquilinoTitular?.telefono ?? null,
        email: data.contrato?.inquilinoTitular?.email ?? null,
      };
      return { reclamo: mapReclamo(data), contacto };
    },
    enabled: apiEnabled && !!id,
    staleTime: 15_000,
  });

  const invalidar = async () => {
    await qc.invalidateQueries({ queryKey: ['reclamo', id] });
    await qc.invalidateQueries({ queryKey: ['reclamos'] });
  };

  const asignarM = useMutation({
    mutationFn: async (profesionalId: string) => {
      await ensureApiSession();
      await apiFetch(`/reclamos/${id}/asignar`, {
        method: 'POST',
        body: JSON.stringify({ profesionalId }),
      });
    },
    onSuccess: invalidar,
  });

  const resolverM = useMutation({
    mutationFn: async (resolucion: string) => {
      await ensureApiSession();
      await apiFetch(`/reclamos/${id}/resolver`, {
        method: 'POST',
        body: JSON.stringify({ resolucion }),
      });
    },
    onSuccess: invalidar,
  });

  const rechazarM = useMutation({
    mutationFn: async (motivo: string) => {
      await ensureApiSession();
      await apiFetch(`/reclamos/${id}/rechazar`, {
        method: 'POST',
        body: JSON.stringify({ motivo }),
      });
    },
    onSuccess: invalidar,
  });

  const responderM = useMutation({
    mutationFn: async (mensaje: string) => {
      await ensureApiSession();
      await apiFetch(`/reclamos/${id}/responder`, {
        method: 'POST',
        body: JSON.stringify({ mensaje }),
      });
    },
    onSuccess: invalidar,
  });

  // Demo: lectura estable del store (memoizada por id) para hidratar la página
  // una sola vez. Las mutaciones de demo actualizan el estado local de la propia
  // pantalla; acá solo damos el valor inicial.
  const reclamoDemo = useMemo(
    () => (!apiEnabled && id ? obtenerReclamo(id) : undefined),
    [id],
  );

  // Build demo: sin API, leemos del store local (lo que la página usaba antes).
  // El contacto lo resuelve el mock en la propia pantalla (contacto = null acá).
  if (!apiEnabled) {
    return {
      reclamo: reclamoDemo,
      cargando: false,
      deApi: false,
      contacto: null,
      asignar: async () => {},
      resolver: async () => {},
      rechazar: async () => {},
      responder: async () => {},
    };
  }

  const reclamo: Reclamo | null | undefined = q.isError ? null : q.isPending ? undefined : (q.data?.reclamo ?? null);

  return {
    reclamo,
    cargando: q.isPending,
    deApi: true,
    contacto: q.data?.contacto ?? null,
    asignar: (profesionalId) => asignarM.mutateAsync(profesionalId),
    resolver: (resolucion) => resolverM.mutateAsync(resolucion),
    rechazar: (motivo) => rechazarM.mutateAsync(motivo),
    responder: (mensaje) => responderM.mutateAsync(mensaje),
  };
}
