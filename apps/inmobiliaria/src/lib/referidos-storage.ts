'use client';

/**
 * Programa de referidos para la inmobiliaria.
 *
 * Cada inmo tiene un código único (DEL-SOL-A7K2 por ejemplo) que puede
 * compartir con colegas. Cuando un colega se da de alta usando ese
 * código:
 *   - el invitado arranca con 1 mes gratis,
 *   - la inmo que refirió suma 1 mes gratis a su próxima factura.
 *
 * Acumulable hasta el tope del plan. En el demo dejamos el estado
 * persistido localmente con un par de invitaciones seed para que la
 * UI tenga algo visible desde el primer render.
 *
 * En backend real esto vive en `Inmobiliaria.codigoReferido` +
 * `Referido` (FK), con sus contadores y descuentos aplicados.
 */

const STORAGE_KEY = 'llave-inmo:referidos:v1';

export type EstadoReferido = 'INVITADO' | 'REGISTRADO' | 'ACTIVO' | 'CHURN';

export interface Referido {
  id: string;
  nombre: string;
  /** Email al que se mandó la invitación. */
  email: string;
  /** Sociedad / inmobiliaria del colega referido. */
  inmobiliaria?: string;
  estado: EstadoReferido;
  invitadoAt: string;
  /** Cuando se registró en el producto. null si todavía no. */
  registradoAt: string | null;
  /** Cuando empezó a operar. null si todavía no. */
  activoDesde: string | null;
}

export interface ReferidosState {
  /** Código único de la inmo logueada (estable, no cambia). */
  codigo: string;
  /** Referidos disparados por la inmo. */
  referidos: Referido[];
  /** Meses gratis acumulados por referidos activos. */
  mesesGratisGanados: number;
}

const SEED: ReferidosState = {
  codigo: 'DEL-SOL-A7K2',
  referidos: [
    {
      id: 'ref_001',
      nombre: 'Lautaro Méndez',
      email: 'lautaro@mendezprop.com.ar',
      inmobiliaria: 'Méndez Propiedades',
      estado: 'ACTIVO',
      invitadoAt: '2026-03-04',
      registradoAt: '2026-03-08',
      activoDesde: '2026-03-15',
    },
    {
      id: 'ref_002',
      nombre: 'Florencia Russo',
      email: 'frusso@florrussocia.com',
      inmobiliaria: 'Russo & Cía',
      estado: 'ACTIVO',
      invitadoAt: '2026-03-22',
      registradoAt: '2026-04-01',
      activoDesde: '2026-04-12',
    },
    {
      id: 'ref_003',
      nombre: 'Diego Pereyra',
      email: 'diego.pereyra@palermohome.com',
      inmobiliaria: 'Palermo Home',
      estado: 'REGISTRADO',
      invitadoAt: '2026-05-02',
      registradoAt: '2026-05-08',
      activoDesde: null,
    },
    {
      id: 'ref_004',
      nombre: 'Carla Iribarne',
      email: 'carla@iribarne.com.ar',
      estado: 'INVITADO',
      invitadoAt: '2026-05-14',
      registradoAt: null,
      activoDesde: null,
    },
  ],
  mesesGratisGanados: 2,
};

function leer(): ReferidosState {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return SEED;
    }
    return JSON.parse(raw) as ReferidosState;
  } catch {
    return SEED;
  }
}

function persistir(state: ReferidosState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function leerReferidos(): ReferidosState {
  return leer();
}

/** Agrega una invitación nueva. */
export function invitarColega(input: {
  nombre: string;
  email: string;
  inmobiliaria?: string;
}): Referido {
  const state = leer();
  const referido: Referido = {
    id: `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    nombre: input.nombre.trim(),
    email: input.email.trim().toLowerCase(),
    inmobiliaria: input.inmobiliaria?.trim() || undefined,
    estado: 'INVITADO',
    invitadoAt: new Date().toISOString(),
    registradoAt: null,
    activoDesde: null,
  };
  state.referidos.unshift(referido);
  persistir(state);
  return referido;
}

/** Cancela una invitación pendiente. */
export function cancelarInvitacion(id: string): void {
  const state = leer();
  state.referidos = state.referidos.filter((r) => r.id !== id);
  persistir(state);
}

/**
 * Métricas resumen para los KPIs.
 *  - activos: ya facturan = generan meses gratis acumulados.
 *  - pendientes: invitados pero no se registraron todavía.
 */
export function resumenReferidos(): {
  total: number;
  activos: number;
  registrados: number;
  invitados: number;
  mesesGratisGanados: number;
  /** Próxima recompensa: con cuántos invitados más sumás un mes extra. */
  paraProximoMes: number;
} {
  const state = leer();
  const activos = state.referidos.filter((r) => r.estado === 'ACTIVO').length;
  const registrados = state.referidos.filter((r) => r.estado === 'REGISTRADO').length;
  const invitados = state.referidos.filter((r) => r.estado === 'INVITADO').length;
  return {
    total: state.referidos.length,
    activos,
    registrados,
    invitados,
    mesesGratisGanados: state.mesesGratisGanados,
    paraProximoMes: 1, // mock: con cada nuevo activo, +1 mes gratis
  };
}

export const ESTADO_REFERIDO_LABEL: Record<EstadoReferido, string> = {
  INVITADO: 'Invitado',
  REGISTRADO: 'Registrado',
  ACTIVO: 'Activo · cobrando',
  CHURN: 'Se dio de baja',
};

export const ESTADO_REFERIDO_COLOR: Record<EstadoReferido, string> = {
  INVITADO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  REGISTRADO: 'bg-primary/10 text-primary',
  ACTIVO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  CHURN: 'bg-muted text-muted-foreground',
};

/**
 * Genera la URL de invitación con el código embebido.
 * En backend real esto va a un dominio con un parser.
 */
export function urlInvitacion(codigo: string): string {
  if (typeof window === 'undefined') {
    return `https://myalquiler.com.ar/invitacion/${codigo}`;
  }
  // Demo: link con el origin actual para que funcione local + producción.
  return `${window.location.origin}/?ref=${codigo}`;
}

/** Texto sugerido para mandar por WhatsApp / email. */
export function mensajeInvitacion(codigo: string): string {
  const url = urlInvitacion(codigo);
  return [
    `¡Hola! 👋`,
    ``,
    `Te quería recomendar My Alquiler, la plataforma que estoy usando para `,
    `administrar mi cartera. Centraliza todo (cobranzas, contratos, reclamos, `,
    `rendiciones a propietarios) y se integra con ARCA para facturar automático.`,
    ``,
    `Si te sumás con mi código tenés 1 mes gratis para probar sin compromiso:`,
    ``,
    `${url}`,
    ``,
    `Código: ${codigo}`,
    ``,
    `Cualquier cosa avisame.`,
  ].join('\n');
}
