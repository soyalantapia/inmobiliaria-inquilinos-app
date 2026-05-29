'use client';

/**
 * Anuncios masivos del lado inmobiliaria → inquilinos / propietarios /
 * consorcios. Pedido del feedback: "necesito un canal para mandar 'el
 * 15 cortan el agua del edificio Sucre 1450' o 'cambio de CBU para
 * cobranzas' a un montón de gente a la vez, sin pisarles el WhatsApp
 * personal con la misma cosa cinco veces".
 *
 * En backend real esto vive en una tabla `Anuncio` + tabla
 * `AnuncioAudienciaRecibo`. Acá guardamos el listado en localStorage
 * y los inquilinos lo leen cross-app desde su /comunicaciones.
 */

const STORAGE_KEY = 'llave-inmo:anuncios:v1';

export type AudienciaAnuncio =
  | 'TODOS_INQUILINOS'
  | 'TODOS_PROPIETARIOS'
  | 'TODOS_CONSORCIOS'
  | 'INQUILINOS_CONSORCIO'
  | 'CONTRATOS_ESPECIFICOS';

export type PrioridadAnuncio = 'NORMAL' | 'IMPORTANTE' | 'URGENTE';

export type CanalAnuncio = 'APP' | 'WHATSAPP' | 'EMAIL';

export interface Anuncio {
  id: string;
  titulo: string;
  cuerpo: string;
  prioridad: PrioridadAnuncio;
  audiencia: AudienciaAnuncio;
  /** Si la audiencia es INQUILINOS_CONSORCIO o CONTRATOS_ESPECIFICOS, IDs. */
  audienciaIds?: string[];
  canales: CanalAnuncio[];
  enviadoPor: string;
  enviadoAt: string;
  /** Para hacer match en /comunicaciones del inquilino sin desambiguar entre canales. */
  destinatariosCount: number;
  /** Si está programado a futuro. */
  programadoPara?: string;
}

function read(): Anuncio[] {
  if (typeof window === 'undefined') return SEEDS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Anuncio[]) : SEEDS;
  } catch {
    return SEEDS;
  }
}

function write(lista: Anuncio[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export function listarAnuncios(): Anuncio[] {
  return [...read()].sort((a, b) => b.enviadoAt.localeCompare(a.enviadoAt));
}

export function crearAnuncio(
  input: Omit<Anuncio, 'id' | 'enviadoAt'>,
): Anuncio {
  const nuevo: Anuncio = {
    ...input,
    id: `anu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    enviadoAt: new Date().toISOString(),
  };
  write([nuevo, ...read()]);
  return nuevo;
}

export function eliminarAnuncio(id: string): void {
  write(read().filter((a) => a.id !== id));
}

export const AUDIENCIA_LABEL: Record<AudienciaAnuncio, string> = {
  TODOS_INQUILINOS: 'Todos los inquilinos',
  TODOS_PROPIETARIOS: 'Todos los propietarios',
  TODOS_CONSORCIOS: 'Todos los consorcios',
  INQUILINOS_CONSORCIO: 'Inquilinos de un consorcio',
  CONTRATOS_ESPECIFICOS: 'Contratos específicos',
};

export const PRIORIDAD_LABEL: Record<PrioridadAnuncio, string> = {
  NORMAL: 'Normal',
  IMPORTANTE: 'Importante',
  URGENTE: 'Urgente',
};

export const PRIORIDAD_COLOR: Record<PrioridadAnuncio, string> = {
  NORMAL:
    'border-border bg-background text-foreground',
  IMPORTANTE:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200',
  URGENTE:
    'border-destructive/30 bg-destructive/5 text-destructive',
};

const SEEDS: Anuncio[] = [
  {
    id: 'anu_seed_1',
    titulo: 'Corte programado de agua · Gorriti 4521',
    cuerpo:
      'AySA confirmó que el viernes 30/05 entre 9 y 13 hs hay corte de agua en toda la cuadra. Llené el bidón el jueves a la noche y ojo con el termo.',
    prioridad: 'IMPORTANTE',
    audiencia: 'INQUILINOS_CONSORCIO',
    audienciaIds: ['cnsr_001'],
    canales: ['APP', 'WHATSAPP'],
    enviadoPor: 'Roberto Tapia',
    enviadoAt: '2026-05-21T10:00:00-03:00',
    destinatariosCount: 12,
  },
  {
    id: 'anu_seed_2',
    titulo: 'Nuevo CBU para cobranzas · vigente desde 01/06',
    cuerpo:
      'Cambiamos a Banco Galicia. CBU 0070100120000018273645 · Alias delsol.cobranzas. Por favor reemplazá el de junio en adelante para que el sistema concilie automático. Cualquier duda, WhatsApp directo a Roberto.',
    prioridad: 'IMPORTANTE',
    audiencia: 'TODOS_INQUILINOS',
    canales: ['APP', 'EMAIL'],
    // V2b-02: "Eugenia Rinaldi" no existe en el equipo. El anuncio habla de
    // Roberto en 3ª persona ("WhatsApp directo a Roberto"), así que lo firma
    // Luciana Vidal (Operadora, día a día de cobranzas).
    enviadoPor: 'Luciana Vidal',
    enviadoAt: '2026-05-15T15:30:00-03:00',
    destinatariosCount: 6,
  },
  {
    id: 'anu_seed_3',
    titulo: 'Recordatorio · vencimientos del mes',
    cuerpo:
      'Te paso a recordar que tu alquiler vence el día 5 de cada mes. Si pagás antes del 5 no se aplican punitorios. Cualquier consulta sobre el monto, escribime.',
    prioridad: 'NORMAL',
    audiencia: 'TODOS_INQUILINOS',
    canales: ['APP'],
    enviadoPor: 'Luciana Vidal',
    enviadoAt: '2026-05-02T09:15:00-03:00',
    destinatariosCount: 6,
  },
];
