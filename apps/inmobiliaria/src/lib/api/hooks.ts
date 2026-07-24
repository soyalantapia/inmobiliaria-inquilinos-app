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
import {
  leerConfiguracionPais,
  guardarConfiguracionPais,
  DEFAULT_CONFIG as DEFAULT_CONFIG_PAIS,
  type ConfiguracionPais,
} from '@/lib/paises';
import type {
  ContratoListado,
  EstadoPropiedad,
  MoraEfectiva,
  Propiedad,
  Propietario,
  TipoMora,
  TipoPropiedad,
} from '@/lib/types';
import { enriquecerPropiedad, type PropiedadEnriquecida } from '@/lib/propiedades-helpers';
import type { DashboardStats } from '@/lib/dashboard-helpers';
import { parseLocal } from '@/lib/format';
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
  inquilinoTitular: { id: string; nombre: string; apellido: string | null; telefono?: string | null } | null;
  /** Derivados por el server desde liquidaciones reales (Fase 3). */
  estadoPagoActual: ContratoListado['estadoPagoActual'];
  proximoVencimiento: string | null;
  /** Cobrado/saldo de la liquidación actual (para el KPI "Pendiente" en PARCIAL). */
  montoPagado?: string | number | null;
  saldo?: string | number | null;
  /** Deuda TOTAL acumulada del contrato (todas las cuotas impagas + mora). */
  deudaTotal?: string | number | null;
  modoCobranza?: string | null;
  /** Interés por mora: override propio + esquema resuelto por la cascada. */
  moraTipo?: TipoMora | null;
  moraValor?: string | number | null;
  moraEfectiva?: {
    tipo: TipoMora;
    valor: string | number | null;
    origen: MoraEfectiva['origen'];
  } | null;
}

