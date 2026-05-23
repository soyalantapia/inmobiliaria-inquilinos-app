/**
 * Scoring del inquilino con factores visibles — pedido del feedback:
 * "no me sirve un número solo, necesito ver POR QUÉ alguien tiene 72
 * o 91 para poder discutirlo en una asamblea o para decidir si lo
 * recibo de nuevo en otra propiedad".
 *
 * Calculamos un score 0-100 ponderado:
 *   - Puntualidad de pagos (40%): % de meses pagados en término.
 *   - Mantenimiento (15%): inverso a reclamos USO_Y_GOCE / total reclamos.
 *   - Comunicación (15%): velocidad de respuesta a mensajes del inmo.
 *   - Antigüedad (15%): años de contrato (saturado a 5 años).
 *   - Garantía (15%): puntos según el tipo (propiedad > sueldo > digital).
 *
 * El cálculo es determinístico desde mocks. En backend real esto se
 * actualiza con eventos reales y se recalcula periódicamente.
 */
import { contratosMock, generarLiquidaciones, reclamosMock } from './mock-data';
import { puntajeCargaBoletas } from './alertas-servicios';
import type { ContratoListado } from './types';

export type FactorScoring =
  | 'puntualidad'
  | 'mantenimiento'
  | 'comunicacion'
  | 'antiguedad'
  | 'garantia'
  | 'cumplimiento_boletas';

export interface FactorDetalle {
  factor: FactorScoring;
  /** Label visible. */
  label: string;
  /** Peso en el total (0-100). */
  peso: number;
  /** Puntaje obtenido (0-100). */
  puntaje: number;
  /** Aporte al score final (peso × puntaje / 100). */
  aporte: number;
  /** Frase humana explicativa. */
  explicacion: string;
}

export interface ResumenScoring {
  contratoId: string;
  inquilino: string;
  score: number;
  /** Nivel cualitativo del score. */
  nivel: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'RIESGO';
  factores: FactorDetalle[];
  /** Diferencia respecto al score del período anterior. */
  tendencia: number;
}

const PESOS: Record<FactorScoring, number> = {
  puntualidad: 35,
  cumplimiento_boletas: 15,
  mantenimiento: 12,
  comunicacion: 13,
  antiguedad: 12,
  garantia: 13,
};

const FACTOR_LABEL: Record<FactorScoring, string> = {
  puntualidad: 'Puntualidad de pagos',
  cumplimiento_boletas: 'Carga de boletas obligatorias',
  mantenimiento: 'Mantenimiento de la propiedad',
  comunicacion: 'Comunicación',
  antiguedad: 'Antigüedad como inquilino',
  garantia: 'Tipo de garantía',
};

/* PRNG determinístico (FNV+mulberry32) — para diferir scores entre
 * inquilinos sin pegarle realmente a datos reales. */
