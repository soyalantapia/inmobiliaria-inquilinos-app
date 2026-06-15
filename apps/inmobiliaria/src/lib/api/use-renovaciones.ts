'use client';

/**
 * Renovaciones del panel desde el API (GET /renovaciones): contratos activos
 * con su intención de renovación y días al vencimiento. Fallback al mock solo
 * en build demo (!apiEnabled).
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import {
  contactosCobranzaMock,
  contratosMock,
  intencionesRenovacionMock,
  type DecisionRenovacionMock,
} from '@/lib/mock-data';
import { diasHastaVencimiento } from '@/lib/format';
import type { Moneda } from '@/lib/types';

export interface RenovacionFila {
  id: string;
  inquilino: string;
  direccion: string;
  monto: number;
  moneda: Moneda;
  fechaInicio: string;
  fechaFin: string;
  telefono: string | null;
  email: string | null;
  decision: DecisionRenovacionMock;
  comentario: string | null;
  fechaIntencion: string | null;
  dias: number;
  urgencia: 'ALTA' | 'MEDIA' | 'BAJA' | 'NINGUNA';
}

interface RenovacionApi {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  monto: string | number;
  moneda: Moneda;
  tipoContrato: string;
  propiedad: { id: string; direccion: string; ciudad: string } | null;
  inquilinoTitular: {
    id: string;
    nombre: string;
    apellido: string | null;
    email: string | null;
    telefono: string | null;
  } | null;
  intencionRenovacion: { decision: DecisionRenovacionMock; comentario: string | null; decididoAt: string | null } | null;
  diasParaVencimiento: number;
}

function urgenciaDe(dias: number): RenovacionFila['urgencia'] {
  return dias <= 90 ? 'ALTA' : dias <= 180 ? 'MEDIA' : dias <= 365 ? 'BAJA' : 'NINGUNA';
}

function mapRenovacion(r: RenovacionApi): RenovacionFila {
  return {
    id: r.id,
    inquilino: r.inquilinoTitular
      ? `${r.inquilinoTitular.nombre} ${r.inquilinoTitular.apellido ?? ''}`.trim()
      : '—',
    direccion: r.propiedad?.direccion ?? '—',
    monto: Number(r.monto),
    moneda: r.moneda,
    fechaInicio: (r.fechaInicio ?? '').slice(0, 10),
    fechaFin: (r.fechaFin ?? '').slice(0, 10),
    telefono: r.inquilinoTitular?.telefono ?? null,
    email: r.inquilinoTitular?.email ?? null,
    decision: r.intencionRenovacion?.decision ?? 'SIN_RESPUESTA',
    comentario: r.intencionRenovacion?.comentario ?? null,
    fechaIntencion: r.intencionRenovacion?.decididoAt ? r.intencionRenovacion.decididoAt.slice(0, 10) : null,
    dias: r.diasParaVencimiento,
    urgencia: urgenciaDe(r.diasParaVencimiento),
  };
}

function filasMock(): RenovacionFila[] {
  return contratosMock
    .filter((c) => c.estado === 'ACTIVO')
    .map((c) => {
      const intencion = intencionesRenovacionMock.find((i) => i.contratoId === c.id);
      const dias = diasHastaVencimiento(c.fechaFin);
      const tel = contactosCobranzaMock.find((x) => x.contratoId === c.id)?.titular.telefono ?? null;
      return {
        id: c.id,
        inquilino: c.inquilino,
        direccion: c.direccion,
        monto: c.monto,
        moneda: c.moneda,
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        telefono: tel,
        email: null,
        decision: intencion?.decision ?? 'SIN_RESPUESTA',
        comentario: intencion?.comentario ?? null,
        fechaIntencion: intencion?.fechaIntencion ?? null,
        dias,
        urgencia: urgenciaDe(dias),
      };
    })
    .sort((a, b) => a.dias - b.dias);
}

export function useRenovaciones(): { renovaciones: RenovacionFila[]; cargando: boolean; deApi: boolean } {
  const q = useQuery({
    queryKey: ['renovaciones'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<RenovacionApi[]>('/renovaciones');
      return data.map(mapRenovacion).sort((a, b) => a.dias - b.dias);
    },
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  if (!apiEnabled) return { renovaciones: filasMock(), cargando: false, deApi: false };
  if (q.isError) return { renovaciones: [], cargando: false, deApi: true };
  return { renovaciones: q.data ?? [], cargando: q.isPending, deApi: true };
}
