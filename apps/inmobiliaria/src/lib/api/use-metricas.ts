'use client';

/**
 * Métricas de la inmobiliaria por mes (GET /metricas/resumen). El cálculo vive en el
 * server (a diferencia de useDashboard, que baja las colecciones enteras y suma en el
 * browser): acá pedimos un mes y el server contesta. Solo prod (el endpoint gatea con
 * `metricas.ver`); en demo no hay backend de métricas → null.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';

export interface MetricasResumen {
  mes: string;
  moneda: string;
  hayOtrasMonedas: boolean;
  financiero: {
    devengado: number;
    cobrado: number;
    porCobrar: number;
    enMora: number;
    cobrabilidadPct: number;
  };
  operativo: {
    contratosActivos: number;
    altasMes: number;
    reclamosAbiertos: number;
    reclamosResueltos: number;
  };
  caja: { ingresos: number; egresos: number; neto: number };
  serie: { mes: string; devengado: number; cobrado: number }[];
}

export function useMetricas(mes: string): { resumen: MetricasResumen | null; cargando: boolean } {
  const q = useQuery({
    queryKey: ['metricas-resumen', mes],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<MetricasResumen>(`/metricas/resumen?mes=${encodeURIComponent(mes)}`);
    },
    enabled: apiEnabled && !!mes,
    staleTime: 15_000,
  });
  if (!apiEnabled) return { resumen: null, cargando: false };
  if (q.isError) return { resumen: null, cargando: false };
  return { resumen: q.data ?? null, cargando: q.isPending };
}
