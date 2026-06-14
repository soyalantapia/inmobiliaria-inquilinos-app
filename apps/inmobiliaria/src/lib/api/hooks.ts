'use client';

/**
 * Hooks de datos del panel: API si hay NEXT_PUBLIC_API_URL, mocks si no.
 * Los adaptadores devuelven los MISMOS tipos que usan las pantallas
 * (ContratoListado, etc.) para que la migración sea transparente.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import { mockUser } from '@/lib/auth';
import { contratosMock, propiedadesMock, propietariosMock } from '@/lib/mock-data';
import type {
  ContratoListado,
  EstadoPropiedad,
  Propiedad,
  Propietario,
  TipoPropiedad,
} from '@/lib/types';
import { enriquecerPropiedad, type PropiedadEnriquecida } from '@/lib/propiedades-helpers';
import type { DashboardStats } from '@/lib/dashboard-helpers';
import {
  cargarMovimiento as cargarMovimientoLocal,
  eliminarMovimiento as eliminarMovimientoLocal,
  listarMovimientosCaja,
  type MovimientoCaja,
} from '@/lib/caja-storage';

interface ContratoApi {
  id: string;
  estado: ContratoListado['estado'];
  monto: string | number;
  moneda: ContratoListado['moneda'];
  fechaInicio: string;
  fechaFin: string;
  proximoAjuste: string | null;
  tipoContrato: ContratoListado['tipoContrato'];
  montoExpensas: string | number | null;
  cbuAlias: string | null;
  titularCuenta: string | null;
  pendienteAprobacion: boolean;
  cargadoPor: string | null;
  cargadoRol: string | null;
  cargadoAt: string | null;
  aprobadoPor: string | null;
  propiedad: { id: string; direccion: string; ciudad: string; consorcio?: { nombre: string } | null };
  inquilinoTitular: { id: string; nombre: string; apellido: string | null } | null;
  /** Derivados por el server desde liquidaciones reales (Fase 3). */
  estadoPagoActual: ContratoListado['estadoPagoActual'];
  proximoVencimiento: string | null;
}

function mapContrato(c: ContratoApi): ContratoListado {
  return {
    id: c.id,
    inquilino: c.inquilinoTitular
      ? `${c.inquilinoTitular.nombre} ${c.inquilinoTitular.apellido ?? ''}`.trim()
      : (c.propiedad.consorcio?.nombre ?? '—'),
    direccion: c.propiedad.direccion,
    monto: Number(c.monto),
    moneda: c.moneda,
    estado: c.estado,
    fechaInicio: c.fechaInicio.slice(0, 10),
    fechaFin: c.fechaFin.slice(0, 10),
    proximoVencimiento: (c.proximoVencimiento ?? c.fechaFin).slice(0, 10),
    estadoPagoActual: c.estadoPagoActual ?? 'PENDIENTE',
    cbuAlias: c.cbuAlias,
    titularCuenta: c.titularCuenta,
    ...(c.tipoContrato ? { tipoContrato: c.tipoContrato } : {}),
    ...(c.montoExpensas != null ? { montoExpensas: Number(c.montoExpensas) } : {}),
    ...(c.pendienteAprobacion ? { pendienteAprobacion: true } : {}),
    ...(c.cargadoPor ? { cargadoPor: c.cargadoPor } : {}),
    ...(c.aprobadoPor ? { aprobadoPor: c.aprobadoPor } : {}),
  } as ContratoListado;
}

// ===== Anuncios (acuses REALES del server) =====

import {
  contarAcuses,
  contarDestinatarios,
  crearAnuncio as crearAnuncioLocal,
  eliminarAnuncio as eliminarAnuncioLocal,
  listarAnuncios,
  type Anuncio,
} from '@/lib/anuncios-storage';

export type AnuncioConConteos = Anuncio & {
  conteos?: { leido: number; confirmado: number; total: number };
};

interface AnuncioApi extends Omit<Anuncio, 'enviadoAt'> {
  enviadoAt: string;
  conteos: { leido: number; confirmado: number; total: number };
}

export interface NuevoAnuncio {
  titulo: string;
  cuerpo: string;
  prioridad: Anuncio['prioridad'];
  audiencia: Anuncio['audiencia'];
  audienciaIds?: string[];
}

