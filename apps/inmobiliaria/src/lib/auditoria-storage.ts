// Log de auditoría: cada acción sensible deja un registro de quién, qué,
// cuándo y por qué. Sirve para que el jefe pueda revisar lo que hizo cada
// usuario y tener trazabilidad legal.
//
// En backend real es una tabla `AuditLog` append-only con FK al usuario.
// Acá lo guardamos en localStorage; en producción se respaldaría en DB.

const STORAGE_KEY = 'llave-inmo:auditoria:v1';
const MAX_EVENTOS = 500; // límite para no inflar el storage

export type TipoEventoAuditoria =
  | 'PAGO_CONCILIADO'
  | 'PAGO_RECHAZADO'
  | 'PAGO_REVERTIDO'
  | 'PAGO_MANUAL_CARGADO'
  | 'CONTRATO_CARGADO'
  | 'CONTRATO_APROBADO'
  | 'CONTRATO_RECHAZADO'
  | 'PROPIEDAD_CARGADA'
  | 'GASTO_CAJA_CARGADO'
  | 'GASTO_CAJA_ELIMINADO'
  | 'RECLAMO_CLASIFICADO'
  | 'PROFESIONAL_ASIGNADO'
  | 'EQUIPO_INVITADO'
  | 'EQUIPO_REMOVIDO';

export interface EventoAuditoria {
  id: string;
  tipo: TipoEventoAuditoria;
  autor: string;
  rolAutor: string;
  entidadId: string;
  entidadDescripcion: string;
  detalle: string | null;
  fecha: string;
}

// Eventos de ejemplo para que la demo tenga historial al entrar
const SEED: EventoAuditoria[] = [
  {
    id: 'evt_seed_1',
    tipo: 'PAGO_CONCILIADO',
    autor: 'Luciana Vidal',
    rolAutor: 'OPERADOR',
    entidadId: 'pag_seed_juan_abr',
    entidadDescripcion: 'Pago de Juan Pérez · abril 2026',
    detalle: '$620.000 · Mercado Pago',
    fecha: '2026-04-10T15:32:00-03:00',
  },
  {
    id: 'evt_seed_2',
    tipo: 'CONTRATO_CARGADO',
    autor: 'Camila Acosta',
    rolAutor: 'CARGA',
    entidadId: 'cnt_007',
    entidadDescripcion: 'Consorcio Sucre 1450',
    detalle: 'Cargado como BORRADOR · pendiente aprobación',
    fecha: '2026-05-08T10:14:00-03:00',
  },
  {
    id: 'evt_seed_3',
    tipo: 'CONTRATO_APROBADO',
    autor: 'Roberto Tapia',
    rolAutor: 'ADMIN',
    entidadId: 'cnt_007',
    entidadDescripcion: 'Consorcio Sucre 1450',
    detalle: 'Revisado y aprobado',
    fecha: '2026-05-08T12:40:00-03:00',
  },
  {
    id: 'evt_seed_4',
    tipo: 'GASTO_CAJA_CARGADO',
    autor: 'Roberto Tapia',
    rolAutor: 'ADMIN',
    entidadId: 'mov_seed_1',
    entidadDescripcion: 'Plomería · Gorriti 4521',
    detalle: '$45.000 · Sergio Almeida',
    fecha: '2026-04-30T17:05:00-03:00',
  },
  {
    id: 'evt_seed_5',
    tipo: 'PROFESIONAL_ASIGNADO',
    autor: 'Roberto Tapia',
    rolAutor: 'ADMIN',
    entidadId: 'rec_006',
    entidadDescripcion: 'Reclamo de plomería · Gorriti 4521',
    detalle: 'Asignado a Sergio Almeida',
    fecha: '2026-04-28T15:05:00-03:00',
  },
];

function leer(): EventoAuditoria[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    return JSON.parse(raw) as EventoAuditoria[];
  } catch {
    return SEED;
  }
}

function guardar(lista: EventoAuditoria[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Recortamos a MAX_EVENTOS más recientes
    const recortada = lista.slice(0, MAX_EVENTOS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recortada));
  } catch {
    // ignore
  }
}

export function registrarEvento(input: {
  tipo: TipoEventoAuditoria;
  autor: string;
  rolAutor?: string;
  entidadId: string;
  entidadDescripcion: string;
  detalle?: string | null;
}): EventoAuditoria {
  const nuevo: EventoAuditoria = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    rolAutor: input.rolAutor ?? 'ADMIN',
    detalle: input.detalle ?? null,
    fecha: new Date().toISOString(),
    ...input,
  };
  guardar([nuevo, ...leer()]);
  return nuevo;
}

export function listarAuditoria(): EventoAuditoria[] {
  return [...leer()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export const tipoEventoLabel: Record<TipoEventoAuditoria, string> = {
  PAGO_CONCILIADO: 'Pago conciliado',
  PAGO_RECHAZADO: 'Pago rechazado',
  PAGO_REVERTIDO: 'Conciliación revertida',
  PAGO_MANUAL_CARGADO: 'Pago manual cargado',
  CONTRATO_CARGADO: 'Contrato cargado',
  CONTRATO_APROBADO: 'Contrato aprobado',
  CONTRATO_RECHAZADO: 'Contrato rechazado',
  PROPIEDAD_CARGADA: 'Propiedad cargada',
  GASTO_CAJA_CARGADO: 'Gasto de caja cargado',
  GASTO_CAJA_ELIMINADO: 'Gasto de caja eliminado',
  RECLAMO_CLASIFICADO: 'Reclamo clasificado',
  PROFESIONAL_ASIGNADO: 'Profesional asignado',
  EQUIPO_INVITADO: 'Miembro de equipo invitado',
  EQUIPO_REMOVIDO: 'Miembro de equipo removido',
};
