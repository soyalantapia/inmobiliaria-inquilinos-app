'use client';

/**
 * Detalle de un contrato desde el API real (GET /contratos/:id), con fallback
 * al mock (contratosMock + helpers) sólo en build demo (!apiEnabled).
 *
 * El endpoint devuelve el contrato completo + propiedad (con participaciones y
 * propietarios), inquilino titular, sociedad, garantes, co-inquilinos y
 * documentos. Lo mapeamos al tipo `ContratoListado` que renderiza la página,
 * más los datos laterales que la pantalla saca de los mocks (contacto del
 * titular/garante, propietario para cobranza directa).
 *
 * Lo que el endpoint NO trae (eventos, comunicaciones) → vacío real en prod.
 * Las liquidaciones se generan al vuelo con `generarLiquidaciones` (función
 * pura derivada del monto), igual que en el mock, para no dejar la tab vacía.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import {
  type Comunicacion,
  type ContactoCobranza,
  type EventoContrato,
  type LiquidacionAdmin,
  comunicacionesMock,
  contactosCobranzaMock,
  contratosMock,
  eventosContratoMock,
  generarLiquidaciones,
  propietariosMock,
} from '@/lib/mock-data';
import type { ContratoListado, MoraEfectiva, Propietario, TipoMora } from '@/lib/types';

// ---- Shape de la respuesta del API (GET /contratos/:id) ----

interface PropietarioApi {
  id: string;
  nombre: string;
  apellido: string;
  cuit: string;
  email: string;
  telefono: string;
  cbuAlias: string | null;
  cuentaCobranza?: {
    banco: string;
    titular: string;
    cbu: string;
    alias: string;
    cuit: string;
  } | null;
}

interface ContratoApi {
  id: string;
  estado: ContratoListado['estado'];
  monto: string | number;
  moneda: ContratoListado['moneda'];
  fechaInicio: string;
  fechaFin: string;
  diaPago: number;
  indiceAjuste: string | null;
  frecuenciaAjusteMeses: number | null;
  proximoAjuste: string | null;
  // Derivados de liquidaciones reales por el backend (GET /contratos/:id).
  proximoVencimiento?: string | null;
  estadoPagoActual?: ContratoListado['estadoPagoActual'];
  tipoContrato: ContratoListado['tipoContrato'];
  montoExpensas: string | number | null;
  cbuAlias: string | null;
  titularCuenta: string | null;
  comisionInmobiliaria: number | null;
  depositoGarantia: string | number | null;
  estadoDeposito: string | null;
  modoCobranza: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO' | null;
  cobraDirectoPropietarioId: string | null;
  /** Interés por mora: override propio del contrato + esquema resuelto. */
  moraTipo?: TipoMora | null;
  moraValor?: string | number | null;
  moraEfectiva?: {
    tipo: TipoMora;
    valor: string | number | null;
    origen: MoraEfectiva['origen'];
  } | null;
  cargadoPor: string | null;
  cargadoRol: ContratoListado['cargadoRol'] | null;
  cargadoAt: string | null;
  pendienteAprobacion: boolean | null;
  aprobadoPor: string | null;
  aprobadoAt: string | null;
  propiedad: {
    id: string;
    direccion: string;
    ciudad: string | null;
    participaciones: { propietario: PropietarioApi }[];
  } | null;
  inquilinoTitular: {
    id: string;
    nombre: string;
    apellido: string | null;
    email: string | null;
    telefono: string | null;
  } | null;
  garantes: {
    id: string;
    tipo: string;
    nombreProveedor: string;
    contactoNombre: string;
    contactoTelefono: string;
    contactoEmail: string | null;
  }[];
  // Liquidaciones reales del contrato (GET /contratos/:id) con montoPagado/saldo.
  liquidaciones?: {
    id: string;
    contratoId: string;
    periodo: string;
    montoAlquiler: string | number;
    montoExpensas: string | number | null;
    montoTotal: string | number;
    fechaVencimiento: string;
    fechaPago: string | null;
    estado: LiquidacionAdmin['estado'];
    metodoPago: LiquidacionAdmin['metodoPago'];
    montoPagado?: string | number | null;
    saldo?: string | number | null;
    /** Mora al día (punitorio), ya sumada en montoTotal. */
    montoPunitorio?: string | number | null;
  }[];
}

