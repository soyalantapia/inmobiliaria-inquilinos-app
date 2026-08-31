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
  Moneda,
  MoraEfectiva,
  Propiedad,
  Propietario,
  TipoMora,
  TipoPropiedad,
} from '@/lib/types';
import { enriquecerPropiedad, type PropiedadEnriquecida } from '@/lib/propiedades-helpers';
import type { DashboardStats } from '@/lib/dashboard-helpers';
import { parseLocal } from '@/lib/format';
import { porcionAlquilerCobrada } from '@/lib/alquiler-cobrado';
import { faltaRendirle } from '@/lib/falta-rendirle';
import { cobradoRendible, plataDelContrato } from '@/lib/plata-del-contrato';
import { useRendidosDelPeriodo } from './use-rendiciones';
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
  propiedad: {
    id: string;
    direccion: string;
    ciudad: string;
    complejo?: string | null;
    consorcio?: { nombre: string } | null;
  };
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
    // Nombre por el que la inmobiliaria identifica la unidad. Se descartaba al mapear,
    // así que el listado y el detalle de contratos mostraban la calle aunque la
    // propiedad colgara de un consorcio ("nosotros cuando decimos Lourdes no le decimos
    // nunca Artigas la dirección", 03/08). Ver lib/rotulo-propiedad.ts.
    // Misma prioridad que en `mapPropiedad` más abajo: el consorcio real gana sobre el
    // texto libre. Si difieren, el consorcio es el dato administrado.
    complejo: c.propiedad?.consorcio?.nombre ?? c.propiedad?.complejo ?? null,
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