export function useAnuncios(): {
  anuncios: AnuncioConConteos[];
  cargando: boolean;
  crear: (a: NuevoAnuncio) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['anuncios'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<AnuncioApi[]>('/anuncios');
      return data as AnuncioConConteos[];
    },
    enabled: apiEnabled,
    staleTime: 10_000,
    refetchInterval: 30_000, // los acuses de los inquilinos van llegando
  });
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['anuncios'] });

  if (!apiEnabled || q.isError) {
    return {
      anuncios: listarAnuncios().map((a) => ({ ...a, conteos: { ...contarAcuses(a), total: a.destinatariosCount } })),
      cargando: false,
      crear: async (input) => {
        crearAnuncioLocal({
          ...input,
          audienciaIds: input.audienciaIds ?? [],
          canales: ['APP', 'EMAIL'],
          enviadoPor: 'Roberto Tapia',
          destinatariosCount: contarDestinatarios(input.audiencia, input.audienciaIds ?? []),
        });
      },
      eliminar: async (id) => {
        eliminarAnuncioLocal(id);
      },
    };
  }

  return {
    anuncios: q.data ?? [],
    cargando: q.isPending,
    crear: async (input) => {
      await apiFetch('/anuncios', { method: 'POST', body: JSON.stringify(input) });
      invalidar();
    },
    eliminar: async (id) => {
      await apiFetch(`/anuncios/${id}`, { method: 'DELETE' });
      invalidar();
    },
  };
}

// ===== Aprobaciones =====

import {
  aprobar as aprobarLocal,
  listarAprobaciones,
  rechazar as rechazarLocal,
  type Aprobacion,
} from '@/lib/aprobaciones-storage';

interface AprobacionApi extends Omit<Aprobacion, 'cargadoPor' | 'monto' | 'aprobadoPor'> {
  monto: string | number | null;
  cargadoPor: { nombre: string; apellido: string; rol: string };
  aprobadoPorId: string | null;
}

function mapAprobacion(a: AprobacionApi): Aprobacion {
  return {
    ...a,
    monto: a.monto != null ? Number(a.monto) : undefined,
    cargadoPor: `${a.cargadoPor.nombre} ${a.cargadoPor.apellido}`.trim(),
    aprobadoPor: a.aprobadoPorId ?? undefined,
  } as Aprobacion;
}

export function useAprobaciones(): {
  aprobaciones: Aprobacion[];
  cargando: boolean;
  aprobarApi: (id: string, pin: string, comentario?: string) => Promise<Aprobacion>;
  rechazarApi: (id: string, pin: string, motivo: string) => Promise<Aprobacion>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['aprobaciones'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<AprobacionApi[]>('/aprobaciones');
      return data.map(mapAprobacion);
    },
    enabled: apiEnabled,
    staleTime: 10_000,
  });
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['aprobaciones'] });

  if (!apiEnabled || q.isError) {
    return {
      aprobaciones: listarAprobaciones(),
      cargando: false,
      aprobarApi: async (id, _pin, comentario) => {
        const r = aprobarLocal(id, 'Roberto Tapia', comentario);
        if (!r) throw new Error('No se pudo aprobar');
        return r;
      },
      rechazarApi: async (id, _pin, motivo) => {
        const r = rechazarLocal(id, 'Roberto Tapia', motivo);
        if (!r) throw new Error('No se pudo rechazar');
        return r;
      },
    };
  }

  return {
    aprobaciones: q.data ?? [],
    cargando: q.isPending,
    aprobarApi: async (id, pin, comentario) => {
      const r = await apiFetch<AprobacionApi>(`/aprobaciones/${id}/aprobar`, {
        method: 'POST',
        body: JSON.stringify({ pin, comentario }),
      });
      invalidar();
      void qc.invalidateQueries({ queryKey: ['contratos'] }); // aprobar contrato lo activa
      return mapAprobacion(r);
    },
    rechazarApi: async (id, pin, motivo) => {
      const r = await apiFetch<AprobacionApi>(`/aprobaciones/${id}/rechazar`, {
        method: 'POST',
        body: JSON.stringify({ pin, comentario: motivo }),
      });
      invalidar();
      return mapAprobacion(r);
    },
  };
}

// ===== Caja de gastos =====

interface MovimientoCajaApi {
  id: string;
  propiedadId: string;
  contratoId: string | null;
  tipo: MovimientoCaja['tipo'];
  categoria: MovimientoCaja['categoria'];
  descripcion: string;
  monto: string | number;
  fecha: string;
  proveedor: string | null;
  comprobanteUrl: string | null;
  cargadoPor: string;
  createdAt: string;
  descontadoEnRendicion: boolean;
}

