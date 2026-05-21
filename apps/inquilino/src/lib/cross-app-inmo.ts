'use client';

/**
 * Lectura cross-app del storage de la inmobiliaria. Las dos apps viven en
 * el mismo origen (github.io subpath o localhost dev), así que comparten
 * localStorage. Cuando el inmo asigna un profesional al reclamo, en
 * backend real esto vendría por websocket / push. En la demo lo emulamos
 * leyendo el storage del inmo y mergeando los campos del profesional.
 *
 * Solo lectura — el inquilino nunca escribe en el storage del inmo.
 */

const INMO_RECLAMOS_KEY = 'llave-inmo:reclamos:v1';
const INMO_CONCILIACION_KEY = 'llave-inmo:conciliacion:v1';

interface InmoReclamo {
  id: string;
  contratoId?: string;
  direccion?: string;
  categoria?: string;
  descripcion?: string;
  asignadoA?: string | null;
  profesionalAsignadoId?: string | null;
  profesionalAsignadoNombre?: string | null;
  profesionalAsignadoTelefono?: string | null;
  profesionalAsignadoCategoria?: string | null;
  estado?: string;
  resolucion?: string | null;
  resueltoAt?: string | null;
  clasificacion?: 'USO_Y_GOCE' | 'DESPERFECTO' | null;
  costoTrabajo?: number | null;
  costoTrabajoNotas?: string | null;
}

interface InmoPayload {
  v: 1;
  reclamos: InmoReclamo[];
}

function leerReclamosInmo(): InmoReclamo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INMO_RECLAMOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InmoPayload;
    if (parsed.v !== 1 || !Array.isArray(parsed.reclamos)) return [];
    return parsed.reclamos;
  } catch {
    return [];
  }
}

/**
 * Devuelve los datos del profesional que el inmo asignó al reclamo, o
 * null si todavía no se asignó (o el reclamo no existe del lado inmo).
 */
export function datosProfesionalDeInmo(reclamoId: string): {
  nombre: string;
  telefono: string;
  categoria: string;
} | null {
  const r = leerReclamosInmo().find((x) => x.id === reclamoId);
  if (!r?.profesionalAsignadoNombre) return null;
  return {
    nombre: r.profesionalAsignadoNombre,
    telefono: r.profesionalAsignadoTelefono ?? '',
    categoria: r.profesionalAsignadoCategoria ?? '',
  };
}

/**
 * Devuelve el operador interno (asignadoA) que tomó el reclamo del lado inmo.
 */
export function operadorDeInmo(reclamoId: string): string | null {
  const r = leerReclamosInmo().find((x) => x.id === reclamoId);
  return r?.asignadoA ?? null;
}

export interface CargoExtra {
  /** ID del reclamo origen. */
  reclamoId: string;
  /** Texto descriptivo: lo que se reparó / la categoría. */
  descripcion: string;
  /** Profesional que hizo el trabajo, si lo hay. */
  profesional: string | null;
  /** Monto que el inquilino debe pagar. */
  monto: number;
  /** Fecha en que se resolvió el reclamo. */
  fechaResolucion: string;
}

/**
 * Lista de cargos USO_Y_GOCE que el inmo definió como pagables por el
 * inquilino. Filtra por contratoId del inquilino logueado y solo trae los
 * reclamos resueltos con costo cargado.
 *
 * `incluirPagados`: por defecto false (solo trae pendientes). En `true`
 * trae todos para mostrar el histórico.
 */
export function cargosExtraDelInquilino(
  contratoId: string | null,
  opts: { incluirPagados?: boolean } = {},
): CargoExtra[] {
  if (!contratoId) return [];
  const reclamos = leerReclamosInmo();
  // Importación dinámica para no romper SSR si el módulo del inquilino
  // todavía no se hidrató.
  const pagados = leerPagadosLocal();
  return reclamos
    .filter(
      (r) =>
        r.contratoId === contratoId &&
        r.clasificacion === 'USO_Y_GOCE' &&
        typeof r.costoTrabajo === 'number' &&
        (r.costoTrabajo ?? 0) > 0 &&
        (r.estado === 'RESUELTO' || r.estado === 'CERRADO'),
    )
    .filter((r) => opts.incluirPagados || !pagados[r.id])
    .map((r) => ({
      reclamoId: r.id,
      descripcion:
        r.costoTrabajoNotas ||
        `${(r.categoria ?? 'reparación').toLowerCase()}${
          r.descripcion ? ` · ${r.descripcion.slice(0, 60)}` : ''
        }`,
      profesional: r.profesionalAsignadoNombre ?? null,
      monto: r.costoTrabajo ?? 0,
      fechaResolucion: r.resueltoAt ?? new Date().toISOString(),
    }))
    .sort((a, b) => b.fechaResolucion.localeCompare(a.fechaResolucion));
}

/** Total de cargos extra pendientes para el contrato. */
export function totalCargosExtra(contratoId: string | null): number {
  return cargosExtraDelInquilino(contratoId).reduce((s, c) => s + c.monto, 0);
}

/** Lectura local del storage de cargos pagados (mismo origen). */
function leerPagadosLocal(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('llave:cargos-pagados:v1');
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/* ============================================================
 * Conciliación de pagos (decisión del admin)
 *
 * Cuando el admin valida o rechaza un pago informado, la decisión se
 * guarda en `llave-inmo:conciliacion:v1` con `liqId` adentro. Desde
 * acá la app del inquilino puede leerla para mostrar un banner de
 * "tu pago fue rechazado" o una notif "tu pago fue confirmado".
 * ============================================================ */

export type EstadoConciliacionCrossApp = 'CONCILIADO' | 'RECHAZADO';

export interface DecisionInmoSobrePago {
  estado: EstadoConciliacionCrossApp;
  motivo: string | null;
  decidiSPor: string;
  decidiSAt: string;
}

interface AccionConciliacionCrossApp {
  pagoId: string;
  liqId: string | null;
  estado: 'INFORMADO' | 'CONCILIADO' | 'RECHAZADO';
  observacion: string | null;
  decidiSAt: string;
  decidiSPor: string;
}

function leerConciliacionInmo(): Record<string, AccionConciliacionCrossApp> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(INMO_CONCILIACION_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AccionConciliacionCrossApp>) : {};
  } catch {
    return {};
  }
}

/**
 * Devuelve la decisión del admin para una liquidación dada, o null si
 * todavía no la revisó (o el pago no se informó). Sólo expone decisiones
 * resueltas (CONCILIADO / RECHAZADO).
 */
export function decisionInmoPago(liqId: string): DecisionInmoSobrePago | null {
  const map = leerConciliacionInmo();
  for (const a of Object.values(map)) {
    if (a.liqId === liqId && (a.estado === 'CONCILIADO' || a.estado === 'RECHAZADO')) {
      return {
        estado: a.estado,
        motivo: a.observacion,
        decidiSPor: a.decidiSPor,
        decidiSAt: a.decidiSAt,
      };
    }
  }
  return null;
}
