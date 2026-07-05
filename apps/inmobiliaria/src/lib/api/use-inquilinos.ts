'use client';

import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import { contratosMock } from '@/lib/mock-data';
import type { Moneda } from '@/lib/types';

export type EstadoInquilino = 'ACTIVO' | 'INACTIVO';

/** Fila de la pestaña Inquilinos: una PERSONA (deduplicada, agrupa sus N contratos). */
export interface PersonaListado {
  id: string;
  nombre: string;
  apellido: string | null;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  totalContratos: number;
  estado: EstadoInquilino;
  /** Propiedad de referencia (la del contrato vigente o la más reciente). */
  propiedad: string | null;
}

export interface PersonaContrato {
  id: string;
  estado: string;
  monto: number;
  moneda: Moneda;
  fechaInicio: string;
  fechaFin: string;
  propiedad: { id: string; direccion: string } | null;
  deuda: number;
  cuotasVencidas: number;
}

export interface PersonaReclamo {
  id: string;
  contratoId: string;
  categoria: string;
  descripcion: string;
  estado: string;
  urgencia: string;
  createdAt: string;
}

export interface PersonaFicha {
  id: string;
  nombre: string;
  apellido: string | null;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  cuit: string | null;
  contratos: PersonaContrato[];
  reclamos: PersonaReclamo[];
  resumen: {
    totalContratos: number;
    activos: number;
    deudaVigente: number;
    tuvoMora: boolean;
    reclamosAbiertos: number;
  };
}

// Demo (!apiEnabled): derivamos de los contratos mock (cada uno = una persona). En prod
// sale del backend (GET /personas), ya deduplicado por persona.
function personasMock(): PersonaListado[] {
  return contratosMock.map((c) => ({
    id: `per_${c.id}`,
    nombre: c.inquilino,
    apellido: null,
    dni: null,
    email: null,
    telefono: null,
    totalContratos: 1,
    estado: c.estado === 'ACTIVO' ? 'ACTIVO' : 'INACTIVO',
    propiedad: c.direccion,
  }));
}

function personaFichaMock(id: string): PersonaFicha | null {
  const c = contratosMock.find((x) => `per_${x.id}` === id);
  if (!c) return null;
  return {
    id,
    nombre: c.inquilino,
    apellido: null,
    dni: null,
    email: null,
    telefono: null,
    cuit: null,
    contratos: [
      {
        id: c.id,
        estado: c.estado,
        monto: c.monto,
        moneda: c.moneda,
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        propiedad: { id: `prp_${c.id}`, direccion: c.direccion },
        deuda: 0,
        cuotasVencidas: 0,
      },
    ],
    reclamos: [],
    resumen: { totalContratos: 1, activos: c.estado === 'ACTIVO' ? 1 : 0, deudaVigente: 0, tuvoMora: false, reclamosAbiertos: 0 },
  };
}

/**
 * Lista de personas (inquilinos deduplicados) del tenant. Mismo patrón que useContratos:
 * NUNCA cae a mock ante error en prod (mostraría una cartera fabricada) → lista vacía + flag.
 */
export function usePersonas(): {
  personas: PersonaListado[];
  cargando: boolean;
  deApi: boolean;
  error: boolean;
} {
  const q = useQuery({
    queryKey: ['personas'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<PersonaListado[]>('/personas');
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  if (!apiEnabled) return { personas: personasMock(), cargando: false, deApi: false, error: false };
  if (q.isError) return { personas: [], cargando: false, deApi: true, error: true };
  return { personas: q.data ?? [], cargando: q.isPending, deApi: true, error: false };
}

/** Ficha de una persona (contratos, propiedades, reclamos, morosidad). */
export function usePersona(id: string): {
  persona: PersonaFicha | null;
  cargando: boolean;
  error: boolean;
} {
  const q = useQuery({
    queryKey: ['persona', id],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<PersonaFicha>(`/personas/${id}`);
    },
    enabled: apiEnabled && !!id,
    staleTime: 15_000,
  });
  if (!apiEnabled) return { persona: personaFichaMock(id), cargando: false, error: false };
  if (q.isError) return { persona: null, cargando: false, error: true };
  return { persona: q.data ?? null, cargando: q.isPending, error: false };
}
