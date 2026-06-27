'use client';

import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';

export interface EventoAuditoria {
  id: string;
  tipo: string;
  autor: string;
  rolAutor: string;
  entidadDescripcion: string;
  detalle: string | null;
  fecha: string;
}

interface EventoApi {
  id: string;
  tipo: string;
  rolAutor: string;
  entidadDescripcion: string;
  detalle: string | null;
  fecha: string;
  autor: { nombre: string; apellido: string; rol: string };
}

function mapEvento(e: EventoApi): EventoAuditoria {
  return {
    id: e.id,
    tipo: e.tipo,
    autor: `${e.autor.nombre} ${e.autor.apellido}`.trim(),
    rolAutor: e.rolAutor,
    entidadDescripcion: e.entidadDescripcion,
    detalle: e.detalle ?? null,
    fecha: e.fecha,
  };
}

// Muestra para el modo demo (sin API): así la pantalla no queda vacía en la demo.
const EVENTOS_DEMO: EventoAuditoria[] = [
  { id: 'ev1', tipo: 'PAGO_CONCILIADO', autor: 'Roberto Tapia', rolAutor: 'ADMIN', entidadDescripcion: 'Pago 2026-06 · $572.000', detalle: null, fecha: '2026-06-27T14:12:00.000Z' },
  { id: 'ev2', tipo: 'PROPIETARIO_RENDIDO', autor: 'Roberto Tapia', rolAutor: 'ADMIN', entidadDescripcion: 'Rendición 2026-06 · neto $1.420.750', detalle: null, fecha: '2026-06-27T13:40:00.000Z' },
  { id: 'ev3', tipo: 'PAGO_RECHAZADO', autor: 'Camila Acosta', rolAutor: 'OPERADOR', entidadDescripcion: 'Pago 2026-06 · $90.000', detalle: 'Comprobante ilegible', fecha: '2026-06-27T11:05:00.000Z' },
  { id: 'ev4', tipo: 'EQUIPO_INVITADO', autor: 'Roberto Tapia', rolAutor: 'ADMIN', entidadDescripcion: 'Lucía Fernández (OPERADOR)', detalle: null, fecha: '2026-06-26T18:30:00.000Z' },
  { id: 'ev5', tipo: 'GASTO_CAJA_CARGADO', autor: 'Camila Acosta', rolAutor: 'CARGA', entidadDescripcion: 'Gasto PLOMERIA · $35.000 · Cambio de flexible', detalle: null, fecha: '2026-06-26T10:15:00.000Z' },
];

/**
 * Rastro de auditoría (GET /eventos). En prod trae los eventos reales del tenant;
 * en demo (!apiEnabled) muestra una muestra para que la pantalla no quede vacía.
 */
export function useEventos(): { eventos: EventoAuditoria[]; cargando: boolean; deApi: boolean } {
  const q = useQuery({
    queryKey: ['eventos'],
    queryFn: async () => {
      await ensureApiSession();
      const data = await apiFetch<EventoApi[]>('/eventos');
      return data.map(mapEvento);
    },
    enabled: apiEnabled,
    staleTime: 15_000,
  });

  if (!apiEnabled) return { eventos: EVENTOS_DEMO, cargando: false, deApi: false };
  // Prod con API caída: vacío, nunca inventamos eventos.
  if (q.isError) return { eventos: [], cargando: false, deApi: true };
  return { eventos: q.data ?? [], cargando: q.isLoading, deApi: true };
}
