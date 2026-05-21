'use client';

/**
 * Migración masiva de propiedades vía IA.
 *
 * Idea de Camila en el meeting: "ganamos con la carga de IA, porque
 * nosotros cargamos 220 propiedades manuales". Para una inmo que ya
 * tiene cartera y quiere migrar de otra plataforma (Toco, Consorcio
 * Abierto, papel, planilla), tener que cargar 100+ contratos uno por
 * uno es el freno principal para suscribirse.
 *
 * La idea: la inmo sube su Excel / CSV / PDF (lo que sea que tenga),
 * la IA parsea + extrae las filas + arma una preview con los contratos
 * detectados, y la inmo confirma todo en bloque.
 *
 * En backend real esto va a ser:
 *  - Excel/CSV: parser local + LLM para detectar columnas.
 *  - PDF: OCR (Textract) + LLM (Claude) para extraer tablas.
 * En la demo simulamos el parseo de forma determinística según el
 * "tipo" de archivo (lo deducimos de su nombre y tamaño).
 */

export type EstadoFila = 'OK' | 'WARNING' | 'DUPLICADO';

export interface FilaMigracion {
  /** ID local sintético — sólo para keys de UI. */
  id: string;
  inquilino: string;
  dni?: string;
  direccion: string;
  monto: number;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin?: string; // YYYY-MM-DD
  indiceAjuste?: 'ICL' | 'IPC' | 'FIJO' | 'OTRO';
  propietario?: string;
  telefono?: string;
  email?: string;
  estado: EstadoFila;
  /** Si hay un issue, lo describimos acá. */
  issue?: string;
}

/* ============================================================
 * Hash determinístico → RNG
 * ============================================================ */
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)] as T;
}

/* ============================================================
 * Mock dataset
 *
 * Generamos N filas plausibles a partir del seed. El resultado es
 * determinístico — mismo file (mismo nombre + tamaño) → mismas filas.
 * ============================================================ */

const NOMBRES = [
  'Mariela Sosa',
  'Juan Pérez',
  'Ana Pereyra',
  'Carlos Romero',
  'Laura Giménez',
  'Lautaro Méndez',
  'Florencia Russo',
  'Diego Pereyra',
  'Tomás García',
  'Sofía López',
  'Federico Bravo',
  'Patricia Iglesias',
  'Roberto Tapia',
  'Carla Iribarne',
  'Mauricio Domínguez',
  'Camila Salinas',
  'Luciano Morales',
  'Antonella Fernández',
  'Hernán Castro',
  'Romina Bianchi',
];

const PROPIETARIOS = [
  'Eduardo Castro',
  'Silvana Morales',
  'Federico López Vega',
  'Patricia Iglesias',
  'Martín Bravo',
  'Inversiones del Plata SA',
  'Fideicomiso Iribarne',
  'Familia Russo',
];

const CALLES_CABA = [
  'Gorriti',
  'Av. Cabildo',
  'Jorge Newbery',
  'Honduras',
  'Salguero',
  'Olleros',
  'Av. Santa Fe',
  'Costa Rica',
  'Niceto Vega',
  'Charcas',
  'Soler',
  'Av. Córdoba',
  'Vidal',
  'Cuba',
  'Echeverría',
  'Olleros',
  'Av. Forest',
];

const INDICES = ['ICL', 'IPC', 'FIJO', 'OTRO'] as const;

function generarFila(seed: number, idx: number): FilaMigracion {
  const r = rng(seed + idx * 100003);
  const calle = pick(CALLES_CABA, r);
  const altura = 1000 + Math.floor(r() * 4000);
  const piso = Math.floor(r() * 12) + 1;
  const letra = pick(['A', 'B', 'C', 'D'], r);
  const direccion = `${calle} ${altura}, ${piso}°${letra}`;
  const monto = (350 + Math.floor(r() * 500)) * 1000; // entre 350k y 850k
  const inquilino = pick(NOMBRES, r);
  const propietario = pick(PROPIETARIOS, r);
  const dni = `${20 + Math.floor(r() * 25)}.${100 + Math.floor(r() * 800)}.${100 + Math.floor(r() * 800)}`;
  const tel = `+54 9 11 ${4000 + Math.floor(r() * 5000)} ${1000 + Math.floor(r() * 9000)}`;
  const email = inquilino.toLowerCase().replace(/[^a-z]/g, '') + '@gmail.com';

  // Fecha inicio: entre 12 y 30 meses atrás
  const ahora = new Date();
  const mesesAtras = 12 + Math.floor(r() * 18);
  const fechaInicio = new Date(ahora);
  fechaInicio.setMonth(fechaInicio.getMonth() - mesesAtras);
  const fechaFin = new Date(fechaInicio);
  fechaFin.setMonth(fechaFin.getMonth() + 36); // contratos a 36 meses

  // 80% OK, 15% warning (datos faltantes), 5% duplicados.
  const dado = r();
  let estado: EstadoFila = 'OK';
  let issue: string | undefined;
  let dniFinal: string | undefined = dni;
  let telFinal: string | undefined = tel;
  let emailFinal: string | undefined = email;

  if (dado < 0.05) {
    estado = 'DUPLICADO';
    issue = 'Esta dirección ya está cargada en tu sistema';
  } else if (dado < 0.20) {
    estado = 'WARNING';
    // Falta algún dato — eliminamos uno al azar
    const cualFalta = Math.floor(r() * 3);
    if (cualFalta === 0) {
      dniFinal = undefined;
      issue = 'Falta DNI del inquilino';
    } else if (cualFalta === 1) {
      telFinal = undefined;
      issue = 'Falta teléfono — sin WhatsApp para avisar';
    } else {
      emailFinal = undefined;
      issue = 'Falta email del inquilino';
    }
  }

  return {
    id: `mig_${(idx + 1).toString().padStart(3, '0')}`,
    inquilino,
    dni: dniFinal,
    direccion,
    monto,
    fechaInicio: fechaInicio.toISOString().slice(0, 10),
    fechaFin: fechaFin.toISOString().slice(0, 10),
    indiceAjuste: pick([...INDICES], r) as FilaMigracion['indiceAjuste'],
    propietario,
    telefono: telFinal,
    email: emailFinal,
    estado,
    issue,
  };
}

/**
 * Simula el análisis del archivo subido por la inmo. Devuelve N filas
 * detectadas. N se calcula de forma plausible según el "tamaño" del
 * archivo: 5 KB ~ 10 filas, 50 KB ~ 100 filas, 500 KB ~ 220 filas
 * (como en el caso de Camila).
 *
 * Mínimo: 8 filas para que la demo se vea. Máximo: 250 para no romper
 * el render.
 */
export function analizarArchivoMigracion(
  fileName: string,
  fileSize: number,
): FilaMigracion[] {
  const seed = hash32(`${fileName}|${fileSize}`);
  // Aproximación: 1 fila por cada ~2 KB (es lo que da un Excel real
  // con esa cantidad de info).
  const aproximado = Math.round(fileSize / 2048);
  const N = Math.min(250, Math.max(8, aproximado));
  return Array.from({ length: N }, (_, i) => generarFila(seed, i));
}

export const ESTADO_FILA_LABEL: Record<EstadoFila, string> = {
  OK: 'Lista para importar',
  WARNING: 'Revisar antes',
  DUPLICADO: 'Ya existe',
};

export const ESTADO_FILA_COLOR: Record<EstadoFila, string> = {
  OK: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  DUPLICADO: 'bg-muted text-muted-foreground',
};
