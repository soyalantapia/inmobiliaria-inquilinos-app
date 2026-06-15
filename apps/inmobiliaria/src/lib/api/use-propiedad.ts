'use client';

/**
 * Detalle de una propiedad del panel desde el API real (GET /propiedades/:id),
 * con fallback al mock + overrides locales SOLO en build demo (!apiEnabled).
 *
 * Mapea la respuesta del API al shape `PropiedadEnriquecida` que ya consume la
 * pantalla (propiedad + contrato + propietarios + reclamos), más la `sociedad`
 * gestora para el hero. Así la UI no cambia: sólo cambia de dónde salen los datos.
 *
 * Notas de mapeo:
 *  - Montos del API llegan como string → Number().
 *  - Fechas ISO → .slice(0,10) donde la UI espera YYYY-MM-DD.
 *  - El endpoint de detalle no trae reclamos: en modo API la lista queda vacía
 *    (la UI ya muestra el empty state "Sin reclamos"). Sin mock en prod.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import { propiedadesMock } from '@/lib/mock-data';
import { aplicarOverride } from '@/lib/propiedades-overrides-storage';
import { enriquecerPropiedad } from '@/lib/propiedades-helpers';
import { sociedadById, sociedadPrincipal } from '@/lib/sociedades-storage';
import type {
  ContratoListado,
  EstadoContrato,
  EstadoLiquidacion,
  EstadoPropiedad,
  Moneda,
  ParticipacionPropietario,
  Propiedad,
  Propietario,
  Reclamo,
  TipoPropiedad,
} from '@/lib/types';

/** Sociedad gestora reducida que necesita el hero (nombre comercial + CUIT). */
export interface SociedadGestora {
  id: string;
  nombreComercial: string;
  cuit: string;
}

/** Lo que renderiza la pantalla: el shape de PropiedadEnriquecida + sociedad. */
export interface PropiedadDetalle {
  propiedad: Propiedad;
  contrato: ContratoListado | null;
  propietarios: Propietario[];
  reclamos: Reclamo[];
  reclamosAbiertos: number;
  sociedad: SociedadGestora;
  /**
   * Email REAL del inquilino titular (lo trae el API en
   * contratoActual.inquilinoTitular.email). null si el contrato no lo expone.
   * En prod la pantalla NO fabrica email: usa éste o oculta el botón.
   */
  inquilinoEmail: string | null;
}

/* ---------- Shapes del API (GET /propiedades/:id) ---------- */

interface PropietarioApi {
  id: string;
  nombre: string;
  apellido: string | null;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  cbuAlias: string | null;
  comisionPct: number | string | null;
  notas: string | null;
}

interface ParticipacionApi {
  propietarioId: string;
  porcentaje: number | string;
  propietario: PropietarioApi | null;
}

interface ContratoApi {
  id: string;
  inquilino: string | null;
  direccion: string | null;
  monto: number | string | null;
  moneda: Moneda;
  estado: EstadoContrato;
  fechaInicio: string | null;
  fechaFin: string | null;
  proximoVencimiento: string | null;
  estadoPagoActual: EstadoLiquidacion;
  cbuAlias?: string | null;
  titularCuenta?: string | null;
  /** Inquilino titular embebido: de acá sale el email real (sin fabricar). */
  inquilinoTitular?: { email?: string | null } | null;
}

interface SociedadApi {
  id: string;
  nombreComercial: string;
  cuit?: string | null;
}

interface PropiedadApi {
  id: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  tipo: TipoPropiedad;
  ambientes: number | string | null;
  m2: number | string | null;
  fotoUrl: string | null;
  estado: EstadoPropiedad;
  contratoActualId: string | null;
  sociedadId: string | null;
  participaciones: ParticipacionApi[];
  contratoActual: ContratoApi | null;
  contratos?: ContratoApi[];
  sociedad: SociedadApi | null;
}

/* ---------- Mappers API → tipos de pantalla ---------- */

function numOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  return Number(v);
}

function mapPropietario(p: PropietarioApi, porcentaje: number): Propietario {
  return {
    id: p.id,
    nombre: p.nombre,
    apellido: p.apellido ?? '',
    cuit: p.cuit ?? '',
    email: p.email ?? '',
    telefono: p.telefono ?? '',
    cbuAlias: p.cbuAlias ?? null,
    comisionPct: p.comisionPct != null ? Number(p.comisionPct) : 0,
    notas: p.notas ?? null,
    createdAt: '',
    // Métricas derivadas no las trae el detalle: la pantalla de detalle no
    // las usa, así que las dejamos neutras (la UI sólo lee comisionPct/datos).
    propiedadesIds: [],
    totalCobradoMes: 0,
    totalRecibirMes: 0,
  };
}

