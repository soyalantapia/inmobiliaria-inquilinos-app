/**
 * Modo "Cliente piloto" para la beta cerrada.
 *
 * Quote de Ramiro en el meeting:
 *   "Tenemos casi nueve clientes que nosotros los tenemos que tomar
 *    como que son nueve clientes distintos y van a empezar a reportar
 *    los errores. Mientras lo tengamos nosotros, lo corregimos y no
 *    pasa nada."
 *
 * Los 9-10 clientes piloto reciben un modo especial:
 *   - Badge visible "Cliente piloto" en la topbar
 *   - Botón flotante "Reportar problema" siempre visible
 *   - Captura URL + timestamp + tipo de issue (bug / idea / pregunta)
 *   - Storage local de los reportes para que el equipo founders los
 *     levante en su próxima sesión semanal
 *
 * En producción esto va a un endpoint del backend que abre tickets
 * automático en Linear / GitHub Issues.
 */

const FLAG_KEY = 'llave-inmo:piloto-activo:v1';
const REPORTES_KEY = 'llave-inmo:piloto-reportes:v1';

export type TipoReporte = 'BUG' | 'IDEA' | 'PREGUNTA';

export interface ReportePiloto {
  id: string;
  tipo: TipoReporte;
  titulo: string;
  detalle: string;
  /** URL desde la que se reportó el issue. */
  url: string;
  /** ¿En qué pantalla estaba el usuario? (deducido de la URL). */
  pantalla: string;
  reportadoAt: string;
  /** Quién lo reportó (mock — operador actual). */
  reportadoPor: string;
}

/* ============================================================
 * Flag de "soy piloto"
 *
 * Por defecto está prendido para que la demo lo muestre. La inmo
 * puede apagarlo desde la configuración si quiere ocultar el badge
 * (raro — la idea es que se vean orgullosos del badge).
 * ============================================================ */

export function esClientePiloto(): boolean {
  if (typeof window === 'undefined') return true; // SSR fallback
  try {
    const raw = window.localStorage.getItem(FLAG_KEY);
    if (raw === null) {
      // Default: ON para que la demo arranque con el badge visible
      window.localStorage.setItem(FLAG_KEY, '1');
      return true;
    }
    return raw === '1';
  } catch {
    return true;
  }
}

export function setClientePiloto(activo: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FLAG_KEY, activo ? '1' : '0');
  } catch {
    // ignore
  }
}

/* ============================================================
 * Reportes
 * ============================================================ */

function leerReportes(): ReportePiloto[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(REPORTES_KEY);
    return raw ? (JSON.parse(raw) as ReportePiloto[]) : [];
  } catch {
    return [];
  }
}

function persistirReportes(lista: ReportePiloto[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REPORTES_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export function listarReportes(): ReportePiloto[] {
  return leerReportes();
}

export interface NuevoReporteInput {
  tipo: TipoReporte;
  titulo: string;
  detalle: string;
  url?: string;
}

export function crearReporte(input: NuevoReporteInput): ReportePiloto {
  const url =
    input.url ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const reporte: ReportePiloto = {
    id: `rep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    tipo: input.tipo,
    titulo: input.titulo.trim(),
    detalle: input.detalle.trim(),
    url,
    pantalla: pantallaDesdeUrl(url),
    reportadoAt: new Date().toISOString(),
    reportadoPor: 'Roberto Tapia', // mock — en backend usa el user logueado
  };
  const lista = leerReportes();
  lista.unshift(reporte);
  persistirReportes(lista);
  return reporte;
}

export function eliminarReporte(id: string): void {
  const lista = leerReportes().filter((r) => r.id !== id);
  persistirReportes(lista);
}

function pantallaDesdeUrl(url: string): string {
  // Mapeo simple: el primer segmento define la pantalla.
  const partes = url.split('/').filter(Boolean);
  if (partes.length === 0) return 'Home';
  const PANTALLAS: Record<string, string> = {
    propiedades: 'Propiedades',
    propietarios: 'Propietarios',
    pagos: 'Pagos',
    caja: 'Caja',
    contratos: 'Contratos',
    renovaciones: 'Renovaciones',
    consorcios: 'Consorcios',
    reclamos: 'Reclamos',
    profesionales: 'Profesionales',
    screening: 'Verificación inquilino',
    configuracion: 'Configuración',
    roadmap: 'Roadmap',
    admin: 'Panel interno',
  };
  return PANTALLAS[partes[0]!] ?? partes[0]!;
}

export const TIPO_REPORTE_LABEL: Record<TipoReporte, string> = {
  BUG: 'Bug',
  IDEA: 'Idea',
  PREGUNTA: 'Pregunta',
};

export const TIPO_REPORTE_COLOR: Record<TipoReporte, string> = {
  BUG: 'bg-destructive/10 text-destructive',
  IDEA: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  PREGUNTA: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};
