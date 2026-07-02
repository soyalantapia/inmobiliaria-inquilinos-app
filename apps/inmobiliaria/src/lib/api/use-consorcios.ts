'use client';

/**
 * Consorcios del panel desde el API real (GET /consorcios y GET /consorcios/:id),
 * con fallback al store local solo en build demo (!apiEnabled). Mapea al tipo
 * Consorcio que renderizan las pantallas de consorcios.
 *
 * - GET /consorcios → Consorcio[] con { ...campos, unidades:[...] } (sin
 *   movimientos/asambleas, que solo viajan en el detalle).
 * - GET /consorcios/:id → Consorcio + { movimientos, asambleas }.
 *
 * Montos del API llegan como string → Number(). Fechas ISO → .slice(0,10)
 * donde la UI espera YYYY-MM-DD.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import {
  consorcioPorId,
  listarConsorcios,
  type AsambleaConsorcio,
  type Consorcio,
  type EstadoUF,
  type MovimientoConsorcio,
  type UnidadFuncional,
} from '@/lib/consorcios-storage';

/* ============================================================
 * Tipos del API (montos string, fechas ISO)
 * ============================================================ */

interface UnidadFuncionalApi {
  id: string;
  identificacion: string;
  titular: string;
  coeficiente: number | string;
  telefono: string | null;
  estado: EstadoUF;
  saldoDeudor: number | string | null;
  cargoFijo?: number | string | null;
  serviciosUf?: {
    luz?: { nis: string; medidor?: string | null } | null;
    gas?: { nis: string; medidor?: string | null } | null;
    agua?: { nis: string; medidor?: string | null } | null;
  } | null;
}

interface MovimientoConsorcioApi {
  id: string;
  fecha: string;
  concepto: string;
  monto: number | string;
  categoria: MovimientoConsorcio['categoria'];
}

interface AsambleaConsorcioApi {
  id: string;
  fecha: string;
  tipo: AsambleaConsorcio['tipo'];
  asunto: string;
  asistentes: number | string;
  acuerdoPrincipal: string;
}

interface ConsorcioApi {
  id: string;
  nombre: string;
  direccion: string;
  cantUf: number | string;
  sociedadId?: string | null;
  encargado: { nombre: string; sueldo: number | string } | null;
  periodoActual: string;
  expensasPeriodoActual: number | string;
  unidades: UnidadFuncionalApi[] | null;
  movimientos?: MovimientoConsorcioApi[] | null;
  asambleas?: AsambleaConsorcioApi[] | null;
  desde: string;
}

/* ============================================================
 * Mapeo API → tipo de la UI
 * ============================================================ */

