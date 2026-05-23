'use client';

// Storage de decisiones del inquilino sobre reclamos resueltos por la
// inmo/profesional. Cuando el profesional marca LISTO y la inmo lo da por
// RESUELTO, el inquilino puede:
//   - "Estoy conforme"  → ratifica el cierre.
//   - "Sigue el problema" → pide que sigan trabajando.
// Esto le da agencia al inquilino sobre su propio reclamo (antes era
// espectador) y elimina la contradicción "Abierto + Sergio listo".
//
// Persistimos solo del lado inquilino (no escribimos al storage del inmo)
// para mantener separación. El inmo lo verá cross-app cuando tengamos el
// puente inverso; por ahora, los eventos quedan en el timeline del inquilino.

const STORAGE_KEY = 'llave:reclamos-confirmados:v1';

export type DecisionInquilino = 'CONFORME' | 'PERSISTE';

interface Decision {
  estado: DecisionInquilino;
  fecha: string;
  comentario: string | null;
}

type Payload = Record<string, Decision>;

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

export function obtenerConfirmacion(reclamoId: string): Decision | null {
  return read()[reclamoId] ?? null;
}

export function marcarConforme(reclamoId: string, comentario: string | null = null): Decision {
  const decision: Decision = {
    estado: 'CONFORME',
    fecha: new Date().toISOString(),
    comentario,
  };
  const all = read();
  all[reclamoId] = decision;
  write(all);
  return decision;
}

export function marcarPersiste(reclamoId: string, comentario: string): Decision {
  const decision: Decision = {
    estado: 'PERSISTE',
    fecha: new Date().toISOString(),
    comentario,
  };
  const all = read();
  all[reclamoId] = decision;
  write(all);
  return decision;
}