function mapMovimiento(m: MovimientoCajaApi): MovimientoCaja {
  return {
    id: m.id,
    propiedadId: m.propiedadId,
    contratoId: m.contratoId,
    tipo: m.tipo,
    categoria: m.categoria,
    descripcion: m.descripcion,
    monto: Number(m.monto),
    fecha: m.fecha.slice(0, 10),
    proveedor: m.proveedor,
    comprobante: m.comprobanteUrl,
    cargadoPor: m.cargadoPor,
    createdAt: m.createdAt,
    descontadoEnRendicion: m.descontadoEnRendicion,
  };
}

export interface NuevoGasto {
  propiedadId: string;
  categoria: MovimientoCaja['categoria'];
  descripcion: string;
  monto: number;
  fecha: string;
  proveedor?: string | null;
}

export function useCaja(): {
  movimientos: MovimientoCaja[];
  cargando: boolean;
  crearGasto: (g: NuevoGasto) => Promise<void>;
  eliminarGasto: (id: string, pin: string) => Promise<void>;
  refrescar: () => void;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['caja'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<MovimientoCajaApi[]>('/caja/movimientos');
      return data.map(mapMovimiento);
    },
    enabled: apiEnabled,
    staleTime: 10_000,
  });
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['caja'] });

  if (!apiEnabled || q.isError) {
    // Modo local (o API caída): mismo contrato de funciones sobre localStorage
    return {
      movimientos: listarMovimientosCaja(),
      cargando: false,
      crearGasto: async (g) => {
        cargarMovimientoLocal({
          propiedadId: g.propiedadId,
          contratoId: null,
          tipo: 'GASTO',
          categoria: g.categoria,
          descripcion: g.descripcion,
          monto: g.monto,
          fecha: g.fecha,
          proveedor: g.proveedor ?? null,
          comprobante: null,
          cargadoPor: 'Roberto Tapia',
        });
      },
      eliminarGasto: async (id) => {
        eliminarMovimientoLocal(id);
      },
      refrescar: invalidar,
    };
  }

  return {
    movimientos: q.data ?? [],
    cargando: q.isPending,
    crearGasto: async (g) => {
      await apiFetch('/caja/movimientos', { method: 'POST', body: JSON.stringify(g) });
      invalidar();
    },
    eliminarGasto: async (id, pin) => {
      await apiFetch(`/caja/movimientos/${id}`, { method: 'DELETE', body: JSON.stringify({ pin }) });
      invalidar();
    },
    refrescar: invalidar,
  };
}

// ===== Usuario logueado (/auth/me) =====

interface MeApi {
  kind: string;
  nombre: string;
  email: string;
  rol: string;
}

export interface Me {
  nombre: string;
  email: string;
  rol: string;
  firstName: string;
  iniciales: string;
}

function iniciales(nombre: string, email: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  const ini = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  return ini || (email[0]?.toUpperCase() ?? '?');
}

