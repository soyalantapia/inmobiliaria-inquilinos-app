'use client';

/**
 * Detalle de un propietario desde el API real (GET /propietarios/:id), con sus
 * participaciones (propiedad + contrato actual embebidos), config ARCA y cuenta
 * de cobranza directa. Fallback al mock SOLO en build demo (!apiEnabled). En
 * prod, si el API falla, devolvemos null/[] (no inventamos data).
 *
 * Mapea al tipo Propietario que renderiza la pantalla más las colecciones
 * derivadas (propiedades + contratos) que las cards de detalle necesitan.
 * Métricas (totalCobradoMes/totalRecibirMes) quedan en 0: el endpoint de
 * detalle no trae liquidaciones pagadas, así que no las inventamos.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import {
  contratosMock,
  propiedadesMock,
  propietariosMock,
} from '@/lib/mock-data';
import { aplicarOverride } from '@/lib/propietarios-overrides-storage';
import type {
  ContratoListado,
  EstadoContrato,
  EstadoPropiedad,
  Moneda,
  Propiedad,
  Propietario,
  TipoPropiedad,
} from '@/lib/types';

// ===== Forma cruda del API =====

interface ContratoActualApi {
  id: string;
  estado: string;
  monto: string | number;
  moneda: string;
  fechaInicio: string;
  fechaFin: string;
  inquilinoTitular?: { id: string; nombre: string; apellido: string | null } | null;
}

interface PropiedadEmbebidaApi {
  id: string;
  direccion: string;
  ciudad?: string;
  provincia?: string;
  tipo?: string;
  ambientes?: number | null;
  m2?: number | null;
  fotoUrl?: string | null;
  estado: string;
  contratoActualId: string | null;
  sociedadId?: string | null;
  contratoActual?: ContratoActualApi | null;
}

interface ParticipacionApi {
  propiedadId: string;
  porcentaje: number;
  propiedad: PropiedadEmbebidaApi | null;
}

interface ArcaApi {
  conectado: boolean;
  condicionFiscal?: 'MONOTRIBUTO' | 'RESPONSABLE_INSCRIPTO' | 'EXENTO' | null;
  puntoVenta?: string | null;
  tipoComprobante?: 'FACTURA_C' | 'FACTURA_A' | 'FACTURA_B' | 'RECIBO_C' | null;
  conectadoDesde?: string | null;
}

interface CuentaCobranzaApi {
  banco: string;
  titular: string;
  cbu: string;
  alias: string;
  cuit?: string | null;
}

interface PropietarioDetalleApi {
  id: string;
  nombre: string;
  apellido: string | null;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  cbuAlias: string | null;
  comisionPct: number | null;
  notas: string | null;
  createdAt: string;
  participaciones: ParticipacionApi[];
  arca?: ArcaApi | null;
  cuentaCobranza?: CuentaCobranzaApi | null;
}

export interface PropietarioDetalle {
  propietario: Propietario;
  propiedades: Propiedad[];
  contratos: ContratoListado[];
}

// El enum de Prisma tiene más tipos que los 4 que renderiza el panel; los
// no contemplados los coercionamos para no romper lookups por record.
function coerceTipo(t: string | undefined): TipoPropiedad {
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

function mapContratoActual(c: ContratoActualApi, direccion: string): ContratoListado {
  return {
    id: c.id,
    inquilino: c.inquilinoTitular
      ? `${c.inquilinoTitular.nombre} ${c.inquilinoTitular.apellido ?? ''}`.trim()
      : '—',
    direccion,
    monto: Number(c.monto),
    moneda: c.moneda as Moneda,
    estado: c.estado as EstadoContrato,
    fechaInicio: (c.fechaInicio ?? '').slice(0, 10),
    fechaFin: (c.fechaFin ?? '').slice(0, 10),
    proximoVencimiento: (c.fechaFin ?? '').slice(0, 10),
    estadoPagoActual: 'PENDIENTE',
  };
}

function mapDetalle(d: PropietarioDetalleApi): PropietarioDetalle {
  const participaciones = d.participaciones ?? [];

  const propiedades: Propiedad[] = participaciones
    .map((part) => part.propiedad)
    .filter((p): p is PropiedadEmbebidaApi => p != null)
    .map((p) => ({
      id: p.id,
      direccion: p.direccion,
      ciudad: p.ciudad ?? '',
      provincia: p.provincia ?? '',
      tipo: coerceTipo(p.tipo),
      ambientes: p.ambientes ?? null,
      m2: p.m2 ?? null,
      fotoUrl: p.fotoUrl ?? null,
      estado: p.estado as EstadoPropiedad,
      propietariosIds: [d.id],
      contratoActualId: p.contratoActualId,
      ...(p.sociedadId ? { sociedadId: p.sociedadId } : {}),
      createdAt: '',
    }));

  const contratos: ContratoListado[] = participaciones
    .map((part) => part.propiedad)
    .filter((p): p is PropiedadEmbebidaApi => p?.contratoActual != null)
    .map((p) => mapContratoActual(p.contratoActual as ContratoActualApi, p.direccion));

  // Mensual esperado según los contratos ACTIVOS embebidos (canon × % de
  // participación). El endpoint no trae liquidaciones pagadas, pero el canon
  // vigente SÍ viene: alcanza para mostrar "cuánto le entra por mes" en vez de
  // un '—' o $0 que hacía ver la ficha vacía. Es un estimado (no descuenta mora).
  const comisionPct = d.comisionPct ?? 0;
  let brutoMensual = 0;
  for (const part of participaciones) {
    const c = part.propiedad?.contratoActual;
    if (!c) continue;
    const canon = Number(c.monto) || 0;
    brutoMensual += (canon * (Number(part.porcentaje) || 0)) / 100;
  }
  const recibirMensual = brutoMensual * (1 - comisionPct / 100);

  const propietario: Propietario = {
    id: d.id,
    nombre: d.nombre,
    apellido: d.apellido ?? '',
    cuit: d.cuit ?? '',
    email: d.email ?? '',
    telefono: d.telefono ?? '',
    cbuAlias: d.cbuAlias,
    comisionPct: d.comisionPct ?? 0,
    notas: d.notas,
    createdAt: (d.createdAt ?? '').slice(0, 10),
    propiedadesIds: participaciones.map((part) => part.propiedadId),
    // Mensual esperado según canon vigente (ver arriba). Si no hay contratos
    // activos queda en 0 → la ficha muestra '—' (correcto: sin alquiler no hay ingreso).
    totalCobradoMes: brutoMensual,
    totalRecibirMes: recibirMensual,
    ...(d.arca
      ? {
          afip: {
            conectado: d.arca.conectado,
            ...(d.arca.condicionFiscal ? { condicionFiscal: d.arca.condicionFiscal } : {}),
            ...(d.arca.puntoVenta ? { puntoVenta: d.arca.puntoVenta } : {}),
            ...(d.arca.tipoComprobante ? { tipoComprobante: d.arca.tipoComprobante } : {}),
            ...(d.arca.conectadoDesde ? { conectadoDesde: d.arca.conectadoDesde.slice(0, 10) } : {}),
          },
        }
      : {}),
    ...(d.cuentaCobranza
      ? {
          cuentaCobranza: {
            banco: d.cuentaCobranza.banco,
            titular: d.cuentaCobranza.titular,
            cbu: d.cuentaCobranza.cbu,
            alias: d.cuentaCobranza.alias,
            cuit: d.cuentaCobranza.cuit ?? '',
          },
        }
      : {}),
  };

  return { propietario, propiedades, contratos };
}

// ===== Fallback mock (build demo / !apiEnabled) =====

function detalleMock(id: string): PropietarioDetalle | null {
  const base = propietariosMock.find((p) => p.id === id);
  if (!base) return null;
  // Aplica los overrides de localStorage (CBU/cuenta de cobranza editados en demo),
  // igual que use-propiedad.ts — sin esto, guardar la cuenta no se reflejaba nunca.
  const propietario = aplicarOverride(base);
  const propiedades = propiedadesMock.filter((p) => propietario.propiedadesIds.includes(p.id));
  const contratos = contratosMock.filter((c) =>
    propiedades.some((p) => p.contratoActualId === c.id),
  );
  return { propietario, propiedades, contratos };
}

export function usePropietario(id: string): {
  detalle: PropietarioDetalle | null;
  cargando: boolean;
  deApi: boolean;
} {
  const q = useQuery({
    queryKey: ['propietario', id],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<PropietarioDetalleApi>(`/propietarios/${id}`);
      return mapDetalle(data);
    },
    enabled: apiEnabled && id.length > 0,
    staleTime: 15_000,
  });

  if (!apiEnabled) return { detalle: detalleMock(id), cargando: false, deApi: false };
  // API caído o 404 en prod: null sin mock (no inventamos data).
  if (q.isError) return { detalle: null, cargando: false, deApi: true };
  return { detalle: q.data ?? null, cargando: q.isPending, deApi: true };
}
