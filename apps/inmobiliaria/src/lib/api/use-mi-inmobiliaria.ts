'use client';

/**
 * Reglas de negocio de "Mi Inmobiliaria" que no cubren /empresa /mercado /cobranza:
 * rescisión por defecto (editable), resumen de la comisión (vive por-propietario) y
 * estado del plan. La página combina esto con useEmpresa / useCobranza / useMercado.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';

export interface ReglasMiInmobiliaria {
  rescision: { preavisoMeses: number; penalidadMeses: number };
  comision: {
    propietarios: number;
    promedioPct: number | null;
    minPct: number | null;
    maxPct: number | null;
  };
  plan: { esPiloto: boolean; mesesGratisGanados: number };
}

export function useReglasMiInmobiliaria(): {
  reglas: ReglasMiInmobiliaria | null;
  cargando: boolean;
  isError: boolean;
} {
  const q = useQuery({
    queryKey: ['mi-inmobiliaria-reglas'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<ReglasMiInmobiliaria>('/mi-inmobiliaria/reglas');
    },
    enabled: apiEnabled,
    staleTime: 60_000,
  });
  return { reglas: q.data ?? null, cargando: q.isPending, isError: q.isError };
}

/** Guarda la rescisión por defecto (preaviso en meses, penalidad en cánones). Solo ADMIN. */
export async function setRescisionDefault(input: {
  preavisoMeses: number;
  penalidadMeses: number;
}): Promise<{ preavisoMeses: number; penalidadMeses: number }> {
  await ensureApiSession();
  return apiFetch('/mi-inmobiliaria/rescision', { method: 'PUT', body: JSON.stringify(input) });
}
