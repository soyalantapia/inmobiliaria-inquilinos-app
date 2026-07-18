'use client';

/**
 * Validador de resumen bancario REAL: sube el extracto (CSV/Excel del banco),
 * lo parsea el backend (matching-bancario.ts, sin IA), y concilia créditos
 * contra pagos/liquidaciones reales. Sin fallback demo — reemplaza al dialog
 * simulado (validador-resumen-dialog.tsx) SOLO en prod.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch, API_URL, getToken } from './client';
import { ensureApiSession } from './session';

export type ConfianzaMatch = 'ALTA' | 'MEDIA' | 'BAJA' | 'SIN_MATCH';

export interface MatchSugeridoApi {
  confianza: ConfianzaMatch;
  motivo: string;
  pagoId: string | null;
  contratoId: string | null;
  liquidacionId: string | null;
  inquilino: string | null;
}

export interface CreditoDetectadoApi {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  titularOrigen: string;
  cbuOrigen: string | null;
  nroOperacion: string;
  bancoOrigen: string;
  conciliado: boolean;
  pagoId: string | null;
  sugerido: MatchSugeridoApi;
}

export interface ResumenBancarioDetalle {
  id: string;
  fileName: string;
  fileSize: number;
  archivoUrl: string | null;
  subidoAt: string;
  creditos: CreditoDetectadoApi[];
  opciones: Array<{ liquidacionId: string; contratoId: string; inquilino: string }>;
}

export interface ResumenBancarioResumen {
  id: string;
  fileName: string;
  fileSize: number;
  subidoAt: string;
  totalCreditos: number;
  conciliados: number;
}

export function useResumenesBancarios(): {
  resumenes: ResumenBancarioResumen[];
  cargando: boolean;
  subir: (file: File) => Promise<{ id: string; creditosDetectados: number; filasIgnoradas: number }>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['resumenes-bancarios'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<ResumenBancarioResumen[]>('/resumenes-bancarios');
    },
    enabled: apiEnabled,
    staleTime: 10_000,
  });

  return {
    resumenes: q.data ?? [],
    cargando: q.isPending,
    subir: async (file) => {
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/resumenes-bancarios`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
      await qc.invalidateQueries({ queryKey: ['resumenes-bancarios'] });
      return body;
    },
  };
}

export function useResumenBancarioDetalle(id: string | null): {
  detalle: ResumenBancarioDetalle | null;
  cargando: boolean;
  conciliar: (creditoId: string, liquidacionId: string, pin?: string) => Promise<string | null>;
} {
  const qc = useQueryClient();
  const key = ['resumen-bancario', id];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<ResumenBancarioDetalle>(`/resumenes-bancarios/${id}`);
    },
    enabled: apiEnabled && !!id,
    staleTime: 5_000,
  });

  return {
    detalle: q.data ?? null,
    cargando: q.isPending,
    conciliar: async (creditoId, liquidacionId, pin) => {
      try {
        await apiFetch(`/resumenes-bancarios/${id}/creditos/${creditoId}/conciliar`, {
          method: 'POST',
          body: JSON.stringify({ liquidacionId, pin }),
        });
        await qc.invalidateQueries({ queryKey: key });
        await qc.invalidateQueries({ queryKey: ['resumenes-bancarios'] });
        await qc.invalidateQueries({ queryKey: ['pagos'] });
        await qc.invalidateQueries({ queryKey: ['liquidaciones'] });
        // Conciliar salda deuda del contrato → refrescar lista y detalle de
        // contratos (si no, siguen mostrando la deuda vieja). Patrón use-pagos.
        await qc.invalidateQueries({ queryKey: ['contratos'] });
        await qc.invalidateQueries({ queryKey: ['contrato'] });
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'No se pudo conciliar';
      }
    },
  };
}
