'use client';

/**
 * Hooks de datos del inquilino: API si hay NEXT_PUBLIC_API_URL, localStorage
 * si no (la demo offline sigue intacta). Mismos shapes que usan las pantallas.
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { contratoMock, liquidacionesMock } from '@/lib/mock-data';
import type { Contrato, Liquidacion, PagoDeLiquidacion } from '@/lib/types';
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

/** Cuenta de cobranza REAL (de la DB) que el inquilino usa para transferir. */
export interface DatosCobranza {
  modo: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO';
  titular: string;
  cuit: string;
  banco: string | null;
  cbu: string;
  alias: string;
}

interface ContratoApi {
  id: string;
  estado?: Contrato['estado'];
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
  // Reglas de la unidad, visibles para el inquilino (evitan consultas).
  mascotasPermitidas?: boolean | null;
  reglasConvivencia?: string | null;
  datosCobranza?: DatosCobranza | null;
}

export function useMiContrato(): {
  contrato: Contrato | null;
  inmobiliariaTelefono: string | null;
  datosCobranza: DatosCobranza | null;
  mascotasPermitidas: boolean | null;
  reglasConvivencia: string | null;
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
  if (!apiEnabled) return { contrato: contratoMock, inmobiliariaTelefono: null, datosCobranza: null, mascotasPermitidas: null, reglasConvivencia: null, cargando: false, isError: false, deApi: false };
  if (q.isError) return { contrato: null, inmobiliariaTelefono: null, datosCobranza: null, mascotasPermitidas: null, reglasConvivencia: null, cargando: false, isError: true, deApi: true };
  const d = q.data;
  if (!d) return { contrato: null, inmobiliariaTelefono: null, datosCobranza: null, mascotasPermitidas: null, reglasConvivencia: null, cargando: q.isPending, isError: false, deApi: true };
  return {
    contrato: {
      id: d.id,
      // Contratos viejos del API podrían no mandar estado → asumimos ACTIVO por
      // compat; el backend hoy siempre lo envía en /mi-contrato.
      estado: d.estado ?? 'ACTIVO',
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
    datosCobranza: d.datosCobranza ?? null,
    mascotasPermitidas: d.mascotasPermitidas ?? null,
    reglasConvivencia: d.reglasConvivencia ?? null,
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
  fechaPago?: string | null;
  estado: Liquidacion['estado'];
  moneda: Liquidacion['moneda'];
  montoPagado?: string | number | null;
  saldo?: string | number | null;
  // Pagos del inquilino sobre la liq. Prisma serializa Decimal como string:
  // `monto` puede venir string o number, el resto llega con el shape final.
  pagos?: Array<Omit<PagoDeLiquidacion, 'monto'> & { monto: string | number }> | null;
}

function mapLiquidacion(l: LiquidacionApi): Liquidacion {
  const montoTotal = Number(l.montoTotal);
  const montoPagado = l.montoPagado != null ? Number(l.montoPagado) : 0;
  return {
    id: l.id,
    contratoId: l.contratoId,
    periodo: l.periodo,
    montoAlquiler: Number(l.montoAlquiler),
    montoExpensas: l.montoExpensas != null ? Number(l.montoExpensas) : null,
    montoPunitorio: Number(l.montoPunitorio ?? 0),
    montoTotal,
    fechaVencimiento: (l.fechaVencimiento ?? '').slice(0, 10),
    fechaPago: l.fechaPago ?? null,
    estado: l.estado,
    moneda: l.moneda,
    // Conciliado + saldo real (prod). El API expone saldo; si no viniera, lo
    // derivamos de montoTotal − pagado como respaldo defensivo.
    montoPagado,
    saldo: l.saldo != null ? Number(l.saldo) : Math.max(0, montoTotal - montoPagado),
    // Historial de pagos del inquilino (INFORMADO/CONCILIADO/RECHAZADO), ya
    // ordenado ASC por informadoAt en el server. Defensivo: [] si un API viejo
    // todavía no manda el campo, para que las pantallas no ramifiquen en null.
    pagos: (l.pagos ?? []).map((p) => ({ ...p, monto: Number(p.monto) })),
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
  // Gate de montaje: en demo los anuncios salen de localStorage (solo cliente).
  // Sin esto `hidratado` era `true` ya en el SSR → en el server no había anuncios
  // (sin localStorage) y el <section> aparecía recién en el cliente = hydration
  // mismatch en el home ("Expected server HTML to contain a matching <section>").
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
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
      // false hasta montar en el cliente → server y primer render del cliente
      // coinciden (ambos sin anuncios) y recién después aparece el <section>.
      hidratado: montado,
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
