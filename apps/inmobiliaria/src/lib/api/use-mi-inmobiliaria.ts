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
  aprobaciones: { contratosRequierenAprobacion: boolean };
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

/** Prende o apaga la aprobación obligatoria de contratos del equipo. Solo ADMIN. */
export async function setContratosRequierenAprobacion(
  valor: boolean,
): Promise<{ contratosRequierenAprobacion: boolean }> {
  await ensureApiSession();
  return apiFetch('/mi-inmobiliaria/aprobaciones', {
    method: 'PUT',
    body: JSON.stringify({ contratosRequierenAprobacion: valor }),
  });
}

// ===== Destinatario por tipo de aviso (T-17-N1) =====

export interface AvisoConfigurable {
  tipo: 'RECLAMO_NUEVO';
  label: string;
  descripcion: string;
  /** null = no tiene casilla propia → va al `fallback`. */
  email: string | null;
}

export interface AvisosMiInmobiliaria {
  /** El email de la inmobiliaria: a donde va todo lo que no tenga casilla propia. */
  fallback: string | null;
  avisos: AvisoConfigurable[];
}

/**
 * A qué casilla va cada tipo de aviso automático.
 *
 * El server devuelve la lista COMPLETA de tipos y el fallback por separado, así el panel no
 * tiene que reimplementar la regla "si no hay configurada, usá la de la inmobiliaria" — si
 * viviera en los dos lados, se despegarían.
 */
export function useAvisosMiInmobiliaria(): {
  datos: AvisosMiInmobiliaria | null;
  cargando: boolean;
  isError: boolean;
} {
  const q = useQuery({
    queryKey: ['mi-inmobiliaria-avisos'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<AvisosMiInmobiliaria>('/mi-inmobiliaria/avisos');
    },
    enabled: apiEnabled,
    staleTime: 60_000,
  });
  return { datos: q.data ?? null, cargando: q.isPending, isError: q.isError };
}

/** Guarda (o borra, con string vacío) la casilla de un tipo de aviso. Solo ADMIN. */
export async function setDestinatarioAviso(input: {
  tipo: 'RECLAMO_NUEVO';
  email: string;
}): Promise<{ tipo: string; email: string | null }> {
  await ensureApiSession();
  return apiFetch('/mi-inmobiliaria/avisos', { method: 'PUT', body: JSON.stringify(input) });
}
