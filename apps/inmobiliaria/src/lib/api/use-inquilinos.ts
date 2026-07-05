'use client';

import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import { contratosMock } from '@/lib/mock-data';

export type EstadoInquilino = 'ACTIVO' | 'INACTIVO' | 'SIN_CONTRATO';

/** Fila de la pestaña Inquilinos (una por titular; hoy = una por contrato). */
export interface InquilinoListado {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  dni: string | null;
  /** Dirección de la propiedad de su contrato (el actual o el que tuvo). */
  propiedad: string | null;
  /** Contrato al que está vinculado (para linkear al detalle). */
  contratoId: string | null;
  /** ACTIVO si su contrato está vigente; INACTIVO si finalizó/rescindió; SIN_CONTRATO si no tiene. */
  estado: EstadoInquilino;
}

interface InquilinoApi {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  dni: string | null;
  contrato: { id: string; estado: string; propiedad: { direccion: string } | null } | null;
}

function mapInquilino(i: InquilinoApi): InquilinoListado {
  const nombre = `${i.nombre} ${i.apellido ?? ''}`.trim();
  const estado: EstadoInquilino = !i.contrato
    ? 'SIN_CONTRATO'
    : i.contrato.estado === 'ACTIVO'
      ? 'ACTIVO'
      : 'INACTIVO';
  return {
    id: i.id,
    nombre: nombre || '—',
    email: i.email,
    telefono: i.telefono,
    dni: i.dni,
    propiedad: i.contrato?.propiedad?.direccion ?? null,
    contratoId: i.contrato?.id ?? null,
    estado,
  };
}

// Demo (!apiEnabled): derivamos la lista de los contratos mock para que la pestaña
// no aparezca vacía en el build demo. En prod sale del backend (GET /inquilinos).
function inquilinosMock(): InquilinoListado[] {
  return contratosMock.map((c) => ({
    id: `inq_${c.id}`,
    nombre: c.inquilino,
    email: null,
    telefono: null,
    dni: null,
    propiedad: c.direccion,
    contratoId: c.id,
    estado: c.estado === 'ACTIVO' ? 'ACTIVO' : 'INACTIVO',
  }));
}

/**
 * Lista de inquilinos del tenant (activos + inactivos/pasados). Hoy devuelve una fila
 * por contrato (el titular es 1:1 con su contrato); la deduplicación por persona llega
 * con la entidad Persona. Mismo patrón que useContratos: NUNCA cae a mock ante error en
 * prod (mostraría una cartera fabricada) → lista vacía + flag error.
 */
export function useInquilinos(): {
  inquilinos: InquilinoListado[];
  cargando: boolean;
  deApi: boolean;
  error: boolean;
} {
  const q = useQuery({
    queryKey: ['inquilinos'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<InquilinoApi[]>('/inquilinos');
      return data.map(mapInquilino);
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  if (!apiEnabled) return { inquilinos: inquilinosMock(), cargando: false, deApi: false, error: false };
  if (q.isError) return { inquilinos: [], cargando: false, deApi: true, error: true };
  return { inquilinos: q.data ?? [], cargando: q.isPending, deApi: true, error: false };
}
