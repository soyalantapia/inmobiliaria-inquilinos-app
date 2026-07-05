'use client';

/**
 * Pagos informados (bandeja "A resolver") del panel desde el API real:
 *   GET  /pagos                 → comprobantes que el inquilino informó
 *   POST /pagos/:id/validar     → confirma (concilia) el pago
 *   POST /pagos/:id/rechazar    → rechaza con observación
 *
 * Mapea la fila del API al tipo `PagoInformado` que ya renderiza
 * `pagos-por-validar.tsx`, así la UI no cambia de forma. Fallback al mock
 * (`pagosInformadosMock` + estado de localStorage) solo en build demo
 * (!apiEnabled). Las dos mutaciones exigen PIN: lo valida el server.
 */
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, apiEnabled, apiFetch, getToken } from './client';
import { ensureApiSession } from './session';
import { pagosInformadosMock, type PagoInformado } from '@/lib/mock-data';
import { estadoDePago } from '@/lib/conciliacion-storage';

// Shape de cada pago que devuelve GET /pagos (handler en apps/api/src/routes/plata.ts).
interface PagoApi {
  id: string;
  contratoId: string;
  periodo: string;
  tipo: 'TOTAL' | 'PARCIAL';
  monto: string | number;
  montoLiqTotal: string | number | null;
  metodo: PagoInformado['metodo'];
  nroOperacion: string | null;
  fechaTransferencia: string;
  informadoAt: string;
  comprobanteUrl: string | null;
  notaInquilino: string | null;
  estado: 'INFORMADO' | 'CONCILIADO' | 'RECHAZADO';
  observacion: string | null;
  contrato: {
    id: string;
    // Cobranza directa: el validador necesita saber que la plata fue a la
    // cuenta del DUEÑO (no a la de la inmo) para no rechazar pagos legítimos.
    modoCobranza?: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO' | null;
    cobraDirectoPropietario?: { nombre: string; apellido: string | null } | null;
    propiedad: { direccion: string } | null;
    inquilinoTitular: { nombre: string; apellido: string | null } | null;
  } | null;
  liquidacion: {
    id: string;
    periodo: string;
    // montoTotal es el TOTAL EXIGIBLE (base + mora al día); montoPagado la suma
    // de conciliados; saldo = max(0, montoTotal − montoPagado). OJO: el saldo NO
    // descuenta el pago INFORMADO de esta fila (solo conciliados).
    montoTotal: string | number;
    montoPunitorio?: string | number | null;
    montoPagado?: string | number | null;
    saldo?: string | number | null;
    estado: string;
  } | null;
}

/**
 * Fila de la bandeja en modo API: el `PagoInformado` que ya renderiza la UI
 * más los datos REALES de la liquidación (saldo/mora del server) y el modo de
 * cobranza del contrato. Todos opcionales → una fila del mock demo también
 * satisface este tipo (la UI comparte el componente entre modos).
 */
export interface PagoInformadoApi extends PagoInformado {
  /** Estado fresco de la liquidación según el server (solo modo API). */
  liq?: {
    /** Total exigible: base + mora al día. */
    montoTotal: number;
    montoPunitorio: number;
    /** Suma de pagos ya CONCILIADOS (no incluye este pago INFORMADO). */
    montoPagado: number;
    /** max(0, montoTotal − montoPagado). */
    saldo: number;
  };
  modoCobranza?: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO';
  /** Nombre del dueño que cobra directo (solo PROPIETARIO_DIRECTO). */
  cobraDirectoNombre?: string;
}

/**
 * URL abrible del comprobante. En prod el API guarda un path `/uploads/<tenant>/…`
 * que hay que (a) hacer absoluto contra el API (el panel vive en otro dominio) y
 * (b) firmar con `?token`, porque un `<a>`/`<img>` no manda el header Authorization.
 * En demo el comprobante es un dataUrl base64 → se devuelve tal cual.
 */