function mapServiciosUf(s: UnidadFuncionalApi['serviciosUf']): UnidadFuncional['serviciosUf'] {
  if (!s) return undefined;
  const out: NonNullable<UnidadFuncional['serviciosUf']> = {};
  if (s.luz) out.luz = { nis: s.luz.nis, medidor: s.luz.medidor ?? undefined };
  if (s.gas) out.gas = { nis: s.gas.nis, medidor: s.gas.medidor ?? undefined };
  if (s.agua) out.agua = { nis: s.agua.nis, medidor: s.agua.medidor ?? undefined };
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapUnidad(u: UnidadFuncionalApi): UnidadFuncional {
  return {
    id: u.id,
    identificacion: u.identificacion,
    titular: u.titular,
    coeficiente: Number(u.coeficiente),
    telefono: u.telefono ?? '',
    estado: u.estado,
    saldoDeudor: u.saldoDeudor != null ? Number(u.saldoDeudor) : 0,
    cargoFijo: u.cargoFijo != null ? Number(u.cargoFijo) : undefined,
    serviciosUf: mapServiciosUf(u.serviciosUf),
  };
}

function mapMovimiento(m: MovimientoConsorcioApi): MovimientoConsorcio {
  return {
    id: m.id,
    fecha: (m.fecha ?? '').slice(0, 10),
    concepto: m.concepto,
    monto: Number(m.monto),
    categoria: m.categoria,
  };
}

function mapAsamblea(a: AsambleaConsorcioApi): AsambleaConsorcio {
  return {
    id: a.id,
    fecha: (a.fecha ?? '').slice(0, 10),
    tipo: a.tipo,
    asunto: a.asunto,
    asistentes: Number(a.asistentes),
    acuerdoPrincipal: a.acuerdoPrincipal,
  };
}

function mapConsorcio(c: ConsorcioApi): Consorcio {
  return {
    id: c.id,
    nombre: c.nombre,
    direccion: c.direccion,
    cantUf: Number(c.cantUf),
    sociedadId: c.sociedadId ?? undefined,
    encargado: c.encargado
      ? { nombre: c.encargado.nombre, sueldo: Number(c.encargado.sueldo) }
      : null,
    periodoActual: c.periodoActual,
    expensasPeriodoActual: Number(c.expensasPeriodoActual),
    unidades: (c.unidades ?? []).map(mapUnidad),
    movimientos: (c.movimientos ?? []).map(mapMovimiento),
    asambleas: (c.asambleas ?? []).map(mapAsamblea),
    desde: (c.desde ?? '').slice(0, 10),
  };
}

/* ============================================================
 * Hooks
 * ============================================================ */

export function useConsorcios(): {
  consorcios: Consorcio[] | null;
  cargando: boolean;
  deApi: boolean;
} {
  const q = useQuery({
    queryKey: ['consorcios'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<ConsorcioApi[]>('/consorcios');
      return data.map(mapConsorcio);
    },
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  if (!apiEnabled) return { consorcios: listarConsorcios(), cargando: false, deApi: false };
  if (q.isError) return { consorcios: [], cargando: false, deApi: true };
  return { consorcios: q.data ?? null, cargando: q.isPending, deApi: true };
}

/* ============================================================
 * Mutaciones (Fase 1 CRUD — prod-only: la demo nunca tuvo alta
 * de consorcios, era un stub, así que no hay fallback local)
 * ============================================================ */

export interface ConsorcioInput {
  nombre: string;
  direccion: string;
  periodoActual?: string;
  expensasPeriodoActual?: number;
  encargado?: { nombre: string; sueldo: number } | null;
}

export interface UnidadInput {
  identificacion: string;
  titular: string;
  coeficiente: number;
  telefono?: string;
  cargoFijo?: number | null;
  saldoDeudor?: number;
  estado?: EstadoUF;
}

export interface MovimientoInput {
  /** YYYY-MM-DD. El SIGNO del monto codifica ingreso (+) / egreso (−). */
  fecha: string;
  concepto: string;
  monto: number;
  categoria: MovimientoConsorcio['categoria'];
}

export interface AsambleaInput {
  fecha: string;
  tipo: AsambleaConsorcio['tipo'];
  asunto: string;
  asistentes: number;
  acuerdoPrincipal: string;
}

export function useConsorcioMutaciones(consorcioId?: string): {
  deApi: boolean;
  crearConsorcio: (input: ConsorcioInput) => Promise<Consorcio>;
  editarConsorcio: (input: Partial<ConsorcioInput>) => Promise<void>;
  crearUnidad: (input: UnidadInput) => Promise<void>;
  editarUnidad: (ufId: string, input: Partial<UnidadInput>) => Promise<void>;
  eliminarUnidad: (ufId: string) => Promise<void>;
  crearMovimiento: (input: MovimientoInput) => Promise<void>;
  eliminarMovimiento: (movId: string) => Promise<void>;
  crearAsamblea: (input: AsambleaInput) => Promise<void>;
  eliminarAsamblea: (asambleaId: string) => Promise<void>;
} {
  const qc = useQueryClient();
  const invalidar = async () => {
    await qc.invalidateQueries({ queryKey: ['consorcios'] });
    if (consorcioId) await qc.invalidateQueries({ queryKey: ['consorcio', consorcioId] });
  };
  const requiereId = (): string => {
    if (!consorcioId) throw new Error('Falta el consorcio');
    return consorcioId;
  };
  const soloProd = async (): Promise<never> => {
    throw new Error('Disponible solo con servidor');
  };

  if (!apiEnabled) {
    return {
      deApi: false,
      crearConsorcio: soloProd,
      editarConsorcio: soloProd,
      crearUnidad: soloProd,
      editarUnidad: soloProd,
      eliminarUnidad: soloProd,
      crearMovimiento: soloProd,
      eliminarMovimiento: soloProd,
      crearAsamblea: soloProd,
      eliminarAsamblea: soloProd,
    };
  }

  return {
    deApi: true,
    crearConsorcio: async (input) => {
      await ensureApiSession();
      const c = await apiFetch<ConsorcioApi>('/consorcios', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await invalidar();
      return mapConsorcio(c);
    },
    editarConsorcio: async (input) => {
      const id = requiereId();
      await ensureApiSession();
      await apiFetch(`/consorcios/${id}`, { method: 'PUT', body: JSON.stringify(input) });
      await invalidar();
    },
    crearUnidad: async (input) => {
      const id = requiereId();
      await ensureApiSession();
      await apiFetch(`/consorcios/${id}/unidades`, { method: 'POST', body: JSON.stringify(input) });
      await invalidar();
    },
    editarUnidad: async (ufId, input) => {
      const id = requiereId();
      await ensureApiSession();
      await apiFetch(`/consorcios/${id}/unidades/${ufId}`, { method: 'PUT', body: JSON.stringify(input) });
      await invalidar();
    },
    eliminarUnidad: async (ufId) => {
      const id = requiereId();
      await ensureApiSession();
      await apiFetch(`/consorcios/${id}/unidades/${ufId}`, { method: 'DELETE' });
      await invalidar();
    },
    crearMovimiento: async (input) => {
      const id = requiereId();
      await ensureApiSession();
      await apiFetch(`/consorcios/${id}/movimientos`, { method: 'POST', body: JSON.stringify(input) });
      await invalidar();
    },
    eliminarMovimiento: async (movId) => {
      const id = requiereId();
      await ensureApiSession();
      await apiFetch(`/consorcios/${id}/movimientos/${movId}`, { method: 'DELETE' });
      await invalidar();
    },
    crearAsamblea: async (input) => {
      const id = requiereId();
      await ensureApiSession();
      await apiFetch(`/consorcios/${id}/asambleas`, { method: 'POST', body: JSON.stringify(input) });
      await invalidar();
    },
    eliminarAsamblea: async (asambleaId) => {
      const id = requiereId();
      await ensureApiSession();
      await apiFetch(`/consorcios/${id}/asambleas/${asambleaId}`, { method: 'DELETE' });
      await invalidar();
    },
  };
}

export function useConsorcio(id: string | undefined): {
  consorcio: Consorcio | null | undefined;
  cargando: boolean;
  deApi: boolean;
} {
  const q = useQuery({
    queryKey: ['consorcio', id],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<ConsorcioApi>(`/consorcios/${id}`);
      return mapConsorcio(data);
    },
    enabled: apiEnabled && !!id,
    staleTime: 30_000,
    retry: false,
  });
  if (!apiEnabled) return { consorcio: id ? consorcioPorId(id) : null, cargando: false, deApi: false };
  if (q.isError) return { consorcio: null, cargando: false, deApi: true };
  // undefined mientras carga (la pantalla muestra skeleton); null = no existe.
  return {
    consorcio: q.isPending ? undefined : (q.data ?? null),
    cargando: q.isPending,
    deApi: true,
  };
}