export interface ContratoDetalle {
  contrato: ContratoListado;
  contacto: ContactoCobranza | null;
  propietarioDirecto: Propietario | null;
  liquidaciones: LiquidacionAdmin[];
  eventos: EventoContrato[];
  comunicaciones: Comunicacion[];
}

// ---- Mapeo API → tipos de la pantalla ----

function nombreCompleto(nombre: string, apellido: string | null): string {
  return `${nombre} ${apellido ?? ''}`.trim();
}

function mapContrato(r: ContratoApi): ContratoListado {
  const expensas =
    r.montoExpensas != null && r.montoExpensas !== '' ? Number(r.montoExpensas) : null;
  return {
    id: r.id,
    inquilino: r.inquilinoTitular
      ? nombreCompleto(r.inquilinoTitular.nombre, r.inquilinoTitular.apellido)
      : '—',
    direccion: r.propiedad?.direccion ?? '—',
    monto: Number(r.monto),
    moneda: r.moneda,
    estado: r.estado,
    fechaInicio: (r.fechaInicio ?? '').slice(0, 10),
    fechaFin: (r.fechaFin ?? '').slice(0, 10),
    // proximoVencimiento real (derivado de liquidaciones por el backend); si no
    // viniera, caemos al próximo ajuste y luego a la fecha de fin.
    proximoVencimiento: (r.proximoVencimiento ?? r.proximoAjuste ?? r.fechaFin ?? '').slice(0, 10),
    estadoPagoActual: r.estadoPagoActual ?? 'PENDIENTE',
    cbuAlias: r.cbuAlias,
    titularCuenta: r.titularCuenta,
    tipoContrato: r.tipoContrato ?? 'ALQUILER_Y_EXPENSAS',
    montoExpensas: expensas,
    indiceAjuste: r.indiceAjuste,
    frecuenciaAjusteMeses: r.frecuenciaAjusteMeses,
    // Próximo ajuste programado (ISO); el backend lo setea al alta. La ficha lo
    // muestra en el resumen. null si no hay ajuste programado.
    proximoAjuste: r.proximoAjuste ? r.proximoAjuste.slice(0, 10) : null,
    cargadoPor: r.cargadoPor ?? undefined,
    cargadoAt: r.cargadoAt ?? undefined,
    cargadoRol: r.cargadoRol ?? undefined,
    pendienteAprobacion: r.pendienteAprobacion ?? false,
    aprobadoPor: r.aprobadoPor,
    aprobadoAt: r.aprobadoAt,
    modoCobranza: r.modoCobranza ?? 'INMOBILIARIA',
    cobraDirectoPropietarioId: r.cobraDirectoPropietarioId,
    depositoGarantia: r.depositoGarantia != null && r.depositoGarantia !== '' ? Number(r.depositoGarantia) : null,
    estadoDeposito: r.estadoDeposito ?? undefined,
    moraTipo: r.moraTipo ?? null,
    moraValor: r.moraValor != null ? Number(r.moraValor) : null,
    ...(r.moraEfectiva
      ? {
          moraEfectiva: {
            tipo: r.moraEfectiva.tipo,
            valor: r.moraEfectiva.valor != null ? Number(r.moraEfectiva.valor) : null,
            origen: r.moraEfectiva.origen,
          },
        }
      : {}),
  };
}

function mapContacto(r: ContratoApi): ContactoCobranza | null {
  if (!r.inquilinoTitular && r.garantes.length === 0) return null;
  const g = r.garantes[0] ?? null;
  return {
    contratoId: r.id,
    titular: {
      nombre: r.inquilinoTitular ? nombreCompleto(r.inquilinoTitular.nombre, r.inquilinoTitular.apellido) : '—',
      telefono: r.inquilinoTitular?.telefono ?? '—',
      email: r.inquilinoTitular?.email ?? '—',
    },
    garante: g
      ? {
          nombre: g.contactoNombre || g.nombreProveedor,
          telefono: g.contactoTelefono,
          tipo:
            g.tipo === 'DIGITAL' && g.nombreProveedor
              ? `Digital · ${g.nombreProveedor}`
              : g.tipo.charAt(0) + g.tipo.slice(1).toLowerCase(),
        }
      : null,
  };
}

