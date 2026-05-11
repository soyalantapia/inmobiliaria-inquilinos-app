'use client';

// Storage local de reclamos del inquilino.
//
// - Hidrata desde misReclamosMock la primera vez.
// - Persiste creaciones y mensajes nuevos.
// - Cuando exista el backend reemplazamos los helpers por fetch al API.
//
// El estado del backend (asignación, cambios de estado, resolución, mensajes
// del operador) llega push o por polling. Acá lo simulamos con los mocks ya
// hidratados y dejamos las mutaciones limpias.

import { misReclamosMock } from './mock-data';
import type { Categoria, EventoReclamo, Reclamo, Urgencia } from './types';

const STORAGE_KEY = 'llave:reclamos:v1';

interface Payload {
  v: 1;
  reclamos: Reclamo[];
}

function read(): Reclamo[] {
  if (typeof window === 'undefined') return misReclamosMock;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return misReclamosMock;
    const parsed = JSON.parse(raw) as Payload;
    if (parsed.v !== 1 || !Array.isArray(parsed.reclamos)) return misReclamosMock;
    return parsed.reclamos;
  } catch {
    return misReclamosMock;
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
    // ignore (Sentry lo agarra después)
  }
}

export function listarReclamos(): Reclamo[] {
  return [...read()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function obtenerReclamo(id: string): Reclamo | null {
  return read().find((r) => r.id === id) ?? null;
}

export interface CrearReclamoInput {
  inquilino: string;
  contratoId: string;
  direccion: string;
  categoria: Categoria;
  descripcion: string;
  urgencia: Urgencia;
  fotoDataUrl?: string | null;
}

export function crearReclamo(input: CrearReclamoInput): Reclamo {
  const ahora = new Date().toISOString();
  const id = `rec_${Date.now().toString(36)}`;
  const nuevo: Reclamo = {
    id,
    contratoId: input.contratoId,
    inquilino: input.inquilino,
    direccion: input.direccion,
    categoria: input.categoria,
    descripcion: input.descripcion,
    urgencia: input.urgencia,
    estado: 'ABIERTO',
    asignadoA: null,
    fotoUrl: input.fotoDataUrl ?? null,
    resolucion: null,
    createdAt: ahora,
    resueltoAt: null,
    eventos: [
      {
        id: `ev_${id}_1`,
        tipo: 'CREADO',
        autor: input.inquilino,
        contenido: null,
        fecha: ahora,
      },
    ],
  };
  const next = [nuevo, ...read()];
  write(next);
  return nuevo;
}

export function agregarMensajeDelInquilino(
  reclamoId: string,
  inquilinoNombre: string,
  contenido: string,
): Reclamo | null {
  const reclamos = read();
  const idx = reclamos.findIndex((r) => r.id === reclamoId);
  if (idx === -1) return null;
  const ahora = new Date().toISOString();
  const evento: EventoReclamo = {
    id: `ev_${reclamoId}_${reclamos[idx]!.eventos.length + 1}`,
    tipo: 'MENSAJE_INQUILINO',
    autor: inquilinoNombre,
    contenido,
    fecha: ahora,
  };
  const updated: Reclamo = {
    ...reclamos[idx]!,
    eventos: [...reclamos[idx]!.eventos, evento],
  };
  const next = reclamos.map((r, i) => (i === idx ? updated : r));
  write(next);
  return updated;
}

export function reiniciarReclamos(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