function mapContrato(c: ContratoApi): ContratoListado {
  return {
    id: c.id,
    inquilino: c.inquilino ?? '—',
    direccion: c.direccion ?? '—',
    monto: numOrNull(c.monto) ?? 0,
    moneda: c.moneda,
    estado: c.estado,
    fechaInicio: (c.fechaInicio ?? '').slice(0, 10),
    fechaFin: (c.fechaFin ?? '').slice(0, 10),
    proximoVencimiento: (c.proximoVencimiento ?? '').slice(0, 10),
    estadoPagoActual: c.estadoPagoActual,
    cbuAlias: c.cbuAlias ?? null,
    titularCuenta: c.titularCuenta ?? null,
  };
}

function mapPropiedad(p: PropiedadApi): PropiedadDetalle {
  const participaciones: ParticipacionPropietario[] = p.participaciones.map((x) => ({
    propietarioId: x.propietarioId,
    porcentaje: Number(x.porcentaje),
  }));

  const propietarios: Propietario[] = p.participaciones
    .filter((x): x is ParticipacionApi & { propietario: PropietarioApi } => x.propietario != null)
    .map((x) => mapPropietario(x.propietario, Number(x.porcentaje)));

  const propiedad: Propiedad = {
    id: p.id,
    direccion: p.direccion,
    ciudad: p.ciudad,
    provincia: p.provincia,
    tipo: p.tipo,
    ambientes: numOrNull(p.ambientes),
    m2: numOrNull(p.m2),
    fotoUrl: p.fotoUrl,
    estado: p.estado,
    propietariosIds: propietarios.map((o) => o.id),
    participaciones: participaciones.length > 0 ? participaciones : undefined,
    contratoActualId: p.contratoActualId,
    sociedadId: p.sociedadId ?? undefined,
    createdAt: '',
  };

  const contrato = p.contratoActual ? mapContrato(p.contratoActual) : null;

  const sociedad: SociedadGestora = {
    id: p.sociedad?.id ?? p.sociedadId ?? '',
    nombreComercial: p.sociedad?.nombreComercial ?? '—',
    cuit: p.sociedad?.cuit ?? '—',
  };

  // Email real del titular si el API lo trae; si no, null (la pantalla decide
  // ocultar el botón en vez de fabricar uno).
  const emailTitular = p.contratoActual?.inquilinoTitular?.email ?? null;

  return {
    propiedad,
    contrato,
    propietarios,
    // El detalle no expone reclamos: lista vacía en API (sin mock en prod).
    reclamos: [],
    reclamosAbiertos: 0,
    sociedad,
    inquilinoEmail: emailTitular,
  };
}

/* ---------- Fallback mock (solo build demo) ---------- */

function detalleMock(id: string): PropiedadDetalle | null {
  const base = propiedadesMock.find((p) => p.id === id);
  if (!base) return null;
  const propiedadActiva = aplicarOverride(base);
  const enriquecida = enriquecerPropiedad(propiedadActiva);
  const soc = sociedadById(propiedadActiva.sociedadId) ?? sociedadPrincipal();
  return {
    ...enriquecida,
    sociedad: { id: soc.id, nombreComercial: soc.nombreComercial, cuit: soc.cuit },
    // En demo la pantalla resuelve el email por contactosCobranzaMock/emailDeNombre
    // (rama !apiEnabled), así que este campo queda neutro acá.
    inquilinoEmail: null,
  };
}

/**
 * Hook de detalle de propiedad.
 * Devuelve { propiedad, cargando, deApi, noEncontrada }.
 *  - !apiEnabled  → mock + overrides locales (build demo).
 *  - apiEnabled   → GET /propiedades/:id; en error → noEncontrada (sin mock).
 */
export function usePropiedad(id: string): {
  propiedad: PropiedadDetalle | null;
  cargando: boolean;
  deApi: boolean;
  noEncontrada: boolean;
} {
  const q = useQuery({
    queryKey: ['propiedad', id],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<PropiedadApi>(`/propiedades/${id}`);
      return mapPropiedad(data);
    },
    enabled: apiEnabled && id.length > 0,
    staleTime: 30_000,
    retry: false,
  });

  if (!apiEnabled) {
    const propiedad = detalleMock(id);
    return { propiedad, cargando: false, deApi: false, noEncontrada: propiedad === null };
  }
  if (q.isError) return { propiedad: null, cargando: false, deApi: true, noEncontrada: true };
  return {
    propiedad: q.data ?? null,
    cargando: q.isPending,
    deApi: true,
    noEncontrada: false,
  };
}