/** `enabled` (default true): ver el docblock de useReclamos — evita 403 por navegación. */
export function useAprobaciones(opts?: { enabled?: boolean }): {
  aprobaciones: Aprobacion[];
  cargando: boolean;
  /** `true` cuando la consulta falló: la lista vacía NO significa "no hay pendientes". */
  error?: boolean;
  aprobarApi: (id: string, pin: string, comentario?: string) => Promise<Aprobacion>;
  rechazarApi: (id: string, pin: string, motivo: string) => Promise<Aprobacion>;
} {
  const qc = useQueryClient();
  const habilitado = opts?.enabled ?? true;
  const q = useQuery({
    queryKey: ['aprobaciones'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<AprobacionApi[]>('/aprobaciones');
      return data.map(mapAprobacion);
    },
    enabled: apiEnabled && habilitado,
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
  //
  // Pero devolver la lista vacía SIN decir que fue por un error hacía que la bandeja afirmara
  // "Sin pendientes. Buen trabajo." — una afirmación inventada, que es justo lo que este bloque
  // quería evitar al no sembrar datos. El admin cerraba el panel convencido de estar al día
  // mientras un gasto esperaba el visto.
  if (q.isError) {
    return {
      aprobaciones: [],
      cargando: false,
      error: true,
      aprobarApi: async () => { throw new Error('Sin conexión con el servidor'); },
      rechazarApi: async () => { throw new Error('Sin conexión con el servidor'); },
    };
  }

  return {
    aprobaciones: q.data ?? [],
    cargando: q.isPending,
    error: false,
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
  moneda?: MovimientoCaja['moneda'];
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
    // ?? 'ARS': el back la agregó con default ARS, pero un cliente viejo cacheado
    // puede recibir la fila sin el campo. Sin el fallback el KPI queda "undefined".
    moneda: m.moneda ?? 'ARS',
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
  /** null = movimiento propio de la inmobiliaria, no imputable a una propiedad. */
  propiedadId: string | null;
  /** GASTO = salida, INGRESO_EXTRA = entrada. Default GASTO. */
  tipo?: MovimientoCaja['tipo'];
  categoria: MovimientoCaja['categoria'];
  descripcion: string;
  monto: number;
  /** Moneda del movimiento. Default ARS. La rendición sólo toma los de SU moneda. */
  moneda?: MovimientoCaja['moneda'];
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
          moneda: g.moneda ?? 'ARS',
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
  // Foto de perfil (URL de /uploads del tenant). null = sin foto → iniciales.
  imageUrl?: string | null;
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
  /** Foto de perfil; null si no cargó ninguna (se muestran las iniciales). */
  imageUrl: string | null;
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

/**
 * Cambia (o borra, con null) la foto de perfil del usuario logueado. El archivo se
 * sube antes con subirArchivo(); acá sólo se persiste la URL. El backend valida que
 * la URL sea del tenant y borra la foto anterior si queda huérfana.
 */
export function useActualizarAvatar(): {
  guardar: (imageUrl: string | null) => Promise<void>;
} {
  const qc = useQueryClient();
  return {
    guardar: async (imageUrl) => {
      await ensureApiSession();
      await apiFetch('/me/avatar', { method: 'PUT', body: JSON.stringify({ imageUrl }) });
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
  };
}

export function useMe(): { me: Me | null; cargando: boolean; isError: boolean } {
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
        // La demo no tiene backend de uploads: siempre iniciales.
        imageUrl: null,
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
      isError: false,
    };
  }
  const d = q.data;
  // isError viaja porque el CALLER no puede distinguir "todavía no cargó" de "falló":
  // en los dos casos `me` es null. El sidebar filtra el menú por `me.rol` y, sin esta
  // señal, un /auth/me caído lo dejaba pisado en LECTURA para siempre y en silencio —
  // el usuario veía un panel recortado sin ninguna explicación. Mismo criterio que
  // useAResolverCount, donde un 0 sin isError es un 0 FALSO.
  if (!d) return { me: null, cargando: q.isPending, isError: q.isError };
  const firstName = d.nombre.trim().split(/\s+/)[0] ?? d.nombre;
  return {
    me: {
      nombre: d.nombre,
      email: d.email,
      rol: d.rol,
      firstName,
      iniciales: iniciales(d.nombre, d.email),
      imageUrl: d.imageUrl ?? null,
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
    isError: false,
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
  mascotasPermitidas?: boolean | null;
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
    mascotasPermitidas: p.mascotasPermitidas ?? null,
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
  /** Lo cobrado que la rendición PUEDE pagar: sin condonaciones ni plata migrada. */
  montoCobradoRendible?: string | number | null;
  saldo?: string | number | null;
  fechaVencimiento: string;
  fechaPago: string | null;
  estado: string;
  moneda: string;
  contrato: {
    id: string;
    /** La propiedad de ESTE contrato. Opcionales por compat con backends viejos. */
    propiedadId?: string | null;
    modoCobranza?: string | null;
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
  /** Lo ya cobrado (pagos conciliados) de esta liquidación — la deuda que dejó de deber. */
  montoPagado: number;
  /**
   * Lo cobrado que se le puede RENDIR al dueño. NO es lo mismo que `montoPagado`.
   *
   * `montoPagado` incluye la deuda condonada y la plata registrada al migrar la cartera,
   * porque mide lo que el inquilino dejó de deber. La rendición filtra las dos. Usar
   * `montoPagado` para estimar lo que se le va a depositar al propietario hacía que la ficha
   * dijera "a recibir $450.000", el operador se lo dictara por teléfono, y Rendir contestara
   * 409 "todavía no hay cobros nuevos".
   */
  montoCobradoRendible: number;
  /** Lo que falta cobrar: max(0, montoTotal − montoPagado). */
  saldo: number;
  estado: string;
  /** Moneda de la liquidación. Se descartaba en el mapper, y sin ella la atribución
   *  por propietario sumaba pesos con dólares en un solo número. */
  moneda: Moneda;
  fechaVencimiento: string;
  fechaPago: string | null;
  direccion: string;
  inquilino: string;
  /**
   * La propiedad y el modo de cobranza DE ESTE CONTRATO, no del que la propiedad tenga como
   * actual. Es lo que ata la liquidación a su dueño cuando el contrato ya terminó o fue
   * reemplazado por uno nuevo — el momento exacto en que el join viejo se cortaba y la plata
   * cobrada desaparecía del panel.
   *
   * `null` cuando el backend todavía no los manda.
   */
  propiedadId: string | null;
  modoCobranza: string | null;
}

function mapLiquidacion(l: LiquidacionApi): LiquidacionItem {
  const montoPagado = Number(l.montoPagado ?? 0);
  return {
    id: l.id,
    contratoId: l.contratoId,
    propiedadId: l.contrato?.propiedadId ?? null,
    modoCobranza: l.contrato?.modoCobranza ?? null,
    periodo: l.periodo,
    montoAlquiler: Number(l.montoAlquiler),
    montoExpensas: l.montoExpensas != null ? Number(l.montoExpensas) : null,
    montoTotal: Number(l.montoTotal),
    montoPunitorio: Number(l.montoPunitorio ?? 0),
    montoPagado,
    // Sin el campo (backend viejo) cae a `montoPagado`, que es el comportamiento de antes:
    // peor estimación, pero no un cero que borraría el KPI de golpe.
    montoCobradoRendible:
      l.montoCobradoRendible != null ? Number(l.montoCobradoRendible) : montoPagado,
    // Fallback local si el server no mandó saldo (backend viejo): total − pagado.
    saldo: l.saldo != null ? Number(l.saldo) : Math.max(0, Number(l.montoTotal) - montoPagado),
    estado: l.estado,
    moneda: (l.moneda === 'USD' ? 'USD' : 'ARS') as Moneda,
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
  /** La consulta falló. Sin esto, "0 liquidaciones" es indistinguible de "no pudimos preguntar". */
  error: boolean;
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
  if (!apiEnabled) return { liquidaciones: [], cargando: false, deApi: false, error: false };
  if (q.isError) return { liquidaciones: [], cargando: false, deApi: true, error: true };
  return { liquidaciones: q.data ?? [], cargando: q.isPending, deApi: true, error: false };
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
  /** Última vez que entró al portal. `null` = nunca entró (o el backend es viejo). */
  ultimoAccesoAt?: string | null;
  createdAt: string;
  participaciones: Array<{ propiedadId: string; porcentaje: number }>;
}

export function usePropietarios(): {
  propietarios: Propietario[];
  cargando: boolean;
  deApi: boolean;
  /**
   * Algo falló: la lista de propietarios, o la de liquidaciones de la que salen TODOS los
   * números de plata de esta pantalla.
   *
   * Sin esto, un 403 o un 500 se veían igual que una cartera al día: la pantalla decía "Todos
   * rendidos este mes 🎉" y "Todos tienen CBU cargado" sobre una lista vacía. Y no hace falta
   * que se caiga nada: el rol CARGA tiene `propietarios.ver` pero NO `pagos.ver`, así que para
   * él `/liquidaciones` devuelve 403 SIEMPRE y ese cartel verde es su estado permanente.
   */
  error: boolean;
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
  const { liquidaciones, error: errorLiqs } = useLiquidaciones();

  if (!apiEnabled) return { propietarios: propietariosMock, cargando: false, deApi: false, error: false };
  if (ownersQ.isError) return { propietarios: [], cargando: false, deApi: true, error: true };

  // Atribuimos lo COBRADO este mes (liquidaciones PAGADAS del período) a cada
  // propietario según su participación en la propiedad del contrato. Lo "a
  // rendir" descuenta la comisión. Si nada se cobró todavía, queda en 0 — que
  // es el estado real de un alta nueva (sin pagos conciliados aún).
  const period = periodoActualYM();
  const props = propsQ.data ?? [];
  const cobradoByOwner: Record<string, number> = {};
  // Monedas que vio cada dueño este período. Si mezcla ARS+USD no existe UN total
  // que signifique algo: el listado y el diálogo mostraban 900.000 + 1.200 = 901.200
  // con símbolo de pesos, y el operador decidía cuánto transferir sobre ese número
  // inventado — recién al confirmar el server tiraba 409 "cobros en varias monedas".
  // Es el mismo guard que la ficha del propietario ya tenía (use-propietario.ts).
  const monedasByOwner: Record<string, Set<Moneda>> = {};
  for (const l of liquidaciones) {
    // PARCIAL cuenta: el server rinde `estado IN (PAGADO, PARCIAL)` desde que la rendición
    // es incremental — su propio comentario dice "antes tomaba sólo PAGADO (mes completo) y
    // el parcial cobrado no llegaba al dueño". El KPI del panel se quedó filtrando sólo
    // PAGADO, así que un mes cobrado a medias mostraba $0 a rendir y el operador no le
    // transfería NADA al propietario: plata cobrada que nunca llegaba.
    if (l.periodo !== period || (l.estado !== 'PAGADO' && l.estado !== 'PARCIAL')) continue;
    // POR LA PROPIEDAD DEL CONTRATO, NO POR EL "CONTRATO ACTUAL" DE LA PROPIEDAD.
    //
    // Acá había un `props.find(p => p.contratoActualId === l.contratoId)`, y ese join se corta
    // solo: al finalizar un contrato la propiedad queda con `contratoActualId: null`, y al
    // firmar uno nuevo apunta al nuevo. Desde ese instante la liquidación del contrato viejo
    // no encontraba propietario y se salteaba con un `continue`.
    //
    // La plata estaba cobrada de verdad, en la cuenta de la inmobiliaria. Pero el dueño
    // desaparecía del listado "Por rendir", su ficha mostraba "—" en Cobrado y A recibir, y el
    // diálogo de Rendir le mostraba Bruto $0 — mientras el server SÍ se la habría rendido, y
    // su portal se la seguía mostrando como pendiente. Justo el mes de la baja o la renovación,
    // que es cuando más se mira.
    //
    // El fallback al join viejo es para backends que todavía no mandan `propiedadId`.
    const propIdDeLaLiq = l.propiedadId;
    const prop = propIdDeLaLiq
      ? props.find((p) => p.id === propIdDeLaLiq)
      : props.find((p) => p.contratoActualId === l.contratoId);
    if (!prop) continue;
    // El KPI "cobrado / a rendir" refleja lo que la inmobiliaria va a RENDIR al
    // propietario. POST /rendiciones (server) sólo cuenta contratos
    // modoCobranza=INMOBILIARIA; en PROPIETARIO_DIRECTO el dueño cobra él mismo y no
    // se rinde → contarlo acá inflaba el bruto y no coincidía con la rendición real.
    //
    // Se mira el modo del contrato DE LA LIQUIDACIÓN, no el del contrato actual de la
    // propiedad: son distintos apenas el contrato dejó de ser el actual, y en ese caso el del
    // actual puede no existir (unidad vacía) o ser el de un inquilino nuevo con otro modo.
    const modoDeLaLiq = l.modoCobranza ?? prop.contratoActual?.modoCobranza;
    if (modoDeLaLiq === 'PROPIETARIO_DIRECTO') continue;
    for (const part of prop.participaciones) {
      // Sobre el ALQUILER (no montoTotal): igual que la rendición real del server,
      // las expensas no le corresponden al propietario. Antes inflaba el KPI y el
      // preview del diálogo de rendición.
      // Porción de ALQUILER de lo REALMENTE cobrado, con el mismo prorrateo que el server.
      // La base va SIN mora: `l.montoTotal` viene decorado por `conSaldo` con el punitorio
      // al día (lo dice el comentario de `montoPunitorio` en el tipo de arriba), así que
      // usarlo crudo prorrateaba contra un denominador más grande y mostraba menos alquiler
      // cobrado del que la rendición efectivamente paga. Coincidían mientras no hubiera mora.
      // `montoCobradoRendible` y NO `montoPagado`: este número estima LO QUE SE LE VA A
      // DEPOSITAR AL DUEÑO, y la rendición filtra la deuda condonada y la plata de la
      // migración de cartera. Con `montoPagado` —que las incluye, porque mide lo que el
      // inquilino dejó de deber— la ficha decía "Cobrado $500.000 · A recibir $450.000", el
      // operador se lo dictaba al dueño por teléfono, apretaba Rendir y el server contestaba
      // 409 "todavía no hay cobros nuevos". El dashboard ya usaba el criterio correcto
      // (`metricas.ts`), así que dos pantallas del mismo panel se contradecían sobre el mismo
      // propietario.
      const alquilerCobradoLiq = porcionAlquilerCobrada({
        alquiler: l.montoAlquiler,
        base: l.montoTotal - l.montoPunitorio,
        cobrado: l.montoCobradoRendible,
      });
      cobradoByOwner[part.propietarioId] =
        (cobradoByOwner[part.propietarioId] ?? 0) + alquilerCobradoLiq * (part.porcentaje / 100);
      (monedasByOwner[part.propietarioId] ??= new Set()).add(l.moneda);
    }
  }

  const propietarios: Propietario[] = (ownersQ.data ?? []).map((o) => {
    const monedas = monedasByOwner[o.id] ?? new Set<Moneda>();
    const mezcladas = monedas.size > 1;
    // Mezcladas → 0 y sin moneda: la UI muestra "—" en vez de un total falso.
    const cobrado = mezcladas ? 0 : Math.round(cobradoByOwner[o.id] ?? 0);
    const recibir = Math.round(cobrado * (1 - (o.comisionPct ?? 0) / 100));
    const monedaMensual = monedas.size === 1 ? [...monedas][0] : null;
    return {
      id: o.id,
      nombre: o.nombre,
      apellido: o.apellido,
      cuit: o.cuit ?? '',
      email: o.email ?? '',
      telefono: o.telefono ?? '',
      cbuAlias: o.cbuAlias,
      ultimoAccesoAt: o.ultimoAccesoAt ?? null,
      comisionPct: o.comisionPct ?? 0,
      notas: o.notas,
      createdAt: (o.createdAt ?? '').slice(0, 10),
      propiedadesIds: (o.participaciones ?? []).map((x) => x.propiedadId),
      totalCobradoMes: cobrado,
      totalRecibirMes: recibir,
      monedaMensual,
      monedasMes: [...monedas],
    };
  });

  // `errorLiqs` viaja aunque la lista de dueños haya venido bien: los nombres se ven, pero
  // todos los números de plata quedan en 0 y eso NO es "al día".
  return { propietarios, cargando: ownersQ.isPending, deApi: true, error: errorLiqs };
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
  /** ¿Se permiten mascotas? Tri-estado: omitido/null = no especificado. */
  mascotasPermitidas?: boolean | null;
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

/**
 * Anular/deshacer una rendición. Requiere PIN y MOTIVO.
 *
 * El motivo es obligatorio en el server (mínimo 5) y no es burocracia: anular le saca de la
 * pantalla un depósito a alguien que ya lo vio. Desde este cambio la rendición no se borra
 * —queda marcada como anulada— y el propietario la ve tachada CON este texto al lado, que es
 * la respuesta a la llamada que va a hacer. Mismo criterio que anular un pago.
 */
export async function anularRendicion(rendicionId: string, motivo: string, pin: string): Promise<void> {
  await ensureApiSession();
  await apiFetch(`/rendiciones/${rendicionId}/anular`, {
    method: 'POST',
    body: JSON.stringify({ pin, motivo }),
  });
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
  // El tablero NO consultaba rendiciones, así que "propietarios por rendir" no medía eso:
  // medía "cuántos dueños tienen alquiler cobrado este mes", y NUNCA bajaba dentro del
  // período por más rendiciones que se hicieran. La card linkea a
  // `/propietarios?filtro=sin-rendir`, y esa pantalla SÍ descuenta lo rendido: el operador
  // hacía click en "3 por rendir" y caía en una lista vacía. Dos pantallas del mismo panel
  // contradiciéndose sobre plata.
  //
  // Efecto colateral que también se arregla: el empty state "Todo al día — no tenés acciones
  // urgentes" exige `porRendir === 0`, así que en cualquier cuenta que hubiera cobrado algo
  // ese cartel era inalcanzable PARA SIEMPRE.
  const { yaRendidos, cargando: cargRend } = useRendidosDelPeriodo(propietarios.map((p) => p.id));

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
  // La regla de cuánto aporta CADA contrato vive en `lib/plata-del-contrato.ts`, con sus tests:
  // acá era un switch inline y ahí se le escapó el caso que más importa (VENCIDO con pago
  // parcial, que aportaba 0 a "Cobrado" y hacía bajar el número solo).
  let cobrado = 0;
  let porCobrar = 0;
  let mora = 0;
  for (const c of activos) {
    const p = plataDelContrato(c);
    cobrado += p.cobrado;
    porCobrar += p.porCobrar;
    mora += p.mora;
  }
  // Una sola fuente para el conteo y para la lista de abajo: tener dos formas de contar "los
  // morosos" es exactamente el defecto que este PR arregla en otro renglón.
  const moraContratos = activos.filter((c) => c.estadoPagoActual === 'VENCIDO');
  const enMora = { monto: mora, cantidad: moraContratos.length };
  const totalActivos = cobrado + porCobrar + enMora.monto;

  // Comisión real (sólo en prod): cada propietario trae su comisionPct y lo que se
  // le cobró este mes (totalCobradoMes). La comisión efectiva sobre lo cobrado del
  // estudio es el promedio ponderado de comisionPct por lo cobrado de cada
  // propietario, reemplazando el 0.08 fijo por la tasa real sin perder coherencia
  // con `cobrado`. En el demo se mantiene el 0.08 fijo (parity byte-for-byte).
  const tasaComision = apiEnabled ? comisionEfectiva(propietarios) : COMISION_DASHBOARD;
  // La comisión va sobre el ALQUILER cobrado, NO sobre todo lo que entró (regla congelada
  // del modelo de plata). `cobrado` incluye expensas y mora, así que aplicarle la tasa
  // directo inflaba la comisión que ve la inmobiliaria —y con ella el "A rendir", que sale
  // de restarla—. Se prorratea igual que el backend en la rendición
  // (alquilerCobrado = cobrado capeado × montoAlquiler / montoTotal): la mora queda afuera
  // porque el cap la corta, y las expensas por la proporción.
  const alquilerCobrado = apiEnabled
    ? activos.reduce((acc, c) => {
        // VENCIDO incluido, por el mismo motivo que arriba: lo cobrado antes de atrasarse sigue
        // cobrado, y su porción de alquiler sigue siendo rendible.
        const pagado = cobradoRendible(c);
        if (pagado <= 0) return acc;
        // La base se arma sumando componentes, así que ya viene sin mora. Mismo helper que
        // el KPI de arriba, que es donde esto estaba mal.
        return (
          acc +
          porcionAlquilerCobrada({
            alquiler: c.monto,
            base: c.monto + (c.montoExpensas ?? 0),
            cobrado: pagado,
          })
        );
      }, 0)
    : cobrado;
  const comisionMes = Math.round(alquilerCobrado * tasaComision);
  // A rendir = cobrado − comisión − gastos de caja aún NO descontados en una
  // rendición (paridad con el demo `calcularDashboardStats`, que resta
  // gastosPendientes). En prod el path había quedado sin restar los gastos → el
  // número "A rendir a propietarios" salía inflado hasta que se hacía la rendición.
  const gastosPendientes = apiEnabled
    ? movsCaja
        .filter((m) => m.tipo === 'GASTO' && !m.descontadoEnRendicion)
        .reduce((a, m) => a + m.monto, 0)
    : 0;
  // LA BASE ES EL ALQUILER COBRADO, NO TODO LO QUE ENTRÓ.
  //
  // Salía de `cobrado`, que incluye expensas y mora. Las expensas van al consorcio y la mora es
  // ingreso de la inmobiliaria —lo dice `packages/shared/src/prorrateo.ts`—, así que ninguna de
  // las dos se le rinde al dueño. El propio bloque de arriba ya había arreglado esto para la
  // COMISIÓN, con el comentario escrito, y dejó la base del "A rendir" sin tocar.
  //
  // El tamaño del error, en el caso feliz: alquiler 500.000 + expensas 100.000, comisión 8%, el
  // inquilino paga todo en fecha. El tablero decía 600.000 − 48.000 = 552.000. `/propietarios`
  // decía 500.000 × 0,92 = 460.000. Noventa y dos mil pesos de diferencia el mismo día, y el
  // número del tablero es el que se mira primero.
  //
  // QUEDA UNA DIFERENCIA MENOR Y DELIBERADA: acá se restan los gastos de caja pendientes y
  // `/propietarios` no los conoce. Es paridad con el demo (`calcularDashboardStats`) y sacarlo
  // es otra decisión; la divergencia grande era la base.
  const aRendirMes = Math.max(0, Math.round(alquilerCobrado - comisionMes - gastosPendientes));

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
  // Mismo criterio que `/propietarios`, importado del mismo lugar: `totalRecibirMes` vale 0
  // cuando el dueño cobró en dos monedas, así que ese cero no significa "nada que rendir".
  const porRendir = propietarios.filter((p) => faltaRendirle(p, yaRendidos.has(p.id))).length;

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
    // `cargRend` va acá o el contador parpadea ALTO —sin descontar nada— antes de asentarse.
    cargando: cargC || cargP || cargOwn || cargLiq || cargCaja || cargRend,
    error: errContratos || errProps,
    propiedadesTotal: propiedades.length,
  };
}
