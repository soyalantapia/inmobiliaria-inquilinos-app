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
  propiedadesMock,
  propietariosMock,
} from '@/lib/mock-data';
import type { ContratoListado, Moneda, MoraEfectiva, Propietario, TipoMora } from '@/lib/types';

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
    // Identidad reutilizable del inquilino dentro del tenant (ver el modelo Persona).
    // El API ya lo devolvía —`include: { inquilinoTitular: true }` trae todos los
    // escalares— pero el tipo no lo declaraba, así que el panel no tenía por dónde
    // linkear a la ficha de la persona.
    personaId?: string | null;
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
    /** La cuota trae su propia moneda (`Liquidacion.moneda`); el server ya la devolvía. */
    moneda?: Moneda | null;
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
  /** Dueños de la propiedad = LOCADOR del contrato de locación (para generar el Word/PDF). */
  propietarios: Propietario[];
  propietarioDirecto: Propietario | null;
  liquidaciones: LiquidacionAdmin[];
  eventos: EventoContrato[];
  comunicaciones: Comunicacion[];
  /** Ficha reutilizable del inquilino (modelo Persona). null en demo o si no tiene. */
  personaId?: string | null;
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
    // El id de la propiedad SÍ viene en la respuesta (`propiedad.id`) y no se mapeaba.
    // Sin él, en producción `c.propiedadId` quedaba undefined y dos cosas del detalle
    // del contrato no se renderizaban NUNCA: el link del header a la ficha de la
    // propiedad y la card "Servicios de la propiedad" —las dos gateadas por
    // `apiEnabled && c.propiedadId`, que en prod es siempre false—.
    //
    // El arreglo existía a medias: el mapper de DEMO lo inyecta desde el mock
    // (`{ ...c, propiedadId: prpMock.id }`) con un comentario que dice justamente que
    // "el contrato salía sin propiedadId y no aparecía el link". Se arregló el lado
    // que se veía probando en demo y quedó abierto el que corre en producción.
    propiedadId: r.propiedad?.id ?? undefined,
    // El API ya devolvía diaPago/comisionInmobiliaria/ciudad, pero no se mapeaban: el
    // generador del contrato de locación los inventaba (5, 4.17%, CABA) en un documento
    // que se FIRMA.
    diaPago: r.diaPago,
    comisionInmobiliaria: r.comisionInmobiliaria,
    ciudad: r.propiedad?.ciudad ?? null,
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

