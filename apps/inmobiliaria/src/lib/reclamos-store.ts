'use client';

// Store de reclamos para el panel de inmobiliaria.
//
// Hidrata desde reclamosMock y persiste los cambios (asignación, estado,
// mensajes, resolución) en localStorage para que sobrevivan refreshes y
// se vea coherente cuando navega entre lista y detalle.

import { reclamosMock } from './mock-data';
import type {
  EventoReclamo,
  EstadoReclamo,
  Reclamo,
  TipoEventoReclamo,
} from './types';

const STORAGE_KEY = 'llave-inmo:reclamos:v1';

interface Payload {
  v: 1;
  reclamos: Reclamo[];
}

function read(): Reclamo[] {
  if (typeof window === 'undefined') return reclamosMock;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return reclamosMock;
    const parsed = JSON.parse(raw) as Payload;
    if (parsed.v !== 1 || !Array.isArray(parsed.reclamos)) return reclamosMock;
    return parsed.reclamos;
  } catch {
    return reclamosMock;
  }
}

function write(reclamos: Reclamo[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, reclamos } satisfies Payload),
    );
  } catch {
    // ignore
  }
}

export function listarReclamos(): Reclamo[] {
  return read();
}

export function obtenerReclamo(id: string): Reclamo | null {
  return read().find((r) => r.id === id) ?? null;
}

function appendEvento(reclamo: Reclamo, evento: Omit<EventoReclamo, 'id'>): Reclamo {
  return {
    ...reclamo,
    eventos: [
      ...reclamo.eventos,
      {
        id: `ev_${reclamo.id}_${reclamo.eventos.length + 1}`,
        ...evento,
      },
    ],
  };
}

function mutate(id: string, fn: (r: Reclamo) => Reclamo): Reclamo | null {
  const reclamos = read();
  const idx = reclamos.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const next = reclamos.map((r, i) => (i === idx ? fn(r) : r));
  write(next);
  return next[idx]!;
}

export function asignarOperador(
  id: string,
  operador: string,
  autor: string,
): Reclamo | null {
  return mutate(id, (r) => {
    const conEvento = appendEvento(r, {
      tipo: 'ASIGNADO',
      autor,
      contenido: operador,
      fecha: new Date().toISOString(),
    });
    return { ...conEvento, asignadoA: operador };
  });
}

export function cambiarEstado(
  id: string,
  nuevoEstado: EstadoReclamo,
  autor: string,
  nota: string | null = null,
): Reclamo | null {
  const tipoMap: Record<EstadoReclamo, TipoEventoReclamo> = {
    ABIERTO: 'CREADO',
    EN_CURSO: 'EN_CURSO',
    RESUELTO: 'RESUELTO',
    CERRADO: 'CERRADO',
    RECHAZADO: 'RECHAZADO',
  };
  return mutate(id, (r) => {
    const ahora = new Date().toISOString();
    const conEvento = appendEvento(r, {
      tipo: tipoMap[nuevoEstado],
      autor,
      contenido: nota,
      fecha: ahora,
    });
    return {
      ...conEvento,
      estado: nuevoEstado,
      resolucion:
        nuevoEstado === 'RESUELTO' || nuevoEstado === 'RECHAZADO' || nuevoEstado === 'CERRADO'
          ? nota
          : r.resolucion,
      resueltoAt: nuevoEstado === 'RESUELTO' ? ahora : r.resueltoAt,
    };
  });
}

export function agregarMensajeInmo(
  id: string,
  autor: string,
  contenido: string,
): Reclamo | null {
  return mutate(id, (r) =>
    appendEvento(r, {
      tipo: 'MENSAJE_INMO',
      autor,
      contenido,
      fecha: new Date().toISOString(),
    }),
  );
}

export function resetReclamosInmo(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