export function useMe(): { me: Me | null; cargando: boolean } {
  const q = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<MeApi>('/auth/me');
    },
    enabled: apiEnabled,
    staleTime: 60_000,
  });

  if (!apiEnabled) {
    const u = mockUser.user;
    return {
      me: {
        nombre: u.fullName,
        email: u.primaryEmailAddress.emailAddress,
        rol: 'ADMIN',
        firstName: u.firstName,
        iniciales: `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase(),
      },
      cargando: false,
    };
  }
  const d = q.data;
  if (!d) return { me: null, cargando: q.isPending };
  const firstName = d.nombre.trim().split(/\s+/)[0] ?? d.nombre;
  return {
    me: { nombre: d.nombre, email: d.email, rol: d.rol, firstName, iniciales: iniciales(d.nombre, d.email) },
    cargando: false,
  };
}

export function useContratos(): { contratos: ContratoListado[]; cargando: boolean; deApi: boolean } {
  const q = useQuery({
    queryKey: ['contratos'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<ContratoApi[]>('/contratos');
      return data.map(mapContrato);
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  if (!apiEnabled) return { contratos: contratosMock, cargando: false, deApi: false };
  // Si el API falla (caído), caemos a los mocks para no dejar la pantalla vacía.
  if (q.isError) return { contratos: contratosMock, cargando: false, deApi: false };
  return { contratos: q.data ?? [], cargando: q.isPending, deApi: true };
}

// ===== Propiedades (enriquecidas con contrato + propietarios) =====

interface PropiedadApi {
  id: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  tipo: string;
  ambientes: number | null;
  m2: number | null;
  fotoUrl: string | null;
  estado: string;
  contratoActualId: string | null;
  sociedadId: string | null;
  participaciones: Array<{
    propietarioId: string;
    porcentaje: number;
    propietario: { id: string; nombre: string; apellido: string };
  }>;
  contratoActual: { id: string; estado: string; monto: string | number; moneda: string } | null;
}

interface ReclamoLiteApi {
  contratoId: string | null;
  estado: string;
}

// El enum de Prisma tiene más tipos (PH, OFICINA, COCHERA, TERRENO) que los
// 4 que renderiza el panel (íconos/labels). Coercionamos para no romper los
// lookups por record con una propiedad de tipo no contemplado.
function coerceTipo(t: string): TipoPropiedad {
  switch (t) {
    case 'DEPARTAMENTO':
    case 'CASA':
    case 'LOCAL':
    case 'GALPON':
      return t;
    case 'PH':
      return 'DEPARTAMENTO';
    case 'OFICINA':
    case 'COCHERA':
      return 'LOCAL';
    case 'TERRENO':
      return 'GALPON';
    default:
      return 'DEPARTAMENTO';
  }
}

function mapPropiedad(p: PropiedadApi): Propiedad {
  return {
    id: p.id,
    direccion: p.direccion,
    ciudad: p.ciudad,
    provincia: p.provincia,
    tipo: coerceTipo(p.tipo),
    ambientes: p.ambientes,
    m2: p.m2,
    fotoUrl: p.fotoUrl,
    estado: p.estado as EstadoPropiedad,
    propietariosIds: p.participaciones.map((x) => x.propietarioId),
    participaciones: p.participaciones.map((x) => ({
      propietarioId: x.propietarioId,
      porcentaje: x.porcentaje,
    })),
    contratoActualId: p.contratoActualId,
    ...(p.sociedadId ? { sociedadId: p.sociedadId } : {}),
    createdAt: '',
  };
}

// Propietario "liviano" para el listado/cards (solo nombre/apellido vienen
// embebidos en /propiedades). El detalle completo lo trae usePropietarios.
function propietarioLite(o: { id: string; nombre: string; apellido: string }, propId: string): Propietario {
  return {
    id: o.id,
    nombre: o.nombre,
    apellido: o.apellido,
    cuit: '',
    email: '',
    telefono: '',
    cbuAlias: null,
    comisionPct: 0,
    notas: null,
    createdAt: '',
    propiedadesIds: [propId],
    totalCobradoMes: 0,
    totalRecibirMes: 0,
  };
}

export function usePropiedades(): {
  propiedades: PropiedadEnriquecida[];
  cargando: boolean;
  deApi: boolean;
} {
  const { contratos } = useContratos();
  const propsQ = useQuery({
    queryKey: ['propiedades'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<PropiedadApi[]>('/propiedades');
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  const reclamosQ = useQuery({
    queryKey: ['reclamos', 'lite'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<ReclamoLiteApi[]>('/reclamos');
    },
    enabled: apiEnabled,
    staleTime: 30_000,
  });

  if (!apiEnabled) {
    return { propiedades: propiedadesMock.map(enriquecerPropiedad), cargando: false, deApi: false };
  }
  // API caída: empty + flag, NO mocks (no inventamos data en producción).
  if (propsQ.isError) return { propiedades: [], cargando: false, deApi: true };

  const reclamos = reclamosQ.data ?? [];
  const propiedades: PropiedadEnriquecida[] = (propsQ.data ?? []).map((p) => {
    const contrato = p.contratoActualId
      ? (contratos.find((c) => c.id === p.contratoActualId) ?? null)
      : null;
    const propietarios = p.participaciones.map((pp) => propietarioLite(pp.propietario, p.id));
    const reclamosAbiertos = reclamos.filter(
      (r) => r.contratoId === p.contratoActualId && (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO'),
    ).length;
    return {
      propiedad: mapPropiedad(p),
      contrato,
      propietarios,
      reclamos: [],
      reclamosAbiertos,
    };
  });

  return { propiedades, cargando: propsQ.isPending, deApi: true };
}

// ===== Liquidaciones (recibos mensuales por contrato) =====

interface LiquidacionApi {
  id: string;
  contratoId: string;
  periodo: string;
  montoAlquiler: string | number;
  montoExpensas: string | number | null;
  montoPunitorio: string | number | null;
  montoTotal: string | number;
  fechaVencimiento: string;
  fechaPago: string | null;
  estado: string;
  moneda: string;
  contrato: {
    id: string;
    propiedad: { direccion: string } | null;
    inquilinoTitular: { nombre: string; apellido: string | null } | null;
  } | null;
}

export interface LiquidacionItem {
  id: string;
  contratoId: string;
  periodo: string;
  montoAlquiler: number;
  montoExpensas: number | null;
  montoTotal: number;
  estado: string;
  fechaVencimiento: string;
  fechaPago: string | null;
  direccion: string;
  inquilino: string;
}

function mapLiquidacion(l: LiquidacionApi): LiquidacionItem {
  return {
    id: l.id,
    contratoId: l.contratoId,
    periodo: l.periodo,
    montoAlquiler: Number(l.montoAlquiler),
    montoExpensas: l.montoExpensas != null ? Number(l.montoExpensas) : null,
    montoTotal: Number(l.montoTotal),
    estado: l.estado,
    fechaVencimiento: (l.fechaVencimiento ?? '').slice(0, 10),
    fechaPago: l.fechaPago ? l.fechaPago.slice(0, 10) : null,
    direccion: l.contrato?.propiedad?.direccion ?? '—',
    inquilino: l.contrato?.inquilinoTitular
      ? `${l.contrato.inquilinoTitular.nombre} ${l.contrato.inquilinoTitular.apellido ?? ''}`.trim()
      : '—',
  };
}

export function useLiquidaciones(): {
  liquidaciones: LiquidacionItem[];
  cargando: boolean;
  deApi: boolean;
} {
  const q = useQuery({
    queryKey: ['liquidaciones'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<LiquidacionApi[]>('/liquidaciones');
      return data.map(mapLiquidacion);
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  if (!apiEnabled) return { liquidaciones: [], cargando: false, deApi: false };
  if (q.isError) return { liquidaciones: [], cargando: false, deApi: true };
  return { liquidaciones: q.data ?? [], cargando: q.isPending, deApi: true };
}

// Período "YYYY-MM" del mes actual (hora local del cliente).
function periodoActualYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ===== Propietarios (con métricas reales derivadas de liquidaciones) =====

interface PropietarioApi {
  id: string;
  nombre: string;
  apellido: string;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  cbuAlias: string | null;
  comisionPct: number | null;
  notas: string | null;
  createdAt: string;
  participaciones: Array<{ propiedadId: string; porcentaje: number }>;
}

export function usePropietarios(): {
  propietarios: Propietario[];
  cargando: boolean;
  deApi: boolean;
} {
  const ownersQ = useQuery({
    queryKey: ['propietarios'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<PropietarioApi[]>('/propietarios');
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  const propsQ = useQuery({
    queryKey: ['propiedades'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<PropiedadApi[]>('/propiedades');
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  const { liquidaciones } = useLiquidaciones();

  if (!apiEnabled) return { propietarios: propietariosMock, cargando: false, deApi: false };
  if (ownersQ.isError) return { propietarios: [], cargando: false, deApi: true };

  // Atribuimos lo COBRADO este mes (liquidaciones PAGADAS del período) a cada
  // propietario según su participación en la propiedad del contrato. Lo "a
  // rendir" descuenta la comisión. Si nada se cobró todavía, queda en 0 — que
  // es el estado real de un alta nueva (sin pagos conciliados aún).
  const period = periodoActualYM();
  const props = propsQ.data ?? [];
  const cobradoByOwner: Record<string, number> = {};
  for (const l of liquidaciones) {
    if (l.periodo !== period || l.estado !== 'PAGADO') continue;
    const prop = props.find((p) => p.contratoActualId === l.contratoId);
    if (!prop) continue;
    for (const part of prop.participaciones) {
      cobradoByOwner[part.propietarioId] =
        (cobradoByOwner[part.propietarioId] ?? 0) + l.montoTotal * (part.porcentaje / 100);
    }
  }

  const propietarios: Propietario[] = (ownersQ.data ?? []).map((o) => {
    const cobrado = Math.round(cobradoByOwner[o.id] ?? 0);
    const recibir = Math.round(cobrado * (1 - (o.comisionPct ?? 0) / 100));
    return {
      id: o.id,
      nombre: o.nombre,
      apellido: o.apellido,
      cuit: o.cuit ?? '',
      email: o.email ?? '',
      telefono: o.telefono ?? '',
      cbuAlias: o.cbuAlias,
      comisionPct: o.comisionPct ?? 0,
      notas: o.notas,
      createdAt: (o.createdAt ?? '').slice(0, 10),
      propiedadesIds: (o.participaciones ?? []).map((x) => x.propiedadId),
      totalCobradoMes: cobrado,
      totalRecibirMes: recibir,
    };
  });

  return { propietarios, cargando: ownersQ.isPending, deApi: true };
}

// ===== Dashboard (agregados reales para el home) =====

export interface DashboardData {
  stats: DashboardStats;
  morosos: { contratoId: string; inquilino: string; direccion: string; monto: number; moneda: ContratoListado['moneda'] }[];
  propietariosSinCbu: number;
  porRendir: number;
  proximosVencimientos: { id: string; direccion: string; inquilino: string; fecha: string; monto: number }[];
  cargando: boolean;
}

const COMISION_DASHBOARD = 0.08;

export function useDashboard(): DashboardData {
  const { contratos, cargando: cargC } = useContratos();
  const { propiedades, cargando: cargP } = usePropiedades();
  const { propietarios } = usePropietarios();
  const { liquidaciones } = useLiquidaciones();

  const activos = contratos.filter((c) => c.estado === 'ACTIVO');
  const cobrado = activos.filter((c) => c.estadoPagoActual === 'PAGADO').reduce((a, c) => a + c.monto, 0);
  const porCobrar = activos.filter((c) => c.estadoPagoActual === 'PENDIENTE').reduce((a, c) => a + c.monto, 0);
  const moraContratos = activos.filter((c) => c.estadoPagoActual === 'VENCIDO');
  const enMora = { monto: moraContratos.reduce((a, c) => a + c.monto, 0), cantidad: moraContratos.length };
  const totalActivos = cobrado + porCobrar + enMora.monto;
  const comisionMes = Math.round(cobrado * COMISION_DASHBOARD);
  const aRendirMes = Math.round(cobrado - comisionMes);

  const totalProps = propiedades.length;
  const alquiladas = propiedades.filter((p) => p.propiedad.estado === 'ALQUILADA').length;
  const ocupacionPct = totalProps > 0 ? Math.round((alquiladas / totalProps) * 100) : 0;
  const reclamosAbiertos = propiedades.reduce((a, p) => a + p.reclamosAbiertos, 0);
  const cobrabilidadPct = totalActivos > 0 ? Math.round((cobrado / totalActivos) * 100) : 0;

  const stats: DashboardStats = {
    cobradoMes: cobrado,
    porCobrarMes: porCobrar,
    enMora,
    comisionMes,
    aRendirMes,
    contratosActivos: activos.length,
    ocupacionPct,
    reclamosAbiertos,
    cobrabilidadPct,
  };

  const morosos = moraContratos.map((c) => ({
    contratoId: c.id,
    inquilino: c.inquilino,
    direccion: c.direccion,
    monto: c.monto,
    moneda: c.moneda,
  }));

  const propietariosSinCbu = propietarios.filter((p) => !p.cbuAlias).length;
  const porRendir = propietarios.filter((p) => p.totalRecibirMes > 0).length;

  // Próximos vencimientos: liquidaciones no pagadas que vencen dentro de 14 días.
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en14 = hoy.getTime() + 14 * 24 * 60 * 60 * 1000;
  const proximosVencimientos = liquidaciones
    .filter((l) => l.estado !== 'PAGADO' && l.fechaVencimiento)
    .map((l) => ({ l, ts: new Date(l.fechaVencimiento).getTime() }))
    .filter(({ ts }) => ts >= hoy.getTime() && ts <= en14)
    .sort((a, b) => a.ts - b.ts)
    .map(({ l }) => ({
      id: l.id,
      direccion: l.direccion,
      inquilino: l.inquilino,
      fecha: l.fechaVencimiento,
      monto: l.montoTotal,
    }));

  return {
    stats,
    morosos,
    propietariosSinCbu,
    porRendir,
    proximosVencimientos,
    cargando: cargC || cargP,
  };
}