/** Shape común Propietario (API → front); lo comparten el directo y la lista completa. */
function mapPropietario(p: PropietarioApi): Propietario {
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

/**
 * TODOS los propietarios de la propiedad del contrato — son el LOCADOR del contrato de
 * locación. El generador de documentos los necesita: antes los buscaba contra los mocks
 * (`propiedadesMock.find(p => p.contratoActualId === contrato.id)`), y como en prod los
 * ids son cuids y los del mock son `cnt_00X`, el find NUNCA matcheaba → caía a
 * `propietariosMock.slice(0,1)` y TODOS los contratos salían a nombre de Eduardo Castro.
 */
function mapPropietarios(r: ContratoApi): Propietario[] {
  return (r.propiedad?.participaciones ?? []).map((x) => mapPropietario(x.propietario));
}

function mapPropietarioDirecto(r: ContratoApi): Propietario | null {
  if (!r.cobraDirectoPropietarioId || !r.propiedad) return null;
  const p = r.propiedad.participaciones
    .map((x) => x.propietario)
    .find((x) => x.id === r.cobraDirectoPropietarioId);
  return p ? mapPropietario(p) : null;
}

function mapLiquidacionAdmin(
  l: NonNullable<ContratoApi['liquidaciones']>[number],
  // Fallback a la moneda del CONTRATO, no a 'ARS': una cuota de un contrato en dólares es
  // en dólares. Caer a pesos acá sería reponer el mismo bug un nivel más adentro.
  monedaContrato: Moneda,
): LiquidacionAdmin {
  const montoTotal = Number(l.montoTotal);
  const montoPagado = l.montoPagado != null ? Number(l.montoPagado) : 0;
  return {
    id: l.id,
    contratoId: l.contratoId,
    periodo: l.periodo,
    moneda: l.moneda ?? monedaContrato,
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
    propietarios: mapPropietarios(r),
    propietarioDirecto: mapPropietarioDirecto(r),
    // Liquidaciones REALES del API (con montoPagado/saldo). Antes se hardcodeaba
    // `[]` (el endpoint no las traía) → el tab "Pagos" del contrato quedaba SIEMPRE
    // vacío, aun con pagos informados o conciliados (bug 4). NO fabricamos cuotas
    // falsas: si el contrato no tiene liquidaciones, el empty state es real.
    liquidaciones: (r.liquidaciones ?? []).map((l) => mapLiquidacionAdmin(l, r.moneda)),
    // El timeline va por su propio endpoint (useEventosContrato); este campo queda para
    // el modo demo, que arma el detalle desde los mocks.
    eventos: [],
    // Comunicaciones sigue vacío: no hay registro real todavía (ver T-17/T-18).
    comunicaciones: [],
    // Para linkear a la ficha de la persona del inquilino desde el expediente.
    personaId: r.inquilinoTitular?.personaId ?? null,
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
  // Demo: acá SÍ tiene sentido cruzar contra los mocks (los ids son los del mock).
  const prpMock = propiedadesMock.find((p) => p.contratoActualId === c.id);
  const propietarios = prpMock
    ? propietariosMock.filter((o) => prpMock.propietariosIds.includes(o.id))
    : [];
  return {
    // El mock guarda la relación al revés (`Propiedad.contratoActualId`), así que el
    // contrato salía sin `propiedadId` y en demo no aparecía el link del header a la ficha
    // de la propiedad. Se deriva del cruce que ya se hizo arriba en vez de hardcodearlo en
    // `contratosMock`: un solo lugar donde vive la relación, sin dos copias que se
    // desincronicen.
    contrato: prpMock ? { ...c, propiedadId: prpMock.id } : c,
    contacto,
    propietarios,
    propietarioDirecto,
    liquidaciones: generarLiquidaciones(c.id, c.monto, c.montoExpensas ?? 0, c.moneda),
    eventos: eventosContratoMock.filter((e) => e.contratoId === id),
    comunicaciones: comunicacionesMock.filter((cm) => cm.contratoId === id),
  };
}

/**
 * Timeline del contrato (pestaña "Historial").
 *
 * Va en su PROPIA query y no dentro de `GET /contratos/:id` a propósito: esa respuesta ya
 * arrastra todas las liquidaciones del contrato y no hace falta engordarla con algo que sólo
 * se mira al abrir una pestaña.
 *
 * En demo sigue saliendo del mock. En prod salía `[]` hardcodeado porque el endpoint no
 * existía —`EventoContrato` era write-only— y la pestaña decía "Sin eventos registrados"
 * aunque la base tuviera el rastro del ajuste o la renovación.
 */
export function useEventosContrato(id: string): {
  eventos: EventoContrato[];
  cargando: boolean;
  isError: boolean;
} {
  const q = useQuery({
    // T-41 — Cuelga del contrato a propósito. Con la key vieja (`['contrato-eventos', id]`)
    // el timeline era una isla: NINGUNA mutación lo invalidaba, así que el operador ajustaba
    // el monto o renovaba, el backend escribía el evento, y el Historial seguía mostrando lo
    // de antes hasta recargar la página a mano.
    // Parchear los 8 lugares que hoy invalidan `['contrato']` habría arreglado la instancia y
    // dejado la trampa armada para el próximo hook. Colgándolo del prefijo, cualquier
    // invalidación de `['contrato']` o `['contrato', id]` lo alcanza — que es como React Query
    // matchea las keys.
    queryKey: ['contrato', id, 'eventos'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<EventoContrato[]>(`/contratos/${id}/eventos`);
    },
    enabled: apiEnabled && id.length > 0,
    staleTime: 15_000,
  });

  if (!apiEnabled) {
    return { eventos: eventosContratoMock.filter((e) => e.contratoId === id), cargando: false, isError: false };
  }
  // isError viaja para que la pestaña pueda distinguir "no hay eventos" de "no pudimos
  // traerlos": mostrar el empty state ante un error sería afirmar que no quedó registro.
  return { eventos: q.data ?? [], cargando: q.isPending, isError: q.isError };
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