function urlComprobante(raw: string | null): string {
  if (!raw) return '';
  if (raw.startsWith('/uploads/')) {
    const token = getToken();
    return `${API_URL}${raw}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }
  return raw;
}

function mapPago(p: PagoApi): PagoInformadoApi {
  const inquilino = p.contrato?.inquilinoTitular
    ? `${p.contrato.inquilinoTitular.nombre} ${p.contrato.inquilinoTitular.apellido ?? ''}`.trim()
    : '—';
  const directo = p.contrato?.cobraDirectoPropietario;
  return {
    id: p.id,
    contratoId: p.contratoId,
    inquilino,
    direccion: p.contrato?.propiedad?.direccion ?? '—',
    periodo: p.periodo,
    monto: Number(p.monto),
    tipo: p.tipo,
    montoLiqTotal: p.montoLiqTotal != null ? Number(p.montoLiqTotal) : undefined,
    metodo: p.metodo,
    fechaTransferencia: p.fechaTransferencia,
    informadoAt: p.informadoAt,
    comprobanteUrl: urlComprobante(p.comprobanteUrl),
    notaInquilino: p.notaInquilino,
    liquidacionId: p.liquidacion?.id ?? '',
    // Saldo REAL de la liquidación (base + mora al día − conciliados). Antes el
    // panel lo calculaba contra mocks (los ids reales nunca matcheaban) → mostraba
    // deuda fantasma ignorando parciales ya conciliados y la mora.
    ...(p.liquidacion && p.liquidacion.saldo != null
      ? {
          liq: {
            montoTotal: Number(p.liquidacion.montoTotal),
            montoPunitorio: Number(p.liquidacion.montoPunitorio ?? 0),
            montoPagado: Number(p.liquidacion.montoPagado ?? 0),
            saldo: Number(p.liquidacion.saldo),
          },
        }
      : {}),
    ...(p.contrato?.modoCobranza ? { modoCobranza: p.contrato.modoCobranza } : {}),
    ...(directo
      ? { cobraDirectoNombre: `${directo.nombre} ${directo.apellido ?? ''}`.trim() }
      : {}),
  };
}

export interface UsePagosInformados {
  /** Comprobantes informados pendientes de validar (estado INFORMADO). */
  pagos: PagoInformadoApi[];
  cargando: boolean;
  /** La query falló (red/permiso): pagos=[] NO significa "bandeja vacía".
   *  La UI debe mostrar error + reintento en vez del empty-state (falso vacío). */
  isError: boolean;
  /** Reintenta la carga (invalidate → refetch de la key de la bandeja). */
  reintentar: () => void;
  /** true cuando los datos vienen del API real (no del mock demo). */
  deApi: boolean;
  /** Confirma (concilia) un pago. Exige PIN — lo valida el server.
   *  Lanza ApiError si el server rechaza (PIN inválido, ya decidido, etc.). */
  validar: (id: string, pin: string) => Promise<void>;
  /** Rechaza un pago con motivo (mínimo 5 caracteres, lo valida el server). */
  rechazar: (id: string, motivo: string, pin: string) => Promise<void>;
}

/**
 * Cuenta — sin abrir el componente — cuántos comprobantes hay esperando
 * validación. La usa /pagos para el contador "A resolver" en prod.
 * En demo cae al mock + estado de localStorage.
 */
export function useAResolverCount(): {
  count: number;
  deApi: boolean;
  cargando: boolean;
  /** Con la query caída el count es 0 FALSO: el caller muestra '—', no un cero. */
  isError: boolean;
} {
  const { pagos, cargando, deApi, isError } = usePagosInformados();
  if (!deApi) {
    const count = pagosInformadosMock.filter((p) => estadoDePago(p.id) === 'INFORMADO').length;
    return { count, deApi: false, cargando: false, isError: false };
  }
  return { count: pagos.length, deApi: true, cargando, isError };
}

export function usePagosInformados(): UsePagosInformados {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['pagos', 'informados'],
    queryFn: async () => {
      await ensureApiSession();
      // estado=INFORMADO: solo los que están esperando decisión del admin.
      const data = await apiFetch<PagoApi[]>('/pagos?estado=INFORMADO');
      return data.map(mapPago);
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['pagos'] });
    // Conciliar/rechazar mueve la liquidación a PAGADO/PARCIAL y cambia la cartera.
    void qc.invalidateQueries({ queryKey: ['liquidaciones'] });
    void qc.invalidateQueries({ queryKey: ['contratos'] });
    // Detalle de contrato (['contrato', id]): sin esto el tab Pagos quedaba stale
    // tras validar/rechazar y "no impactaba" hasta recargar (bug 4).
    void qc.invalidateQueries({ queryKey: ['contrato'] });
  };

  // Fallback demo: el componente que consume esto ya lee mock + localStorage
  // por su cuenta cuando deApi=false. Igual exponemos las acciones gateadas.
  const demo = useMemo<UsePagosInformados>(
    () => ({
      pagos: pagosInformadosMock.filter((p) => estadoDePago(p.id) === 'INFORMADO'),
      cargando: false,
      isError: false,
      reintentar: () => {
        /* en demo la fuente es local: no hay nada que reintentar */
      },
      deApi: false,
      validar: async () => {
        /* en demo el componente concilia vía conciliacion-storage */
      },
      rechazar: async () => {
        /* en demo el componente rechaza vía conciliacion-storage */
      },
    }),
    [],
  );

  if (!apiEnabled) return demo;

  return {
    pagos: q.isError ? [] : (q.data ?? []),
    cargando: q.isPending,
    isError: q.isError,
    // invalidate (no refetch directo): resetea el estado de error de la query y
    // dispara el fetch para todos los componentes montados sobre la misma key.
    reintentar: () => void qc.invalidateQueries({ queryKey: ['pagos', 'informados'] }),
    deApi: true,
    validar: async (id, pin) => {
      await apiFetch(`/pagos/${id}/validar`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      invalidar();
    },
    rechazar: async (id, motivo, pin) => {
      await apiFetch(`/pagos/${id}/rechazar`, {
        method: 'POST',
        body: JSON.stringify({ pin, observacion: motivo }),
      });
      invalidar();
    },
  };
}

export interface UsePagosConciliados {
  /** Pagos ya conciliados (recientes), para poder anular uno. */
  pagos: PagoInformadoApi[];
  cargando: boolean;
  /** La query falló: pagos=[] no significa "sin conciliados" (falso vacío). */
  isError: boolean;
  /** Reintenta la carga (invalidate → refetch de la key de conciliados). */
  reintentar: () => void;
  deApi: boolean;
  /** Anula (revierte) un pago conciliado con motivo (mín. 5) + PIN. El server
   *  recomputa la liquidación (vuelve a PARCIAL/PENDIENTE/VENCIDO). */
  anular: (id: string, motivo: string, pin: string) => Promise<void>;
}

/**
 * Pagos ya CONCILIADOS: la bandeja para ANULAR un cobro cargado por error o cuya
 * transferencia rebotó. GET /pagos?estado=CONCILIADO + POST /pagos/:id/anular.
 * Sólo prod (en demo el flujo de revertir vive en conciliacion-storage).
 */
export function usePagosConciliados(): UsePagosConciliados {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['pagos', 'conciliados'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<PagoApi[]>('/pagos?estado=CONCILIADO');
      return data.map(mapPago);
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  if (!apiEnabled) {
    return {
      pagos: [],
      cargando: false,
      isError: false,
      reintentar: () => {},
      deApi: false,
      anular: async () => {},
    };
  }
  return {
    pagos: q.isError ? [] : (q.data ?? []),
    cargando: q.isPending,
    isError: q.isError,
    reintentar: () => void qc.invalidateQueries({ queryKey: ['pagos', 'conciliados'] }),
    deApi: true,
    anular: async (id, motivo, pin) => {
      await apiFetch(`/pagos/${id}/anular`, {
        method: 'POST',
        body: JSON.stringify({ pin, observacion: motivo }),
      });
      void qc.invalidateQueries({ queryKey: ['pagos'] });
      void qc.invalidateQueries({ queryKey: ['liquidaciones'] });
      void qc.invalidateQueries({ queryKey: ['contratos'] });
      void qc.invalidateQueries({ queryKey: ['contrato'] });
    },
  };
}

export interface DevengoResultado {
  contratosProcesados: number;
  liquidacionesNuevas: number;
}

/**
 * Devenga (top-up) las liquidaciones de meses futuros de los contratos ACTIVO:
 *   POST /liquidaciones/devengar
 * computarLiquidacionesContrato genera hasta "el mes que viene"; sin un disparo
 * periódico un contrato se queda sin liquidaciones a partir del 2º mes. Es
 * IDEMPOTENTE en el server (skipDuplicates) → se puede llamar cuantas veces se
 * quiera. Hoy lo dispara un botón del panel; mañana un cron pega al mismo
 * endpoint. Solo prod (en demo no hay backend que devengar).
 */
export interface CierreCajaItem {
  id: string;
  inquilino: string;
  direccion: string;
  periodo: string;
  monto: number;
  moneda: string;
  comision: number;
  metodo: string;
  hora: string;
}
export interface CierreMoneda {
  moneda: string;
  cobrado: number;
  comision: number;
  cantidad: number;
}
export interface CierreCaja {
  fecha: string;
  cobrado: number;
  comision: number;
  cantidad: number;
  /** Cobrado/comisión por moneda. El total plano de arriba sólo es correcto con
   *  una sola moneda; con multiMoneda el front usa este desglose. */
  multiMoneda: boolean;
  porMoneda: CierreMoneda[];
  pagos: CierreCajaItem[];
}

/**
 * Cierre de caja del día: lo cobrado (pagos conciliados) + la comisión de la
 * inmobiliaria sobre el alquiler. GET /caja/cierre?fecha=YYYY-MM-DD (default hoy,
 * en hora de Argentina). Solo prod (en demo no hay backend de cobranzas).
 */
export function useCierreCaja(fecha?: string): {
  cierre: CierreCaja | null;
  cargando: boolean;
  disponible: boolean;
} {
  const q = useQuery({
    queryKey: ['caja', 'cierre', fecha ?? 'hoy'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<CierreCaja>(`/caja/cierre${fecha ? `?fecha=${fecha}` : ''}`);
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });
  return { cierre: q.isError ? null : (q.data ?? null), cargando: q.isPending, disponible: apiEnabled };
}

export function useDevengar(): { devengar: () => Promise<DevengoResultado>; disponible: boolean } {
  const qc = useQueryClient();
  return {
    disponible: apiEnabled,
    devengar: async () => {
      const r = await apiFetch<DevengoResultado>('/liquidaciones/devengar', { method: 'POST' });
      // El top-up cambia liquidaciones (y por ende la cartera/cobranza derivada).
      void qc.invalidateQueries({ queryKey: ['liquidaciones'] });
      void qc.invalidateQueries({ queryKey: ['contratos'] });
      void qc.invalidateQueries({ queryKey: ['propiedades'] });
      return r;
    },
  };
}