function hashContrato(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function calcularPuntualidad(contrato: ContratoListado): { puntaje: number; explicacion: string } {
  const liqs = generarLiquidaciones(contrato.id, contrato.monto);
  const total = liqs.length;
  if (total === 0) {
    return { puntaje: 70, explicacion: 'Sin historial suficiente todavía.' };
  }
  const pagadas = liqs.filter((l) => l.estado === 'PAGADO').length;
  const vencidas = liqs.filter((l) => l.estado === 'VENCIDO').length;
  const pendientes = liqs.filter((l) => l.estado === 'PENDIENTE').length;
  const pct = Math.round((pagadas / total) * 100);
  // Penalizar fuerte las VENCIDAS, levemente las PENDIENTES.
  const penalizacion = vencidas * 8 + pendientes * 3;
  const puntaje = Math.max(0, Math.min(100, pct - penalizacion + 5));
  return {
    puntaje,
    explicacion:
      vencidas > 0
        ? `${pagadas}/${total} meses pagados · ${vencidas} venc${vencidas === 1 ? 'ido' : 'idos'} pesan en el score.`
        : `${pagadas}/${total} meses pagados al día.`,
  };
}

function calcularMantenimiento(contratoId: string): { puntaje: number; explicacion: string } {
  const propios = reclamosMock.filter((r) => r.contratoId === contratoId);
  if (propios.length === 0) {
    return { puntaje: 88, explicacion: 'Sin reclamos abiertos por el inquilino — buen señal.' };
  }
  const usoYGoce = propios.filter((r) => r.estado === 'RESUELTO' || r.estado === 'EN_CURSO').length;
  const recurrentes = propios.length;
  // Pocos reclamos = buen mantenimiento. Muchos uso y goce = mal mantenimiento.
  const puntaje = Math.max(30, 95 - recurrentes * 6 - usoYGoce * 4);
  return {
    puntaje,
    explicacion: `${recurrentes} reclamo${recurrentes === 1 ? '' : 's'} históricos; los uso y goce restan.`,
  };
}

function calcularComunicacion(contratoId: string): { puntaje: number; explicacion: string } {
  const seed = hashContrato(contratoId + 'com');
  // Distribución entre 60 y 95.
  const puntaje = 60 + (seed % 36);
  const responde =
    puntaje >= 85
      ? 'Responde rápido por WhatsApp.'
      : puntaje >= 70
        ? 'Responde dentro del día.'
        : 'Suele tardar más de un día en responder.';
  return { puntaje, explicacion: responde };
}

function calcularAntiguedad(contrato: ContratoListado): { puntaje: number; explicacion: string } {
  const inicio = Date.parse(contrato.fechaInicio);
  const ahora = Date.now();
  const anios = Math.max(0, (ahora - inicio) / (365.25 * 86400_000));
  const puntaje = Math.min(100, 50 + Math.round(anios * 10));
  const texto =
    anios >= 3
      ? `${anios.toFixed(1)} años — antigüedad sólida.`
      : anios >= 1
        ? `${anios.toFixed(1)} años — relación nueva, score con tendencia a subir.`
        : 'Contrato nuevo — sin historial todavía.';
  return { puntaje, explicacion: texto };
}

function calcularGarantia(contratoId: string): { puntaje: number; explicacion: string } {
  const seed = hashContrato(contratoId + 'gar');
  const tipos: Array<{ nombre: string; puntaje: number }> = [
    { nombre: 'Propiedad (CABA) · familia directa', puntaje: 92 },
    { nombre: 'Recibo de sueldo · empleado formal', puntaje: 80 },
    { nombre: 'Garantía digital · póliza', puntaje: 70 },
    { nombre: 'Depósito triplicado · sin garantes', puntaje: 60 },
  ];
  const t = tipos[seed % tipos.length]!;
  return {
    puntaje: t.puntaje,
    explicacion: t.nombre,
  };
}

export function calcularScoringInquilino(
  contrato: ContratoListado,
): ResumenScoring {
  const pun = calcularPuntualidad(contrato);
  const mtto = calcularMantenimiento(contrato.id);
  const com = calcularComunicacion(contrato.id);
  const ant = calcularAntiguedad(contrato);
  const gar = calcularGarantia(contrato.id);
  const bol = puntajeCargaBoletas(contrato.id);

  const factores: FactorDetalle[] = [
    { factor: 'puntualidad', label: FACTOR_LABEL.puntualidad, peso: PESOS.puntualidad, puntaje: pun.puntaje, aporte: 0, explicacion: pun.explicacion },
    { factor: 'cumplimiento_boletas', label: FACTOR_LABEL.cumplimiento_boletas, peso: PESOS.cumplimiento_boletas, puntaje: bol.puntaje, aporte: 0, explicacion: bol.detalle },
    { factor: 'mantenimiento', label: FACTOR_LABEL.mantenimiento, peso: PESOS.mantenimiento, puntaje: mtto.puntaje, aporte: 0, explicacion: mtto.explicacion },
    { factor: 'comunicacion', label: FACTOR_LABEL.comunicacion, peso: PESOS.comunicacion, puntaje: com.puntaje, aporte: 0, explicacion: com.explicacion },
    { factor: 'antiguedad', label: FACTOR_LABEL.antiguedad, peso: PESOS.antiguedad, puntaje: ant.puntaje, aporte: 0, explicacion: ant.explicacion },
    { factor: 'garantia', label: FACTOR_LABEL.garantia, peso: PESOS.garantia, puntaje: gar.puntaje, aporte: 0, explicacion: gar.explicacion },
  ];

  let score = 0;
  for (const f of factores) {
    f.aporte = Math.round((f.peso * f.puntaje) / 100);
    score += f.aporte;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const nivel: ResumenScoring['nivel'] =
    score >= 85 ? 'EXCELENTE' : score >= 70 ? 'BUENO' : score >= 55 ? 'REGULAR' : 'RIESGO';

  // Tendencia simulada: hash del contrato → entre -5 y +5.
  const seedTend = hashContrato(contrato.id + 'tend');
  const tendencia = (seedTend % 11) - 5;

  return {
    contratoId: contrato.id,
    inquilino: contrato.inquilino,
    score,
    nivel,
    factores,
    tendencia,
  };
}

export const NIVEL_COLOR: Record<ResumenScoring['nivel'], string> = {
  EXCELENTE:
    'border-emerald-300/60 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-100',
  BUENO:
    'border-primary/30 bg-primary/5 text-foreground',
  REGULAR:
    'border-amber-300/60 bg-amber-50/60 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200',
  RIESGO:
    'border-destructive/40 bg-destructive/5 text-destructive',
};

export const NIVEL_LABEL: Record<ResumenScoring['nivel'], string> = {
  EXCELENTE: 'Excelente',
  BUENO: 'Bueno',
  REGULAR: 'Regular',
  RIESGO: 'Riesgo',
};

/**
 * Lista de todos los inquilinos activos con su score, ordenada
 * descendente. Útil para el screening o un ranking en /pagos.
 */
export function rankingScoring(): ResumenScoring[] {
  return contratosMock
    .filter((c) => c.estado === 'ACTIVO')
    .map(calcularScoringInquilino)
    .sort((a, b) => b.score - a.score);
}
