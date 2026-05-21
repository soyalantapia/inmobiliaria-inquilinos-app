'use client';

/**
 * Storage de visitas confirmadas por profesionales desde el link mágico
 * /p/[token]. Lo lee el inmo cross-app para mostrar el progreso en el
 * timeline del reclamo y el estado del profesional en /profesionales.
 *
 * En backend real esto sería una mutation contra la API. Acá vive en
 * localStorage del mismo origen.
 */

const STORAGE_KEY = 'llave-prof:visitas:v1';

export interface VisitaProfesional {
  reclamoId: string;
  profesionalId: string;
  /** ISO local del horario propuesto por el profesional. */
  fechaVisita: string | null;
  /** Estado del trabajo. */
  estado: 'ASIGNADO' | 'CONFIRMADA' | 'EN_CAMINO' | 'LISTO';
  confirmadaAt: string | null;
  enCaminoAt: string | null;
  listoAt: string | null;
  /** Nota final (resolución, presupuesto, observaciones). */
  notaFinal: string | null;
  /** Monto cobrado al cerrar (lo carga el profesional). */
  montoCobrado: number | null;
}

type Payload = Record<string, VisitaProfesional>;

function read(): Payload {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Payload) : {};
  } catch {
    return {};
  }
}

function write(p: Payload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function obtenerVisita(reclamoId: string): VisitaProfesional | null {
  return read()[reclamoId] ?? null;
}

export function listarVisitasDe(profesionalId: string): VisitaProfesional[] {
  return Object.values(read()).filter((v) => v.profesionalId === profesionalId);
}

function ensure(reclamoId: string, profesionalId: string): VisitaProfesional {
  const all = read();
  const existente = all[reclamoId];
  if (existente) return existente;
  return {
    reclamoId,
    profesionalId,
    fechaVisita: null,
    estado: 'ASIGNADO',
    confirmadaAt: null,
    enCaminoAt: null,
    listoAt: null,
    notaFinal: null,
    montoCobrado: null,
  };
}

export function confirmarVisita(
  reclamoId: string,
  profesionalId: string,
  fechaISO: string,
): VisitaProfesional {
  const all = read();
  const v: VisitaProfesional = {
    ...ensure(reclamoId, profesionalId),
    fechaVisita: fechaISO,
    estado: 'CONFIRMADA',
    confirmadaAt: new Date().toISOString(),
  };
  all[reclamoId] = v;
  write(all);
  return v;
}

export function marcarEnCamino(
  reclamoId: string,
  profesionalId: string,
): VisitaProfesional {
  const all = read();
  const v: VisitaProfesional = {
    ...ensure(reclamoId, profesionalId),
    estado: 'EN_CAMINO',
    enCaminoAt: new Date().toISOString(),
  };
  all[reclamoId] = v;
  write(all);
  return v;
}

export function marcarListo(
  reclamoId: string,
  profesionalId: string,
  nota: string,
  montoCobrado: number | null = null,
): VisitaProfesional {
  const all = read();
  const v: VisitaProfesional = {
    ...ensure(reclamoId, profesionalId),
    estado: 'LISTO',
    listoAt: new Date().toISOString(),
    notaFinal: nota,
    montoCobrado,
  };
  all[reclamoId] = v;
  write(all);
  // Cross-app: además actualizamos el reclamo en el storage del inmo
  // como RESUELTO con costoTrabajo. Así el inmo no tiene que cerrar
  // manualmente y el flow continúa automático.
  cerrarReclamoEnInmo(reclamoId, nota, montoCobrado);
  return v;
}

/**
 * Actualiza el storage del inmo marcando el reclamo como RESUELTO con
 * el costo + nota del profesional. Solo escribe si el reclamo existe en
 * el storage del inmo (mismo origin, mismo localStorage).
 */
function cerrarReclamoEnInmo(
  reclamoId: string,
  nota: string,
  monto: number | null,
): void {
  if (typeof window === 'undefined') return;
  const KEY = 'llave-inmo:reclamos:v1';
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { v: number; reclamos: unknown[] };
    if (!Array.isArray(data?.reclamos)) return;
    const ahora = new Date().toISOString();
    let cambio = false;
    type RecInmo = {
      id: string;
      estado: string;
      resolucion?: string | null;
      resueltoAt?: string | null;
      costoTrabajo?: number | null;
      costoTrabajoNotas?: string | null;
      eventos?: Array<{ id: string; tipo: string; autor: string; contenido: string | null; fecha: string }>;
    };
    const nuevos = (data.reclamos as RecInmo[]).map((r) => {
      if (r.id !== reclamoId) return r;
      cambio = true;
      const eventos = Array.isArray(r.eventos) ? r.eventos : [];
      return {
        ...r,
        estado: 'RESUELTO',
        resolucion: nota,
        resueltoAt: ahora,
        costoTrabajo: monto,
        costoTrabajoNotas: nota,
        eventos: [
          ...eventos,
          {
            id: `ev_${reclamoId}_${eventos.length + 1}`,
            tipo: 'RESUELTO',
            autor: 'Profesional',
            contenido: nota,
            fecha: ahora,
          },
        ],
      };
    });
    if (cambio) {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ v: 1, reclamos: nuevos }),
      );
    }
  } catch {
    // ignore
  }
}
