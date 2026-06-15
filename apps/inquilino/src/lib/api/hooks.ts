'use client';

/**
 * Hooks de datos del inquilino: API si hay NEXT_PUBLIC_API_URL, localStorage
 * si no (la demo offline sigue intacta). Mismos shapes que usan las pantallas.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { contratoMock, liquidacionesMock } from '@/lib/mock-data';
import type { Contrato, Liquidacion } from '@/lib/types';
import {
  listarAnunciosParaInquilino,
  type AnuncioInquilino,
} from '@/lib/anuncios-cross-app';
import {
  leerAcuses,
  marcarEnterado as marcarEnteradoLocal,
  marcarLeido as marcarLeidoLocal,
  type Acuse,
} from '@/lib/anuncios-acuses';

interface MiAnuncioApi extends Omit<AnuncioInquilino, 'enviadoAt'> {
  enviadoAt: string;
  acuse: { leidoAt: string | null; confirmadoAt: string | null } | null;
}

// ===== Mi contrato =====

interface ContratoApi {
  id: string;
  direccion: string;
  ciudad: string;
  inmobiliaria: string;
  inmobiliariaTelefono: string | null;
  fechaInicio: string;
  fechaFin: string;
  diaPago: number;
  indiceAjuste: Contrato['indiceAjuste'];
  proximoAjuste: string | null;
  montoActual: number;
  montoExpensas: number | null;
  moneda: Contrato['moneda'];
}

export function useMiContrato(): {
  contrato: Contrato | null;
  inmobiliariaTelefono: string | null;
  cargando: boolean;
  isError: boolean;
  deApi: boolean;
} {
  const q = useQuery({
    queryKey: ['mi-contrato'],
    queryFn: () => apiFetch<ContratoApi>('/mi-contrato'),
    enabled: apiEnabled,
    staleTime: 60_000,
  });
  if (!apiEnabled) return { contrato: contratoMock, inmobiliariaTelefono: null, cargando: false, isError: false, deApi: false };
  if (q.isError) return { contrato: null, inmobiliariaTelefono: null, cargando: false, isError: true, deApi: true };
  const d = q.data;
  if (!d) return { contrato: null, inmobiliariaTelefono: null, cargando: q.isPending, isError: false, deApi: true };
  return {
    contrato: {
      id: d.id,
      direccion: d.direccion,
      ciudad: d.ciudad,
      inmobiliaria: d.inmobiliaria,
      fechaInicio: d.fechaInicio,
      fechaFin: d.fechaFin,
      diaPago: d.diaPago,
      indiceAjuste: d.indiceAjuste,
      proximoAjuste: d.proximoAjuste ?? '',
      montoActual: d.montoActual,
      moneda: d.moneda,
    },
    inmobiliariaTelefono: d.inmobiliariaTelefono,
    cargando: false,
    isError: false,
    deApi: true,
  };
}

// ===== Mis liquidaciones =====

interface LiquidacionApi {
  id: string;
  contratoId: string;
  periodo: string;
  montoAlquiler: string | number;
  montoExpensas: string | number | null;
  montoPunitorio: string | number | null;
  montoTotal: string | number;
  fechaVencimiento: string;
  estado: Liquidacion['estado'];
  moneda: Liquidacion['moneda'];
}

function mapLiquidacion(l: LiquidacionApi): Liquidacion {
  return {
    id: l.id,
    contratoId: l.contratoId,
    periodo: l.periodo,
    montoAlquiler: Number(l.montoAlquiler),
    montoExpensas: l.montoExpensas != null ? Number(l.montoExpensas) : null,
    montoPunitorio: Number(l.montoPunitorio ?? 0),
    montoTotal: Number(l.montoTotal),
    fechaVencimiento: (l.fechaVencimiento ?? '').slice(0, 10),
    estado: l.estado,
    moneda: l.moneda,
  };
}

export function useMisLiquidaciones(): {
  liquidaciones: Liquidacion[];
  cargando: boolean;
  isError: boolean;
  deApi: boolean;
} {
  const q = useQuery({
    queryKey: ['mis-liquidaciones'],
    queryFn: () => apiFetch<LiquidacionApi[]>('/mis-liquidaciones'),
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  if (!apiEnabled) return { liquidaciones: liquidacionesMock, cargando: false, isError: false, deApi: false };
  if (q.isError) return { liquidaciones: [], cargando: false, isError: true, deApi: true };
  return { liquidaciones: (q.data ?? []).map(mapLiquidacion), cargando: q.isPending, isError: false, deApi: true };
}

export function useMisAnuncios(): {
  anuncios: AnuncioInquilino[];
  acuses: Record<string, Acuse>;
  marcarLeido: (id: string) => Promise<void>;
  marcarEnterado: (id: string) => Promise<void>;
  hidratado: boolean;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['mis-anuncios'],
    queryFn: () => apiFetch<MiAnuncioApi[]>('/mis-anuncios'),
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['mis-anuncios'] });

  // Demo offline: seeds/localStorage cross-app + acuses locales. Intacto.
  if (!apiEnabled) {
    return {
      anuncios: listarAnunciosParaInquilino(),
      acuses: leerAcuses(),
      marcarLeido: async (id) => {
        marcarLeidoLocal(id);
      },
      marcarEnterado: async (id) => {
        marcarEnteradoLocal(id);
      },
      hidratado: true,
    };
  }

  // Prod: si el API falla NUNCA caemos a los SEEDS_FALLBACK locales (tienen
  // un CBU/alias hardcodeados → riesgo de phishing si el inquilino transfiere
  // a una cuenta inventada). Mostramos lista vacía y los acuses no aplican.
  if (q.isError) {
    return {
      anuncios: [],
      acuses: {},
      marcarLeido: async () => {},
      marcarEnterado: async () => {},
      hidratado: true,
    };
  }

  const anuncios = (q.data ?? []) as unknown as AnuncioInquilino[];
  const acuses: Record<string, Acuse> = {};
  for (const a of q.data ?? []) {
    if (a.acuse) {
      acuses[a.id] = {
        leidoAt: a.acuse.leidoAt ?? undefined,
        confirmadoAt: a.acuse.confirmadoAt ?? undefined,
      };
    }
  }
  return {
    anuncios,
    acuses,
    marcarLeido: async (id) => {
      await apiFetch(`/anuncios/${id}/leido`, { method: 'POST' });
      invalidar();
    },
    marcarEnterado: async (id) => {
      await apiFetch(`/anuncios/${id}/enterado`, { method: 'POST' });
      invalidar();
    },
    hidratado: !q.isPending,
  };
}
