'use client';

/**
 * Co-inquilinos del contrato del inquilino logueado: API si hay
 * NEXT_PUBLIC_API_URL, localStorage si no (la demo offline sigue intacta).
 * Mismo shape (CoInquilino) que renderiza la pantalla.
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import {
  type CoInquilino,
  type PermisoCoInquilino,
  aceptarInvitacion as aceptarLocal,
  cambiarPermiso as cambiarPermisoLocal,
  eliminarCoInquilino as eliminarLocal,
  invitarCoInquilino as invitarLocal,
  listarCoInquilinos,
} from '@/lib/co-inquilinos-storage';

// El API devuelve el modelo Prisma tal cual: fechas como ISO datetime
// (DateTime). El tipo CoInquilino ya las tipa como string y `formatFecha`
// (parseLocal) acepta ISO completo, así que no hace falta slice.
interface CoInquilinoApi {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  dni: string | null;
  relacion: string;
  permiso: PermisoCoInquilino;
  estado: CoInquilino['estado'];
  invitadoAt: string;
  aceptadoAt: string | null;
}

function mapCoInquilino(c: CoInquilinoApi): CoInquilino {
  return {
    id: c.id,
    nombre: c.nombre,
    email: c.email,
    telefono: c.telefono ?? null,
    dni: c.dni ?? undefined,
    relacion: c.relacion,
    permiso: c.permiso,
    estado: c.estado,
    invitadoAt: c.invitadoAt,
    aceptadoAt: c.aceptadoAt ?? null,
  };
}

export type InvitarCoInquilinoInput = Omit<
  CoInquilino,
  'id' | 'estado' | 'invitadoAt' | 'aceptadoAt'
>;

export interface UseCoInquilinos {
  coInquilinos: CoInquilino[];
  cargando: boolean;
  /** true = los datos vienen del API real; false = localStorage (demo). */
  deApi: boolean;
  /** Devuelve el token de invitación (para armar el link a compartir), o null en demo. */
  invitar: (input: InvitarCoInquilinoInput) => Promise<string | null>;
  /** Regenera el link de invitación de un co-inquilino existente (null en demo). */
  regenerarLink: (id: string) => Promise<string | null>;
  cambiarPermiso: (id: string, permiso: PermisoCoInquilino) => Promise<void>;
  aceptar: (id: string) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
}

const QUERY_KEY = ['co-inquilinos'];

export function useCoInquilinos(): UseCoInquilinos {
  const qc = useQueryClient();
  // Gate de montaje: en demo la lista sale de localStorage (solo cliente). Sin
  // esto el server renderiza la lista vacía y el cliente la poblada = hydration
  // mismatch (mismo patrón que useMisAnuncios / useBoletas).
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const q = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<CoInquilinoApi[]>('/co-inquilinos'),
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  // ===== Demo offline: store local intacto =====
  if (!apiEnabled) {
    return {
      // Hasta montar: lista vacía + cargando (igual que el server) para no
      // diferir del HTML servido; tras montar leemos localStorage.
      coInquilinos: montado ? listarCoInquilinos() : [],
      cargando: !montado,
      deApi: false,
      invitar: async (input) => {
        invitarLocal(input);
        await invalidar();
        return null;
      },
      regenerarLink: async () => null,
      cambiarPermiso: async (id, permiso) => {
        cambiarPermisoLocal(id, permiso);
        await invalidar();
      },
      aceptar: async (id) => {
        aceptarLocal(id);
        await invalidar();
      },
      eliminar: async (id) => {
        eliminarLocal(id);
        await invalidar();
      },
    };
  }

  // ===== API real: en error → vacío (sin caer al mock) =====
  const coInquilinos = q.isError ? [] : (q.data ?? []).map(mapCoInquilino);

  return {
    coInquilinos,
    cargando: q.isPending,
    deApi: true,
    invitar: async (input) => {
      const r = await apiFetch<{ tokenInvitacion?: string }>('/co-inquilinos', {
        method: 'POST',
        body: JSON.stringify({
          nombre: input.nombre,
          dni: input.dni,
          email: input.email,
          telefono: input.telefono ?? undefined,
          relacion: input.relacion,
          permiso: input.permiso,
        }),
      });
      await invalidar();
      return r?.tokenInvitacion ?? null;
    },
    regenerarLink: async (id) => {
      const r = await apiFetch<{ tokenInvitacion?: string }>(`/co-inquilinos/${id}/link`, {
        method: 'POST',
      });
      return r?.tokenInvitacion ?? null;
    },
    cambiarPermiso: async (id, permiso) => {
      await apiFetch(`/co-inquilinos/${id}/permiso`, {
        method: 'PATCH',
        body: JSON.stringify({ permiso }),
      });
      await invalidar();
    },
    aceptar: async (id) => {
      // Sólo el backend en DEMO_MODE acepta esto; en prod responde 403 y se
      // propaga el error para que la pantalla lo muestre.
      await apiFetch(`/co-inquilinos/${id}/aceptar`, { method: 'POST' });
      await invalidar();
    },
    eliminar: async (id) => {
      await apiFetch(`/co-inquilinos/${id}`, { method: 'DELETE' });
      await invalidar();
    },
  };
}
