'use client';

/**
 * Cargos USO_Y_GOCE pendientes / cobrados a inquilinos. Cruza dos fuentes:
 *  1. `reclamos-store`: reclamos resueltos con clasificacion USO_Y_GOCE y
 *     costoTrabajo cargado.
 *  2. `llave:cargos-pagados:v1` (cross-app del inquilino): cuáles ya pagó.
 */

import { listarReclamos } from './reclamos-store';
import type { Reclamo } from './types';

const PAGADOS_KEY = 'llave:cargos-pagados:v1';

interface PagadoEntry {
  reclamoId: string;
  monto: number;
  pagadoAt: string;
  metodo?: string;
}

function leerPagados(): Record<string, PagadoEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PAGADOS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PagadoEntry>) : {};
  } catch {
    return {};
  }
}

export interface CargoACobrar {
  reclamoId: string;
  inquilino: string;
  direccion: string;
  descripcion: string;
  profesional: string | null;
  monto: number;
  fechaResolucion: string;
  estado: 'PENDIENTE' | 'COBRADO';
  pagadoAt: string | null;
}

function mapearReclamo(r: Reclamo, pagado: PagadoEntry | undefined): CargoACobrar {
  return {
    reclamoId: r.id,
    inquilino: r.inquilino,
    direccion: r.direccion,
    descripcion:
      r.costoTrabajoNotas ||
      `${r.categoria.toLowerCase()}${r.descripcion ? ` · ${r.descripcion.slice(0, 60)}` : ''}`,
    profesional: r.profesionalAsignadoNombre ?? null,
    monto: r.costoTrabajo ?? 0,
    fechaResolucion: r.resueltoAt ?? r.createdAt,
    estado: pagado ? 'COBRADO' : 'PENDIENTE',
    pagadoAt: pagado?.pagadoAt ?? null,
  };
}

/**
 * Devuelve todos los cargos USO_Y_GOCE generados, con su estado de cobro.
 */
export function listarCargosACobrar(): CargoACobrar[] {
  const pagados = leerPagados();
  return listarReclamos()
    .filter(
      (r) =>
        r.clasificacion === 'USO_Y_GOCE' &&
        typeof r.costoTrabajo === 'number' &&
        (r.costoTrabajo ?? 0) > 0 &&
        (r.estado === 'RESUELTO' || r.estado === 'CERRADO'),
    )
    .map((r) => mapearReclamo(r, pagados[r.id]))
    .sort((a, b) => {
      // Pendientes primero
      if (a.estado !== b.estado) return a.estado === 'PENDIENTE' ? -1 : 1;
      return b.fechaResolucion.localeCompare(a.fechaResolucion);
    });
}

/** Total pendiente y cobrado del mes en curso. */
export function totalesCargosMes(): {
  pendiente: number;
  cobrado: number;
  cantPendientes: number;
  cantCobrados: number;
} {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const cargos = listarCargosACobrar().filter((c) =>
    c.fechaResolucion.startsWith(yearMonth),
  );
  return {
    pendiente: cargos.filter((c) => c.estado === 'PENDIENTE').reduce((s, c) => s + c.monto, 0),
    cobrado: cargos.filter((c) => c.estado === 'COBRADO').reduce((s, c) => s + c.monto, 0),
    cantPendientes: cargos.filter((c) => c.estado === 'PENDIENTE').length,
    cantCobrados: cargos.filter((c) => c.estado === 'COBRADO').length,
  };
}
