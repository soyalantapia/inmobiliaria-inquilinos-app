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
  /** Preaviso de egreso: cuándo se va (si avisó que NO renueva). */
  fechaEgreso: string | null;
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
  intencionRenovacion: {
    decision: DecisionRenovacionMock;
    comentario: string | null;
    decididoAt: string | null;
    fechaEgreso: string | null;
  } | null;
  diasParaVencimiento: number;
}

function urgenciaDe(dias: number): RenovacionFila['urgencia'] {
  return dias <= 90 ? 'ALTA' : dias <= 180 ? 'MEDIA' : dias <= 365 ? 'BAJA' : 'NINGUNA';
}

/** Fecha local (yyyy-mm-dd) de un timestamp ISO. Recortar con slice(0,10) daría
 *  la fecha UTC y, cerca de medianoche, mostraba el "Avisó" un día corrido. */
function fechaLocalISO(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    fechaIntencion: r.intencionRenovacion?.decididoAt ? fechaLocalISO(r.intencionRenovacion.decididoAt) : null,
    fechaEgreso: r.intencionRenovacion?.fechaEgreso ? fechaLocalISO(r.intencionRenovacion.fechaEgreso) : null,
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
        fechaEgreso: null,
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

/**
 * Registrar la decisión de renovación del inquilino (POST /renovaciones/:id/decision).
 * Antes el panel sólo LEÍA la intención — no había forma de anotar que el inquilino
 * avisó que no renueva / se va. `fechaEgreso` sólo aplica a NO_RENOVAR (preaviso).
 */
export async function registrarDecisionApi(
  contratoId: string,
  input: { decision: DecisionRenovacionMock; notas?: string | null; fechaEgreso?: string | null },
): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/renovaciones/${contratoId}/decision`, {
    method: 'POST',
    body: JSON.stringify({
      decision: input.decision,
      ...(input.notas && input.notas.trim() ? { notas: input.notas.trim() } : {}),
      ...(input.decision === 'NO_RENOVAR' && input.fechaEgreso ? { fechaEgreso: input.fechaEgreso } : {}),
    }),
  });
}