function mapPropietarioDirecto(r: ContratoApi): Propietario | null {
  if (!r.cobraDirectoPropietarioId || !r.propiedad) return null;
  const p = r.propiedad.participaciones
    .map((x) => x.propietario)
    .find((x) => x.id === r.cobraDirectoPropietarioId);
  if (!p) return null;
  return {
    id: p.id,
    nombre: p.nombre,
    apellido: p.apellido,
    cuit: p.cuit,
    email: p.email,
    telefono: p.telefono,
    cbuAlias: p.cbuAlias,
    comisionPct: 0,
    notas: null,
    createdAt: '',
    propiedadesIds: [],
    totalCobradoMes: 0,
    totalRecibirMes: 0,
    cuentaCobranza: p.cuentaCobranza ?? undefined,
  };
}

function mapLiquidacionAdmin(l: NonNullable<ContratoApi['liquidaciones']>[number]): LiquidacionAdmin {
  const montoTotal = Number(l.montoTotal);
  const montoPagado = l.montoPagado != null ? Number(l.montoPagado) : 0;
  return {
    id: l.id,
    contratoId: l.contratoId,
    periodo: l.periodo,
    montoAlquiler: Number(l.montoAlquiler),
    montoExpensas: l.montoExpensas != null ? Number(l.montoExpensas) : 0,
    montoTotal,
    fechaVencimiento: (l.fechaVencimiento ?? '').slice(0, 10),
    fechaPago: l.fechaPago ? l.fechaPago.slice(0, 10) : null,
    estado: l.estado,
    metodoPago: l.metodoPago ?? null,
    montoPagado,
    saldo: l.saldo != null ? Number(l.saldo) : Math.max(0, montoTotal - montoPagado),
    ...(l.montoPunitorio != null ? { montoPunitorio: Number(l.montoPunitorio) } : {}),
  };
}

function mapDetalle(r: ContratoApi): ContratoDetalle {
  const contrato = mapContrato(r);
  return {
    contrato,
    contacto: mapContacto(r),
    propietarioDirecto: mapPropietarioDirecto(r),
    // Liquidaciones REALES del API (con montoPagado/saldo). Antes se hardcodeaba
    // `[]` (el endpoint no las traía) → el tab "Pagos" del contrato quedaba SIEMPRE
    // vacío, aun con pagos informados o conciliados (bug 4). NO fabricamos cuotas
    // falsas: si el contrato no tiene liquidaciones, el empty state es real.
    liquidaciones: (r.liquidaciones ?? []).map(mapLiquidacionAdmin),
    // El detalle no expone estos logs todavía → empty state real en prod.
    eventos: [],
    comunicaciones: [],
  };
}

// ---- Fallback mock (build demo) ----

function detalleMock(id: string): ContratoDetalle | null {
  const c = contratosMock.find((x) => x.id === id);
  if (!c) return null;
  const contacto = contactosCobranzaMock.find((x) => x.contratoId === id) ?? null;
  const propietarioDirecto = c.cobraDirectoPropietarioId
    ? propietariosMock.find((p) => p.id === c.cobraDirectoPropietarioId) ?? null
    : null;
  return {
    contrato: c,
    contacto,
    propietarioDirecto,
    liquidaciones: generarLiquidaciones(c.id, c.monto, c.montoExpensas ?? 0),
    eventos: eventosContratoMock.filter((e) => e.contratoId === id),
    comunicaciones: comunicacionesMock.filter((cm) => cm.contratoId === id),
  };
}

export function useContrato(id: string): {
  detalle: ContratoDetalle | null;
  cargando: boolean;
  noEncontrado: boolean;
  deApi: boolean;
} {
  const q = useQuery({
    queryKey: ['contrato', id],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<ContratoApi>(`/contratos/${id}`);
      return mapDetalle(data);
    },
    enabled: apiEnabled && id.length > 0,
    staleTime: 15_000,
    retry: false,
  });

  if (!apiEnabled) {
    const detalle = detalleMock(id);
    return { detalle, cargando: false, noEncontrado: detalle === null, deApi: false };
  }
  if (q.isPending) {
    return { detalle: null, cargando: true, noEncontrado: false, deApi: true };
  }
  // 404 (o cualquier error) en prod → tratamos como no encontrado, sin mock.
  if (q.isError) {
    return { detalle: null, cargando: false, noEncontrado: true, deApi: true };
  }
  return { detalle: q.data ?? null, cargando: false, noEncontrado: q.data == null, deApi: true };
}