function mapContrato(c: ContratoApi): ContratoListado {
  return {
    id: c.id,
    inquilino: c.inquilinoTitular
      ? `${c.inquilinoTitular.nombre} ${c.inquilinoTitular.apellido ?? ''}`.trim()
      : (c.propiedad?.consorcio?.nombre ?? '—'),
    // Teléfono del inquilino titular en el listado → habilita el WhatsApp/PDF de
    // cobranza de morosos en prod (antes el listado no lo traía).
    inquilinoTelefono: c.inquilinoTitular?.telefono ?? null,
    // Defensa: una respuesta sin la relación `propiedad` (p.ej. un POST que
    // devuelve la fila pelada) no debe crashear con "reading 'direccion'".
    direccion: c.propiedad?.direccion ?? '—',
    propiedadId: c.propiedad?.id,
    monto: Number(c.monto),
    moneda: c.moneda,
    estado: c.estado,
    fechaInicio: c.fechaInicio.slice(0, 10),
    fechaFin: c.fechaFin.slice(0, 10),
    proximoVencimiento: (c.proximoVencimiento ?? c.fechaFin).slice(0, 10),
    // Fecha del próximo AJUSTE de alquiler (distinto del vencimiento del
    // contrato). El ajuste masivo lo usa para pre-tildar "los que ajustan este
    // mes"; sin mapearlo, quedaba siempre en null → 0 pre-tildados.
    proximoAjuste: c.proximoAjuste ? c.proximoAjuste.slice(0, 10) : null,
    estadoPagoActual: c.estadoPagoActual ?? 'PENDIENTE',
    ...(c.montoPagado != null ? { montoPagado: Number(c.montoPagado) } : {}),
    ...(c.saldo != null ? { saldo: Number(c.saldo) } : {}),
    ...(c.deudaTotal != null ? { deudaTotal: Number(c.deudaTotal) } : {}),
    cbuAlias: c.cbuAlias,
    titularCuenta: c.titularCuenta,
    ...(c.tipoContrato ? { tipoContrato: c.tipoContrato } : {}),
    ...(c.montoExpensas != null ? { montoExpensas: Number(c.montoExpensas) } : {}),
    ...(c.pendienteAprobacion ? { pendienteAprobacion: true } : {}),
    ...(c.cargadoPor ? { cargadoPor: c.cargadoPor } : {}),
    ...(c.aprobadoPor ? { aprobadoPor: c.aprobadoPor } : {}),
    ...(c.modoCobranza ? { modoCobranza: c.modoCobranza as ContratoListado['modoCobranza'] } : {}),
    ...(c.moraTipo !== undefined ? { moraTipo: c.moraTipo } : {}),
    ...(c.moraValor != null ? { moraValor: Number(c.moraValor) } : {}),
    ...(c.moraEfectiva
      ? {
          moraEfectiva: {
            tipo: c.moraEfectiva.tipo,
            valor: c.moraEfectiva.valor != null ? Number(c.moraEfectiva.valor) : null,
            origen: c.moraEfectiva.origen,
          },
        }
      : {}),
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

  // Demo offline: seeds locales. SOLO en !apiEnabled — los seeds tienen un
  // CBU/alias INVENTADO, reenviarlos sería phishing. En prod jamás.
  if (!apiEnabled) {
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
  // Prod con API caída: vacío, nunca seeds.
  if (q.isError) {
    return {
      anuncios: [],
      cargando: false,
      crear: async () => { throw new Error('Sin conexión con el servidor'); },
      eliminar: async () => { throw new Error('Sin conexión con el servidor'); },
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

  if (!apiEnabled) {
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
  // Prod con API caída: vacío, nunca seeds (montos/autores fabricados).
  if (q.isError) {
    return {
      aprobaciones: [],
      cargando: false,
      aprobarApi: async () => { throw new Error('Sin conexión con el servidor'); },
      rechazarApi: async () => { throw new Error('Sin conexión con el servidor'); },
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
      void qc.invalidateQueries({ queryKey: ['contrato'] }); // y el DETALLE (badge "pendiente aprobación")
      return mapAprobacion(r);
    },
    rechazarApi: async (id, pin, motivo) => {
      const r = await apiFetch<AprobacionApi>(`/aprobaciones/${id}/rechazar`, {
        method: 'POST',
        body: JSON.stringify({ pin, comentario: motivo }),
      });
      invalidar();
      void qc.invalidateQueries({ queryKey: ['contratos'] }); // rechazar limpia pendienteAprobacion del contrato
      void qc.invalidateQueries({ queryKey: ['contrato'] }); // y el DETALLE (badge "pendiente aprobación")
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
  cuentaId: string | null;
  cuenta: { id: string; nombre: string } | null;
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
    cuentaId: m.cuentaId,
    cuentaNombre: m.cuenta?.nombre ?? null,
    cargadoPor: m.cargadoPor,
    createdAt: m.createdAt,
    descontadoEnRendicion: m.descontadoEnRendicion,
  };
}

export interface NuevoGasto {
  propiedadId: string;
  /** GASTO = salida, INGRESO_EXTRA = entrada. Default GASTO. */
  tipo?: MovimientoCaja['tipo'];
  categoria: MovimientoCaja['categoria'];
  descripcion: string;
  monto: number;
  fecha: string;
  proveedor?: string | null;
  /** Comprobante/ticket del gasto: URL de /uploads (ya subida). Opcional. */
  comprobanteUrl?: string | null;
  /** Cuenta de caja de dónde sale / a dónde entra la plata. Opcional. */
  cuentaId?: string | null;
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

  if (!apiEnabled) {
    // Modo demo: mismo contrato de funciones sobre localStorage
    return {
      movimientos: listarMovimientosCaja(),
      cargando: false,
      crearGasto: async (g) => {
        cargarMovimientoLocal({
          propiedadId: g.propiedadId,
          contratoId: null,
          tipo: g.tipo ?? 'GASTO',
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
  // Prod con API caída: vacío, nunca seeds (gastos/propiedadId mock fabricados).
  if (q.isError) {
    return {
      movimientos: [],
      cargando: false,
      crearGasto: async () => { throw new Error('Sin conexión con el servidor'); },
      eliminarGasto: async () => { throw new Error('Sin conexión con el servidor'); },
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

interface MeTrialApi {
  tipo: string;
  hasta: string;
  diasRestantes: number;
  vigente: boolean;
}

interface MeApi {
  kind: string;
  nombre: string;
  email: string;
  rol: string;
  // Nombre de la inmobiliaria del usuario (rama usuario de /auth/me).
  inmobiliaria?: string;
  // Campos del trial pre-lanzamiento (rama usuario de /auth/me). Opcionales
  // por compatibilidad: backends viejos o la rama no-usuario no los traen.
  esPiloto?: boolean;
  perfilFiscalCompleto?: boolean;
  tienePin?: boolean;
  trial?: MeTrialApi | null;
}

export interface MeTrial {
  tipo: string;
  hasta: string;
  diasRestantes: number;
  vigente: boolean;
}

export interface Me {
  nombre: string;
  email: string;
  rol: string;
  firstName: string;
  iniciales: string;
  /** Nombre de la inmobiliaria (para identificar el panel en el header). */
  inmobiliaria: string;
  /** Cuenta piloto de la beta pre-lanzamiento. */
  esPiloto: boolean;
  /** El perfil fiscal (ARCA/AFIP) está completo. */
  perfilFiscalCompleto: boolean;
  /** Ya configuró el PIN de seguridad en la DB (no solo en localStorage). */
  tienePin: boolean;
  /** Trial pre-lanzamiento si lo hay; null si la cuenta no tiene trial. */
  trial: MeTrial | null;
}

function iniciales(nombre: string, email: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  const ini = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  return ini || (email[0]?.toUpperCase() ?? '?');
}

/**
 * Configura / cambia el PIN de seguridad en el backend (DB). El panel lo usa en
 * modo API; en demo la card sigue con localStorage. Lanza ApiError con el
 * mensaje del server si el PIN actual no coincide o el nuevo es inválido.
 */
export async function setPinSeguridad(input: { pinNuevo: string; pinActual?: string }): Promise<void> {
  await ensureApiSession();
  await apiFetch('/auth/pin', { method: 'POST', body: JSON.stringify(input) });
}

// ===== Configuración: empresa (datos fiscales/contacto) =====

export interface EmpresaDatos {
  nombre: string;
  email: string;
  cuit: string;
  matricula: string;
  telefono: string;
  direccionCalle: string;
  direccionAltura: string;
  direccionPiso: string;
  direccionCiudad: string;
  direccionProvincia: string;
  direccionCp: string;
  // Identidad y contacto público del perfil (opcionales; '' si sin cargar).
  notasFiscales: string;
  whatsapp: string;
  sitioWeb: string;
  instagram: string;
  facebook: string;
  horariosAtencion: string;
  condicionIva: string;
  iibb: string;
  perfilFiscalCompleto: boolean;
}

export function useEmpresa(): { empresa: EmpresaDatos | null; cargando: boolean } {
  const q = useQuery({
    queryKey: ['empresa'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<EmpresaDatos>('/empresa');
    },
    enabled: apiEnabled,
    staleTime: 60_000,
  });
  return { empresa: q.data ?? null, cargando: q.isPending };
}

export async function setEmpresa(input: Partial<Omit<EmpresaDatos, 'perfilFiscalCompleto'>>): Promise<void> {
  await ensureApiSession();
  await apiFetch('/empresa', { method: 'PUT', body: JSON.stringify(input) });
}

// ===== Configuración: Mercado (país / moneda / índice default) =====
// Hook DUAL: en prod (apiEnabled) persiste por inmobiliaria vía /mercado; en demo
// usa localStorage (lib/paises). Misma forma `ConfiguracionPais` en ambos lados.
// El consumidor (configuracion-pais, wizard de contratos) no se entera del modo.
export function useMercado(): { config: ConfiguracionPais | null; cargando: boolean } {
  const q = useQuery({
    queryKey: ['mercado'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<ConfiguracionPais>('/mercado');
    },
    enabled: apiEnabled,
    staleTime: 60_000,
  });
  if (!apiEnabled) {
    // Demo: fuente local. `leerConfiguracionPais` ya guarda el window-guard.
    return { config: leerConfiguracionPais(), cargando: false };
  }
  // Ante error (red/permiso) caemos al default del país (AR/ARS/ICL) en vez de
  // null, para que el wizard arranque con algo coherente y no quede colgado
  // esperando un valor que nunca llega.
  if (q.isError) return { config: DEFAULT_CONFIG_PAIS, cargando: false };
  return { config: q.data ?? null, cargando: q.isPending };
}

export async function setMercado(config: ConfiguracionPais): Promise<void> {
  if (!apiEnabled) {
    guardarConfiguracionPais(config);
    return;
  }
  await ensureApiSession();
  await apiFetch('/mercado', { method: 'PUT', body: JSON.stringify(config) });
}

// ===== Configuración: cuenta de cobranza (el CBU que ve el inquilino) =====

export interface CobranzaCuenta {
  banco: string;
  titular: string;
  cbu: string;
  alias: string;
  cuit: string;
}

/** Esquema de mora por defecto de la inmobiliaria (GET /cobranza → mora). */
export interface MoraDefault {
  tipoDefault: TipoMora;
  valorDefault: number | null;
}

export function useCobranza(): {
  tieneCuenta: boolean;
  cuenta: CobranzaCuenta | null;
  /** Default de mora de la inmobiliaria; null mientras carga o si falla. */
  mora: MoraDefault | null;
  cargando: boolean;
} {
  const q = useQuery({
    queryKey: ['cobranza'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<{ tieneCuenta: boolean; cuenta: CobranzaCuenta; mora?: MoraDefault }>('/cobranza');
    },
    enabled: apiEnabled,
    staleTime: 60_000,
  });
  return {
    tieneCuenta: q.data?.tieneCuenta ?? false,
    cuenta: q.data?.cuenta ?? null,
    mora: q.data?.mora ?? null,
    cargando: q.isPending,
  };
}

export async function setCobranza(input: CobranzaCuenta): Promise<void> {
  await ensureApiSession();
  await apiFetch('/cobranza', { method: 'PUT', body: JSON.stringify(input) });
}

/**
 * Guarda el esquema de mora POR DEFECTO de la inmobiliaria (solo ADMIN).
 * Se aplica a los contratos que no definen su propio interés.
 */
export async function setMoraDefault(input: { tipo: TipoMora; valor?: number | null }): Promise<MoraDefault> {
  await ensureApiSession();
  return apiFetch<MoraDefault>('/cobranza/mora', { method: 'PUT', body: JSON.stringify(input) });
}

/**
 * Cuenta de cobranza DIRECTA de un propietario (la que ve el inquilino cuando
 * el contrato es PROPIETARIO_DIRECTO). Persiste en la DB (CuentaCobranzaDirecta).
 */
export async function setCuentaCobranzaDirecta(
  propietarioId: string,
  input: CobranzaCuenta,
): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/propietarios/${propietarioId}/cuenta-cobranza-directa`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// ===== Configuración: equipo y permisos =====

export type RolEquipo = 'ADMIN' | 'OPERADOR' | 'CARGA' | 'LECTURA';

export interface MiembroEquipo {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolEquipo;
  activo: boolean;
  esVos: boolean;
}

export function useEquipo(): { equipo: MiembroEquipo[]; cargando: boolean } {
  const q = useQuery({
    queryKey: ['equipo'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<MiembroEquipo[]>('/usuarios');
    },
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  return { equipo: q.data ?? [], cargando: q.isPending };
}

export async function crearUsuario(input: {
  nombre: string;
  apellido: string;
  email: string;
  rol: RolEquipo;
  // El invitado entra por OTP (código al email); la contraseña es opcional.
  password?: string;
}): Promise<void> {
  await ensureApiSession();
  await apiFetch('/usuarios', { method: 'POST', body: JSON.stringify(input) });
}

export async function cambiarUsuario(id: string, patch: { rol?: RolEquipo; nombre?: string; apellido?: string }): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
}

export async function eliminarUsuario(id: string): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/usuarios/${id}`, { method: 'DELETE' });
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
        inmobiliaria: 'Inmobiliaria del Sol',
        // En demo el trial pre-lanzamiento real no aplica: el TrialBanner usa
        // la fuente local (trial-storage) por su cuenta y estos quedan neutros.
        esPiloto: false,
        perfilFiscalCompleto: true,
        // En demo el PIN vive en localStorage (la card lo lee directo); este
        // campo solo lo usa la card en modo API.
        tienePin: false,
        trial: null,
      },
      cargando: false,
    };
  }
  const d = q.data;
  if (!d) return { me: null, cargando: q.isPending };
  const firstName = d.nombre.trim().split(/\s+/)[0] ?? d.nombre;
  return {
    me: {
      nombre: d.nombre,
      email: d.email,
      rol: d.rol,
      firstName,
      iniciales: iniciales(d.nombre, d.email),
      inmobiliaria: d.inmobiliaria ?? '',
      esPiloto: d.esPiloto ?? false,
      perfilFiscalCompleto: d.perfilFiscalCompleto ?? true,
      tienePin: d.tienePin ?? false,
      trial: d.trial
        ? {
            tipo: d.trial.tipo,
            hasta: d.trial.hasta,
            diasRestantes: d.trial.diasRestantes,
            vigente: d.trial.vigente,
          }
        : null,
    },
    cargando: false,
  };
}

export function useContratos(): { contratos: ContratoListado[]; cargando: boolean; deApi: boolean; error: boolean } {
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
  if (!apiEnabled) return { contratos: contratosMock, cargando: false, deApi: false, error: false };
  // En prod NUNCA caemos a mocks ante error: mostraría una cartera FABRICADA
  // (contratos/inquilinos/montos falsos) que envenena Dashboard + Pagos. Vacío.
  // `error` lo expone el dashboard para no confundir "fetch falló" con "cuenta vacía".
  if (q.isError) return { contratos: [], cargando: false, deApi: true, error: true };
  return { contratos: q.data ?? [], cargando: q.isPending, deApi: true, error: false };
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
  complejo?: string | null;
  consorcio?: { nombre: string } | null;
  participaciones: Array<{
    propietarioId: string;
    porcentaje: number;
    propietario: { id: string; nombre: string; apellido: string };
  }>;
  contratoActual: {
    id: string;
    estado: string;
    monto: string | number;
    moneda: string;
    modoCobranza?: string; // INMOBILIARIA | PROPIETARIO_DIRECTO — para no inflar el KPI cobrado
  } | null;
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
    // Defensa: si la respuesta no trae participaciones (p.ej. un POST que devuelve
    // la fila pelada), no crasheamos con "reading 'map'".
    propietariosIds: (p.participaciones ?? []).map((x) => x.propietarioId),
    participaciones: (p.participaciones ?? []).map((x) => ({
      propietarioId: x.propietarioId,
      porcentaje: x.porcentaje,
    })),
    contratoActualId: p.contratoActualId,
    ...(p.sociedadId ? { sociedadId: p.sociedadId } : {}),
    // Complejo EFECTIVO: consorcio real si está ligado, si no el texto libre.
    complejo: p.consorcio?.nombre ?? p.complejo ?? null,
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
  error: boolean;
} {
  const { contratos, cargando: cargandoContratos, error: errorContratos } = useContratos();
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
    return { propiedades: propiedadesMock.map(enriquecerPropiedad), cargando: false, deApi: false, error: false };
  }
  // API caída: empty + flag, NO mocks (no inventamos data en producción).
  if (propsQ.isError) return { propiedades: [], cargando: false, deApi: true, error: true };

  const reclamos = reclamosQ.data ?? [];
  const propiedades: PropiedadEnriquecida[] = (propsQ.data ?? []).map((p) => {
    const contrato = p.contratoActualId
      ? (contratos.find((c) => c.id === p.contratoActualId) ?? null)
      : null;
    // filter: el API puede devolver una participación con propietario null
    // (participación huérfana, estado de DB válido) → propietarioLite crashea al
    // desestructurar. Mismo guard que use-propiedad.ts.
    const propietarios = (p.participaciones ?? [])
      .filter((pp) => pp.propietario != null)
      .map((pp) => propietarioLite(pp.propietario, p.id));
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

  // Incluimos cargandoContratos: si /propiedades resuelve antes que /contratos,
  // todas las props aparecerían como "Sin contrato vigente" hasta el refetch.
  // `error` refleja un fallo de cualquiera de las dos fuentes (contratos o props).
  return { propiedades, cargando: propsQ.isPending || cargandoContratos, deApi: true, error: errorContratos };
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
  // Suma de pagos CONCILIADO y saldo = max(0, montoTotal − montoPagado), del
  // decorador conSaldo del server. Opcionales por compat con backends viejos.
  montoPagado?: string | number | null;
  saldo?: string | number | null;
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
  /** Mora al día incluida en montoTotal/saldo (0 si no hay). */
  montoPunitorio: number;
  /** Lo ya cobrado (pagos conciliados) de esta liquidación. */
  montoPagado: number;
  /** Lo que falta cobrar: max(0, montoTotal − montoPagado). */
  saldo: number;
  estado: string;
  fechaVencimiento: string;
  fechaPago: string | null;
  direccion: string;
  inquilino: string;
}

function mapLiquidacion(l: LiquidacionApi): LiquidacionItem {
  const montoPagado = Number(l.montoPagado ?? 0);
  return {
    id: l.id,
    contratoId: l.contratoId,
    periodo: l.periodo,
    montoAlquiler: Number(l.montoAlquiler),
    montoExpensas: l.montoExpensas != null ? Number(l.montoExpensas) : null,
    montoTotal: Number(l.montoTotal),
    montoPunitorio: Number(l.montoPunitorio ?? 0),
    montoPagado,
    // Fallback local si el server no mandó saldo (backend viejo): total − pagado.
    saldo: l.saldo != null ? Number(l.saldo) : Math.max(0, Number(l.montoTotal) - montoPagado),
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
    // El KPI "cobrado / a rendir" refleja lo que la inmobiliaria va a RENDIR al
    // propietario. POST /rendiciones (server) sólo cuenta contratos
    // modoCobranza=INMOBILIARIA; en PROPIETARIO_DIRECTO el dueño cobra él mismo y no
    // se rinde → contarlo acá inflaba el bruto y no coincidía con la rendición real.
    if (prop.contratoActual?.modoCobranza === 'PROPIETARIO_DIRECTO') continue;
    for (const part of prop.participaciones) {
      // Sobre el ALQUILER (no montoTotal): igual que la rendición real del server,
      // las expensas no le corresponden al propietario. Antes inflaba el KPI y el
      // preview del diálogo de rendición.
      cobradoByOwner[part.propietarioId] =
        (cobradoByOwner[part.propietarioId] ?? 0) + l.montoAlquiler * (part.porcentaje / 100);
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

// ===== Alta de propietario (POST /propietarios) =====

/** Campos del form de alta de propietario; montos/porcentajes como number. */
export interface NuevoPropietario {
  nombre: string;
  apellido: string;
  email?: string;
  telefono?: string;
  cuit?: string;
  cbuAlias?: string;
  comisionPct?: number;
  notas?: string;
}

/**
 * Mutación de alta de propietario contra el API real. Invalida ['propietarios']
 * (lista + métricas) tras crear. Devuelve el Propietario mapeado para que el
 * caller pueda asociarlo en el acto (ej. asignarlo a un slot en Nueva propiedad).
 * En demo NO se usa: los dialogs mantienen su escritura local de antes.
 */
export function useCrearPropietario(): {
  crear: (input: NuevoPropietario) => Promise<Propietario>;
} {
  const qc = useQueryClient();
  return {
    crear: async (input) => {
      await ensureApiSession();
      const o = await apiFetch<PropietarioApi>('/propietarios', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await qc.invalidateQueries({ queryKey: ['propietarios'] });
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
        totalCobradoMes: 0,
        totalRecibirMes: 0,
      };
    },
  };
}

// ===== Alta de propiedad (POST /propiedades) =====

/** Form de alta de propiedad; participaciones suman 100. */
export interface NuevaPropiedad {
  direccion: string;
  ciudad: string;
  provincia: string;
  tipo: TipoPropiedad;
  ambientes?: number;
  m2?: number;
  /** URL de /uploads (Volume) subida con subirArchivo — foto de la propiedad. */
  fotoUrl?: string;
  /** Reglas de convivencia (texto libre) visibles para el inquilino en su PWA. */
  reglasConvivencia?: string;
  /** Nombre de complejo/edificio para agrupar propiedades. */
  complejo?: string;
  propietarios: Array<{ propietarioId: string; porcentaje: number }>;
}

/**
 * Mutación de alta de propiedad contra el API real. Invalida ['propiedades']
 * (lista + cards) tras crear y devuelve la Propiedad creada (para redirigir al
 * detalle). En demo NO se usa: el wizard mantiene su flujo local de antes.
 */
export function useCrearPropiedad(): {
  crear: (input: NuevaPropiedad) => Promise<Propiedad>;
} {
  const qc = useQueryClient();
  return {
    crear: async (input) => {
      await ensureApiSession();
      const p = await apiFetch<PropiedadApi>('/propiedades', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await qc.invalidateQueries({ queryKey: ['propiedades'] });
      return mapPropiedad(p);
    },
  };
}

/** Eliminar una propiedad sin historial (típicamente un alta duplicada). */
export function useEliminarPropiedad(): { eliminar: (id: string) => Promise<void> } {
  const qc = useQueryClient();
  return {
    eliminar: async (id) => {
      await ensureApiSession();
      await apiFetch(`/propiedades/${id}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['propiedades'] });
    },
  };
}

/** Anular/deshacer una rendición (requiere PIN). Lanza ApiError si el server rechaza. */
export async function anularRendicion(rendicionId: string, pin: string): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/rendiciones/${rendicionId}/anular`, { method: 'POST', body: JSON.stringify({ pin }) });
}

/** Colaterales de una baja de contrato, para avisar en el diálogo ANTES de confirmar. */
export interface FinalizarPreview {
  /** Deuda YA vencida que SOBREVIVE a la baja (sigue siendo cobrable). */
  deudaVencida: number;
  /** Cantidad de cuotas impagas vencidas que componen esa deuda. */
  cuotasImpagas: number;
  /** Cuotas futuras impagas sin pago que la baja ANULA. */
  cuotasFuturasAAnular: number;
  /** Pagos INFORMADO en revisión (se pueden validar/rendir después de la baja). */
  pagosEnRevision: number;
  /** Co-inquilinos ACEPTADOS que pierden el acceso de escritura al finalizar. */
  coInquilinos: number;
  /** Reclamos abiertos/en curso del contrato. */
  reclamosAbiertos: number;
  // ---- Rescisión (el diálogo los usa sólo si el operador elige RESCINDIDO) ----
  /** Depósito de garantía RETENIDO disponible a netear/devolver. */
  depositoEnCustodia?: number;
  /** Meses de penalidad efectivos (override contrato > default inmo). */
  mesesPenalidad?: number;
  /** Penalidad sugerida = mesesPenalidad × alquiler (el operador puede editarla). */
  penalidadSugerida?: number;
  /** Saldo neto = deuda + penalidad − depósito. >0 el ex-inquilino debe; <0 hay que devolverle. */
  saldoNeto?: number;
  moneda?: string;
}

/** Parámetros de la baja/rescisión que el diálogo manda al confirmar. */
export interface FinalizarOpts {
  tipo?: 'FINALIZADO' | 'RESCINDIDO';
  motivoRescision?: string;
  montoPenalidad?: number;
  decisionDeposito?: 'MANTENER' | 'DEVOLVER' | 'NETEAR' | 'EJECUTAR';
  montoDepositoDevuelto?: number;
}

/**
 * Preview de la baja: consulta los colaterales del contrato para que el diálogo de
 * "Finalizar" los muestre antes de confirmar la acción irreversible. En demo
 * (!apiEnabled) devuelve null → el diálogo usa el copy base sin números.
 */
export function useFinalizarPreview(): { obtenerPreview: (id: string) => Promise<FinalizarPreview | null> } {
  return {
    obtenerPreview: async (id) => {
      if (!apiEnabled) return null;
      await ensureApiSession();
      return (await apiFetch(`/contratos/${id}/finalizar-preview`)) as FinalizarPreview;
    },
  };
}

/** Finalizar un contrato: lo cierra y libera la propiedad (vuelve a DISPONIBLE).
 *  `tipo` distingue la finalización (fin natural) de la rescisión anticipada
 *  (RESCINDIDO); default FINALIZADO. Devuelve cuántas cuotas futuras impagas se
 *  anularon y el estado resultante (para el toast de éxito). */
export function useFinalizarContrato(): {
  finalizar: (
    id: string,
    opts?: FinalizarOpts,
  ) => Promise<{ cuotasAnuladas: number; estado: 'FINALIZADO' | 'RESCINDIDO'; cargoPenalidad: number }>;
} {
  const qc = useQueryClient();
  return {
    finalizar: async (id, opts) => {
      await ensureApiSession();
      const tieneBody = opts && Object.values(opts).some((v) => v !== undefined);
      const res = (await apiFetch(`/contratos/${id}/finalizar`, {
        method: 'POST',
        ...(tieneBody ? { body: JSON.stringify(opts) } : {}),
      })) as { cuotasAnuladas?: number; estado?: 'FINALIZADO' | 'RESCINDIDO'; cargoPenalidad?: number };
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['contratos'] }),
        qc.invalidateQueries({ queryKey: ['contrato', id] }),
        qc.invalidateQueries({ queryKey: ['propiedades'] }),
        qc.invalidateQueries({ queryKey: ['depositos-en-custodia'] }),
      ]);
      return {
        cuotasAnuladas: res?.cuotasAnuladas ?? 0,
        estado: res?.estado ?? 'FINALIZADO',
        cargoPenalidad: res?.cargoPenalidad ?? 0,
      };
    },
  };
}

/** Eliminar un propietario sin historial (típicamente un alta duplicada). */
export function useEliminarPropietario(): { eliminar: (id: string) => Promise<void> } {
  const qc = useQueryClient();
  return {
    eliminar: async (id) => {
      await ensureApiSession();
      await apiFetch(`/propietarios/${id}`, { method: 'DELETE' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['propietarios'] }),
        qc.invalidateQueries({ queryKey: ['propiedades'] }),
      ]);
    },
  };
}

// ===== Dashboard (agregados reales para el home) =====

export interface DashboardData {
  stats: DashboardStats;
  morosos: { contratoId: string; inquilino: string; direccion: string; monto: number; moneda: ContratoListado['moneda'] }[];
  propietariosSinCbu: number;
  porRendir: number;
  proximosVencimientos: { id: string; contratoId: string; direccion: string; inquilino: string; fecha: string; monto: number }[];
  cargando: boolean;
  /** Alguna fuente (contratos o propiedades) falló al cargar. El dashboard NO
   *  debe mostrar el estado vacío "cuenta nueva" en este caso: 0 propiedades por
   *  un fetch caído ≠ inmobiliaria sin propiedades. */
  error: boolean;
  /** Total de propiedades de la cuenta. Es la señal real de "cuenta nueva/vacía"
   *  (≠ `contratosActivos === 0`, que también da 0 con todos los contratos
   *  finalizados aunque la cuenta tenga propiedades y trabajo pendiente). */
  propiedadesTotal: number;
}

// Comisión por defecto (8%) usada en el demo y como último recurso cuando todavía
// no hay propietarios con comisión real ni nada cobrado del que derivar una tasa.
const COMISION_DASHBOARD = 0.08;

// Tasa de comisión efectiva (0..1) derivada de la comisión REAL por propietario.
// Pondera comisionPct por lo cobrado de cada propietario este mes; si nada se
// cobró aún, promedia los comisionPct cargados; si no hay propietarios, cae al 8%.
function comisionEfectiva(propietarios: Propietario[]): number {
  const cobrado = propietarios.reduce((a, p) => a + p.totalCobradoMes, 0);
  if (cobrado > 0) {
    const comision = propietarios.reduce(
      (a, p) => a + p.totalCobradoMes * ((p.comisionPct ?? 0) / 100),
      0,
    );
    return comision / cobrado;
  }
  if (propietarios.length > 0) {
    return propietarios.reduce((a, p) => a + (p.comisionPct ?? 0) / 100, 0) / propietarios.length;
  }
  return COMISION_DASHBOARD;
}

export function useDashboard(): DashboardData {
  const { contratos, cargando: cargC, error: errContratos } = useContratos();
  const { propiedades, cargando: cargP, error: errProps } = usePropiedades();
  const { propietarios, cargando: cargOwn } = usePropietarios();
  const { liquidaciones, cargando: cargLiq } = useLiquidaciones();
  const { movimientos: movsCaja, cargando: cargCaja } = useCaja();

  // Excluye PROPIETARIO_DIRECTO igual que dashboard-helpers (demo) y /pagos: esa
  // plata va directo del inquilino al dueño, no la cobra/rinde la inmo. (El path
  // PROD del dashboard había quedado sin este guard tras el fix de iter11.)
  const activos = contratos.filter(
    (c) => c.estado === 'ACTIVO' && c.modoCobranza !== 'PROPIETARIO_DIRECTO',
  );
  // KPIs del período en curso con la plata REAL de la liquidación actual (el
  // API expone montoPagado/saldo/deudaTotal): un PARCIAL suma lo ya cobrado a
  // "Cobrado" y su resto a "Por cobrar" (antes desaparecía de los TRES KPIs),
  // un PAGADO usa lo conciliado (cae al canon si la liq quedó PAGADA por
  // migración, sin Pagos), y "En mora" muestra la DEUDA TOTAL del contrato
  // (todas las cuotas vencidas + mora, `deudaTotal`), no solo la cuota del mes
  // — un moroso de 10 meses figuraba por 1 sola cuota.
  let cobrado = 0;
  let porCobrar = 0;
  for (const c of activos) {
    switch (c.estadoPagoActual) {
      case 'PAGADO':
        cobrado += c.montoPagado || c.monto;
        break;
      case 'PARCIAL':
        cobrado += c.montoPagado ?? 0;
        porCobrar += c.saldo ?? Math.max(0, c.monto - (c.montoPagado ?? 0));
        break;
      case 'PENDIENTE':
        porCobrar += c.saldo ?? c.monto;
        break;
      default:
        break; // VENCIDO va a "En mora"
    }
  }
  const moraContratos = activos.filter((c) => c.estadoPagoActual === 'VENCIDO');
  const enMora = {
    monto: moraContratos.reduce((a, c) => a + (c.deudaTotal ?? c.saldo ?? c.monto), 0),
    cantidad: moraContratos.length,
  };
  const totalActivos = cobrado + porCobrar + enMora.monto;

  // Comisión real (sólo en prod): cada propietario trae su comisionPct y lo que se
  // le cobró este mes (totalCobradoMes). La comisión efectiva sobre lo cobrado del
  // estudio es el promedio ponderado de comisionPct por lo cobrado de cada
  // propietario, reemplazando el 0.08 fijo por la tasa real sin perder coherencia
  // con `cobrado`. En el demo se mantiene el 0.08 fijo (parity byte-for-byte).
  const tasaComision = apiEnabled ? comisionEfectiva(propietarios) : COMISION_DASHBOARD;
  const comisionMes = Math.round(cobrado * tasaComision);
  // A rendir = cobrado − comisión − gastos de caja aún NO descontados en una
  // rendición (paridad con el demo `calcularDashboardStats`, que resta
  // gastosPendientes). En prod el path había quedado sin restar los gastos → el
  // número "A rendir a propietarios" salía inflado hasta que se hacía la rendición.
  const gastosPendientes = apiEnabled
    ? movsCaja
        .filter((m) => m.tipo === 'GASTO' && !m.descontadoEnRendicion)
        .reduce((a, m) => a + m.monto, 0)
    : 0;
  const aRendirMes = Math.max(0, Math.round(cobrado - comisionMes - gastosPendientes));

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
    // El CONTEO no excluye PROPIETARIO_DIRECTO (sí es un contrato activo) → coincide
    // con /contratos. La exclusión de PD es solo para los agregados $$ (cobrado/mora).
    contratosActivos: contratos.filter((c) => c.estado === 'ACTIVO').length,
    ocupacionPct,
    reclamosAbiertos,
    cobrabilidadPct,
  };

  const morosos = moraContratos.map((c) => ({
    contratoId: c.id,
    inquilino: c.inquilino,
    direccion: c.direccion,
    // Deuda real acumulada (cuotas vencidas + mora), no la cuota del mes.
    monto: c.deudaTotal ?? c.saldo ?? c.monto,
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
    .map((l) => ({ l, ts: parseLocal(l.fechaVencimiento).getTime() }))
    .filter(({ ts }) => ts >= hoy.getTime() && ts <= en14)
    .sort((a, b) => a.ts - b.ts)
    .map(({ l }) => ({
      id: l.id,
      contratoId: l.contratoId,
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
    // Incluye propietarios y liquidaciones: el dashboard deriva comisión/a-rendir y
    // próximos vencimientos de esos datos → sin esto se mostraba antes de tenerlos.
    cargando: cargC || cargP || cargOwn || cargLiq || cargCaja,
    error: errContratos || errProps,
    propiedadesTotal: propiedades.length,
  };
}
