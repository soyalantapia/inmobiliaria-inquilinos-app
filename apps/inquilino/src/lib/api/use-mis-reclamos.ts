'use client';

/**
 * Reclamos del inquilino: API si hay NEXT_PUBLIC_API_URL, localStorage si no
 * (la demo offline sigue intacta). Devuelve el mismo shape `Reclamo` que ya
 * renderizan las pantallas (lista, detalle, nuevo).
 *
 * - LECTURA: GET /mis-reclamos → reclamos + eventos[] + profesional + SLA.
 *   Mapeamos `profesional` a los campos denormalizados `profesionalAsignado*`
 *   que la UI espera, y las fechas ISO se dejan tal cual (la UI las parsea).
 * - CREACIÓN: POST /mis-reclamos { titulo, descripcion, categoria, urgencia }.
 *   Invalida la query para que la lista se refresque.
 *
 * En modo demo (!apiEnabled) caemos al storage local + merge cross-app inmo,
 * exactamente como hacían las páginas antes de cablear el API.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { inquilinoActual } from '@/lib/mock-data';
import {
  crearReclamo as crearReclamoLocal,
  listarReclamos,
} from '@/lib/reclamos-storage';
import { estadoReclamoDeInmo } from '@/lib/cross-app-inmo';
import type {
  Categoria,
  EstadoReclamo,
  EventoReclamo,
  Reclamo,
  TipoEvento,
  Urgencia,
} from '@/lib/types';

const QUERY_KEY = ['mis-reclamos'] as const;

// ===== Shape del API =====

interface EventoApi {
  id: string;
  tipo: string;
  autor: string;
  contenido: string | null;
  fecha: string;
}

interface ProfesionalApi {
  id: string;
  nombre: string;
  telefono: string | null;
  categoria: string;
}

interface ReclamoApi {
  id: string;
  contratoId: string;
  categoria: Categoria;
  descripcion: string;
  urgencia: Urgencia;
  estado: EstadoReclamo;
  asignadoA: string | null;
  fotoUrl: string | null;
  resolucion: string | null;
  createdAt: string;
  resueltoAt: string | null;
  eventos?: EventoApi[];
  profesional?: ProfesionalApi | null;
  // (incluye campos SLA que la UI del inquilino no consume)
}

// Tipos de evento que la UI conoce; el resto del API (CLASIFICADO,
// PROFESIONAL_ASIGNADO) se filtran para no romper la timeline.
const TIPOS_EVENTO_UI: ReadonlySet<TipoEvento> = new Set<TipoEvento>([
  'CREADO',
  'ASIGNADO',
  'EN_CURSO',
  'RESUELTO',
  'CERRADO',
  'RECHAZADO',
  'MENSAJE_INQUILINO',
  'MENSAJE_INMO',
  'VISITA_CONFIRMADA',
  'VISITA_EN_CAMINO',
  'VISITA_LISTO',
]);

function mapEvento(e: EventoApi): EventoReclamo | null {
  if (!TIPOS_EVENTO_UI.has(e.tipo as TipoEvento)) return null;
  return {
    id: e.id,
    tipo: e.tipo as TipoEvento,
    autor: e.autor,
    contenido: e.contenido,
    fecha: e.fecha,
  };
}

function mapReclamo(r: ReclamoApi): Reclamo {
  const prof = r.profesional ?? null;
  return {
    id: r.id,
    contratoId: r.contratoId,
    inquilino: inquilinoActual.nombre,
    direccion: inquilinoActual.direccion,
    categoria: r.categoria,
    descripcion: r.descripcion,
    urgencia: r.urgencia,
    estado: r.estado,
    asignadoA: r.asignadoA,
    fotoUrl: r.fotoUrl,
    resolucion: r.resolucion,
    createdAt: r.createdAt,
    resueltoAt: r.resueltoAt,
    eventos: (r.eventos ?? [])
      .map(mapEvento)
      .filter((e): e is EventoReclamo => e !== null),
    profesionalAsignadoNombre: prof?.nombre ?? null,
    profesionalAsignadoTelefono: prof?.telefono ?? null,
    profesionalAsignadoCategoria: prof?.categoria ?? null,
  };
}

// ===== Fallback demo (localStorage + merge cross-app inmo) =====

function leerReclamosLocales(): Reclamo[] {
  return listarReclamos().map((r) => {
    const inmo = estadoReclamoDeInmo(r.id);
    if (!inmo) return r;
    return {
      ...r,
      estado: inmo.estado ?? r.estado,
      resolucion: inmo.resolucion ?? r.resolucion,
      resueltoAt: inmo.resueltoAt ?? r.resueltoAt,
    };
  });
}

export interface CrearReclamoInput {
  /** Título: en categoría OTRO lo escribe el usuario; si no, el label. */
  titulo: string;
  categoria: Categoria;
  descripcion: string;
  urgencia: Urgencia;
  /** Foto en dataURL — solo se persiste en modo demo (el API aún no la recibe). */
  fotoDataUrl?: string | null;
}

export function useMisReclamos(): {
  reclamos: Reclamo[];
  cargando: boolean;
  deApi: boolean;
  crearReclamo: (input: CrearReclamoInput) => Promise<Reclamo>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<ReclamoApi[]>('/mis-reclamos'),
    enabled: apiEnabled,
    staleTime: 15_000,
  });

  // Combina título + descripción igual que el panel de la inmo lo guarda
  // (el modelo no tiene campo `titulo`): para OTRO el título va como prefijo.
  const descripcionCombinada = (input: CrearReclamoInput): string =>
    input.categoria === 'OTRO' && input.titulo.trim().length > 0
      ? `${input.titulo.trim()} — ${input.descripcion.trim()}`
      : input.descripcion.trim();

  if (!apiEnabled) {
    return {
      reclamos: leerReclamosLocales(),
      cargando: false,
      deApi: false,
      crearReclamo: async (input) =>
        crearReclamoLocal({
          inquilino: inquilinoActual.nombre,
          contratoId: inquilinoActual.contratoId,
          direccion: inquilinoActual.direccion,
          categoria: input.categoria,
          descripcion: descripcionCombinada(input),
          urgencia: input.urgencia,
          fotoDataUrl: input.fotoDataUrl ?? null,
        }),
    };
  }

  if (q.isError) {
    return {
      reclamos: [],
      cargando: false,
      deApi: true,
      crearReclamo: async () => {
        throw new Error('No se pudo conectar con el servidor');
      },
    };
  }

  return {
    reclamos: (q.data ?? []).map(mapReclamo),
    cargando: q.isPending,
    deApi: true,
    crearReclamo: async (input) => {
      const creado = await apiFetch<ReclamoApi>('/mis-reclamos', {
        method: 'POST',
        body: JSON.stringify({
          titulo: input.titulo.trim(),
          descripcion: input.descripcion.trim(),
          categoria: input.categoria,
          urgencia: input.urgencia,
        }),
      });
      await qc.invalidateQueries({ queryKey: QUERY_KEY });
      return mapReclamo(creado);
    },
  };
}
