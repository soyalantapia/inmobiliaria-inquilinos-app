'use client';

/**
 * Bandeja de aprobaciones: ítems cargados por Operador / Carga que
 * quedan pendientes hasta que un Admin los apruebe o rechace.
 *
 * Pedido del feedback: "Camila carga el contrato y Roberto lo aprueba.
 * Idem con pagos manuales — Euge carga la transferencia y Roberto la
 * acepta antes de que cuente como cobrada".
 *
 * El backend real tendría una tabla `Aprobacion(id, tipo, datos JSON,
 * estado, autorId, aprobadorId, fechas)`. Acá lo manejamos en
 * localStorage como una cola simple.
 */

import { registrarEvento } from './auditoria-storage';

const STORAGE_KEY = 'llave-inmo:aprobaciones:v1';

// Nota IA: "PAGO_MANUAL" se sacó a propósito — validar/aprobar pagos vive SOLO
// en la sección Pagos (un único lugar para la plata). Aprobaciones queda para
// lo NO-monetario que carga el equipo y requiere visto + PIN.
export type TipoAprobacion =
  | 'CONTRATO_CARGADO'
  | 'GASTO_CAJA_ELIMINACION'
  | 'DEVOLUCION_DEPOSITO'
  | 'AJUSTE_FUERA_DE_INDICE';

export type EstadoAprobacion = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export interface Aprobacion {
  id: string;
  tipo: TipoAprobacion;
  /** Título visible en la bandeja. */
  titulo: string;
  /** Descripción corta para el contexto. */
  descripcion: string;
  /** Monto involucrado (si aplica). */
  monto?: number;
  /** ID de la entidad afectada (contratoId, pagoId, etc.). */
  entidadId: string;
  /** Quién cargó / pidió la aprobación. */
  cargadoPor: string;
  rolAutor: 'OPERADOR' | 'CARGA';
  cargadoAt: string;
  estado: EstadoAprobacion;
  aprobadoPor?: string;
  aprobadoAt?: string;
  comentarioAprobador?: string;
  /** Notas adicionales del autor para el aprobador. */
  notas?: string;
}

function leer(): Aprobacion[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Aprobacion[]) : SEED;
  } catch {
    return SEED;
  }
}

function guardar(lista: Aprobacion[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export function listarAprobaciones(): Aprobacion[] {
  return [...leer()].sort((a, b) => b.cargadoAt.localeCompare(a.cargadoAt));
}

export function listarPendientes(): Aprobacion[] {
  return listarAprobaciones().filter((a) => a.estado === 'PENDIENTE');
}

export function crearAprobacion(
  input: Omit<Aprobacion, 'id' | 'estado' | 'cargadoAt'>,
): Aprobacion {
  const nueva: Aprobacion = {
    ...input,
    id: `apr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    estado: 'PENDIENTE',
    cargadoAt: new Date().toISOString(),
  };
  guardar([nueva, ...leer()]);
  return nueva;
}

export function aprobar(
  id: string,
  aprobadoPor: string,
  comentario?: string,
): Aprobacion | null {
  const lista = leer();
  const idx = lista.findIndex((a) => a.id === id);
  if (idx < 0 || lista[idx]!.estado !== 'PENDIENTE') return null;
  const actualizada: Aprobacion = {
    ...lista[idx]!,
    estado: 'APROBADA',
    aprobadoPor,
    aprobadoAt: new Date().toISOString(),
    comentarioAprobador: comentario,
  };
  lista[idx] = actualizada;
  guardar(lista);
  registrarEvento({
    tipo:
      actualizada.tipo === 'CONTRATO_CARGADO'
        ? 'CONTRATO_APROBADO'
        : 'PAGO_CONCILIADO',
    autor: aprobadoPor,
    rolAutor: 'ADMIN',
    entidadId: actualizada.entidadId,
    entidadDescripcion: actualizada.titulo,
    detalle: comentario ?? `Aprobada solicitud cargada por ${actualizada.cargadoPor}`,
  });
  return actualizada;
}

export function rechazar(
  id: string,
  aprobadoPor: string,
  motivo: string,
): Aprobacion | null {
  const lista = leer();
  const idx = lista.findIndex((a) => a.id === id);
  if (idx < 0 || lista[idx]!.estado !== 'PENDIENTE') return null;
  const actualizada: Aprobacion = {
    ...lista[idx]!,
    estado: 'RECHAZADA',
    aprobadoPor,
    aprobadoAt: new Date().toISOString(),
    comentarioAprobador: motivo,
  };
  lista[idx] = actualizada;
  guardar(lista);
  registrarEvento({
    tipo:
      actualizada.tipo === 'CONTRATO_CARGADO'
        ? 'CONTRATO_RECHAZADO'
        : 'PAGO_RECHAZADO',
    autor: aprobadoPor,
    rolAutor: 'ADMIN',
    entidadId: actualizada.entidadId,
    entidadDescripcion: actualizada.titulo,
    detalle: `Rechazada — motivo: ${motivo}`,
  });
  return actualizada;
}

export const TIPO_APROBACION_LABEL: Record<TipoAprobacion, string> = {
  CONTRATO_CARGADO: 'Contrato cargado',
  GASTO_CAJA_ELIMINACION: 'Eliminar gasto de caja',
  DEVOLUCION_DEPOSITO: 'Devolver depósito',
  AJUSTE_FUERA_DE_INDICE: 'Ajuste fuera del índice',
};

/**
 * Seeds — algunas aprobaciones pendientes para que la bandeja arranque
 * con algo visible en el demo.
 */
const SEED: Aprobacion[] = [
  {
    id: 'apr_seed_1',
    tipo: 'CONTRATO_CARGADO',
    titulo: 'Tomás Bravo · Olleros 3920',
    descripcion: 'Contrato en dólares · 36 meses · cargado para revisión',
    entidadId: 'cnt_006',
    cargadoPor: 'Camila Acosta',
    rolAutor: 'CARGA',
    cargadoAt: '2026-05-22T16:18:00-03:00',
    estado: 'PENDIENTE',
    notas: 'Verificá las cláusulas 4ª y 7ª (firmadas hoy a la mañana con el propietario).',
  },
  {
    id: 'apr_seed_3',
    tipo: 'DEVOLUCION_DEPOSITO',
    titulo: 'Devolución depósito · Laura Giménez',
    descripcion: 'Cierre de contrato anticipado · contrato cnt_003',
    monto: 510000,
    entidadId: 'cnt_003',
    cargadoPor: 'Luciana Vidal',
    rolAutor: 'OPERADOR',
    cargadoAt: '2026-05-23T11:05:00-03:00',
    estado: 'PENDIENTE',
    notas: 'Acta de inspección OK · descontamos $42.000 por pintura.',
  },
];
