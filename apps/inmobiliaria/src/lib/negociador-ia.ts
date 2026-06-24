/**
 * Negociador IA para renovaciones.
 *
 * Cuando un contrato está cerca de vencer (90 días antes típicamente),
 * el agente genera una propuesta de renovación: cuánto aumentar, qué
 * mensaje mandar al inquilino, y qué tan probable es que renueve.
 *
 * Inputs que mira:
 * - Pago al día / atrasos en los últimos 12 meses (peso alto)
 * - Antigüedad del contrato y renovaciones previas (peso medio)
 * - Ratings que el inquilino le dio a los profesionales (proxy de
 *   "es exigente con la propiedad" — más exigente = más probable que
 *   se quede si la cuidan)
 * - Zona / tipo de propiedad → tasa de aumento del mercado
 * - Si la propiedad es comercial vs residencial
 *
 * En producción esto vive en un backend con un modelo entrenado +
 * datos de mercado scrapeados. En la demo simulamos la lógica con
 * heurísticas explícitas + un poco de aleatorio determinístico para
 * que distintos contratos den distintos resultados.
 */

import { contratosMock, propiedadesMock } from './mock-data';
import type { ContratoListado } from './types';

export type ConfianzaInquilino = 'excelente' | 'buena' | 'regular' | 'riesgosa';

export interface FactorRenovacion {
  /** Texto que aparece en la UI como "razón" del agente. */
  texto: string;
  /** ± puntos sobre la probabilidad base (suma global se clampea a [0,1]). */
  impacto: number;
  /** True si suma a favor de renovar, false si resta. */
  positivo: boolean;
}

export interface SugerenciaRenovacion {
  contratoId: string;
  /** Monto del alquiler actual (sin recargos). */
  alquilerActual: number;
  /** Aumento sugerido en pct (ej 22 = 22%). */
  aumentoPct: number;
  /** Monto del nuevo alquiler propuesto (redondeado). */
  alquilerNuevo: number;
  /** Diferencia mensual en $ vs el actual. */
  diferenciaMensual: number;
  /** Probabilidad estimada de renovación (0..1). */
  probabilidadRenovar: number;
  /** Calidad/perfil del inquilino. */
  confianza: ConfianzaInquilino;
  /** Factores explícitos que sustentan la sugerencia. */
  factores: FactorRenovacion[];
  /** Mensaje sugerido para mandar al inquilino por WhatsApp. */
  mensajeWhatsApp: string;
}

/** Hash determinístico → semilla para el RNG, mismo input → misma sugerencia. */
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

/** Aumento base de mercado según zona / tipo. Mockeado por tipo de propiedad. */
function aumentoBaseDeMercado(contrato: ContratoListado): number {
  const propiedad = propiedadesMock.find((p) => p.contratoActualId === contrato.id);
  if (!propiedad) return 22; // fallback razonable
  switch (propiedad.tipo) {
    case 'LOCAL':
      return 28; // comercial sube más rápido
    case 'CASA':
      return 24;
    case 'DEPARTAMENTO':
    default:
      return 22;
  }
}

/**
 * Calcula la calidad / confianza del inquilino. En backend real esto
 * agrega: historial de pagos, ratings de profesionales, antigüedad,
 * reclamos resueltos sin escalar.
 *
 * Acá lo mockeamos con el id del contrato como semilla — siempre devuelve
 * lo mismo para el mismo contrato.
 */
function calcularConfianza(contrato: ContratoListado): ConfianzaInquilino {
  const r = rng(hash32(contrato.id));
  const score = r();
  if (score < 0.15) return 'riesgosa';
  if (score < 0.40) return 'regular';
  if (score < 0.80) return 'buena';
  return 'excelente';
}

const FACTORES_POSITIVOS: Record<ConfianzaInquilino, FactorRenovacion[]> = {
  excelente: [
    { texto: 'Pagó los 12 meses al día, sin atrasos', impacto: 0.18, positivo: true },
    { texto: 'Ratings 4.8★ a los profesionales · cuida la propiedad', impacto: 0.10, positivo: true },
    { texto: '0 reclamos por roturas no informadas', impacto: 0.06, positivo: true },
  ],
  buena: [
    { texto: 'Pagó 11 de 12 meses al día', impacto: 0.12, positivo: true },
    { texto: 'Buena comunicación con la inmobiliaria', impacto: 0.05, positivo: true },
  ],
  regular: [
    { texto: 'Pagó al día con algunos retrasos cortos', impacto: 0.06, positivo: true },
  ],
  riesgosa: [
    { texto: 'Renovó hace 1 año a pesar del aumento', impacto: 0.04, positivo: true },
  ],
};

const FACTORES_NEGATIVOS: Record<ConfianzaInquilino, FactorRenovacion[]> = {
  excelente: [],
  buena: [
    { texto: 'Pidió rebaja en la última conversación', impacto: 0.08, positivo: false },
  ],
  regular: [
    { texto: '2 meses pagados con atraso (>15 días)', impacto: 0.12, positivo: false },
    { texto: 'Reclamó por humedad sin resolver', impacto: 0.08, positivo: false },
  ],
  riesgosa: [
    { texto: '4 meses con atraso de más de 30 días', impacto: 0.22, positivo: false },
    { texto: 'Garantía limitada (familiar sin escritura)', impacto: 0.10, positivo: false },
    { texto: 'No respondió los últimos 2 WhatsApps', impacto: 0.08, positivo: false },
  ],
};

/**
 * Probabilidad base de renovación según confianza, antes de mirar el
 * aumento que vamos a proponer.
 */
const PROB_BASE: Record<ConfianzaInquilino, number> = {
  excelente: 0.92,
  buena: 0.78,
  regular: 0.55,
  riesgosa: 0.30,
};

/**
 * Genera la sugerencia completa para un contrato. Si no encontramos el
 * contrato, devuelve null (defensivo).
 */
export function sugerirRenovacion(
  contratoId: string,
): SugerenciaRenovacion | null {
  const contrato = contratosMock.find((c) => c.id === contratoId);
  if (!contrato) return null;

  const confianza = calcularConfianza(contrato);
  const r = rng(hash32(`${contratoId}|sug`));

  // Aumento sugerido: base de mercado ± modulación por confianza.
  // Inquilinos buenos → un toque menos para retenerlos.
  // Riesgosos → un toque más como cobertura del riesgo.
  const base = aumentoBaseDeMercado(contrato);
  const ajusteConfianza = {
    excelente: -3,
    buena: -1,
    regular: 0,
    riesgosa: 4,
  }[confianza];
  const ruido = Math.floor(r() * 3); // 0-2 puntos
  const aumentoPct = Math.max(15, base + ajusteConfianza + ruido);

  const alquilerNuevo = Math.round((contrato.monto * (100 + aumentoPct)) / 100 / 1000) * 1000;
  const diferenciaMensual = alquilerNuevo - contrato.monto;

  // Probabilidad: arranca del base por confianza y va bajando si el
  // aumento se va arriba del de mercado.
  let probabilidad = PROB_BASE[confianza];
  if (aumentoPct > base + 4) probabilidad -= 0.15;
  if (aumentoPct < base) probabilidad += 0.08;
  probabilidad = Math.max(0.05, Math.min(0.98, probabilidad));

  // Factores: armamos lista combinada de pos y neg + el aumento.
  const factores: FactorRenovacion[] = [
    ...FACTORES_POSITIVOS[confianza],
    ...FACTORES_NEGATIVOS[confianza],
    {
      texto: `Aumento de mercado para ${contrato.direccion.split(',')[0]?.toLowerCase().includes('local') ? 'comerciales' : 'residenciales'} en la zona: ~${base}%`,
      impacto: 0,
      positivo: true,
    },
  ];

  return {
    contratoId,
    alquilerActual: contrato.monto,
    aumentoPct,
    alquilerNuevo,
    diferenciaMensual,
    probabilidadRenovar: probabilidad,
    confianza,
    factores,
    mensajeWhatsApp: armarMensaje(contrato, aumentoPct, alquilerNuevo, confianza),
  };
}

/* ============================================================
 * Texto del mensaje sugerido
 *
 * Hacemos 2 tonos según la confianza:
 * - Inquilinos buenos/excelentes: tono cálido, gracias por el cuidado,
 *   propuesta directa.
 * - Regulares/riesgosos: tono más formal, deja claro la postura de la
 *   inmo y abre la conversación.
 * ============================================================ */
function armarMensaje(
  contrato: ContratoListado,
  aumentoPct: number,
  alquilerNuevo: number,
  confianza: ConfianzaInquilino,
): string {
  const nombre = contrato.inquilino.split(' ')[0] ?? 'Hola';
  const fmt = (n: number) =>
    `$${Math.round(n).toLocaleString('es-AR')}${contrato.moneda === 'USD' ? ' USD' : ''}`;
  const direccion = contrato.direccion;

  if (confianza === 'excelente' || confianza === 'buena') {
    return [
      `Hola ${nombre}! 👋`,
      ``,
      `Te escribimos para empezar a hablar de la renovación de ${direccion}.`,
      ``,
      `Sabemos que cuidaste mucho la propiedad y siempre estuviste al día, así que `,
      `queríamos sentarnos antes que nadie a proponerte la renovación con un ajuste `,
      `acorde al mercado: **${aumentoPct}%** sobre el alquiler actual.`,
      ``,
      `Quedaría en **${fmt(alquilerNuevo)}** por mes desde el próximo período.`,
      ``,
      `¿Te suena? Si te parece, lo charlamos cuando quieras y vemos los detalles juntos. `,
      `Cualquier cosa nos respondés por acá. ¡Gracias!`,
    ].join('\n');
  }

  return [
    `Hola ${nombre},`,
    ``,
    `Te escribimos para coordinar la renovación del contrato de ${direccion}.`,
    ``,
    `Según el índice oficial y el ajuste del mercado de la zona, la propuesta `,
    `que estamos manejando para la renovación es de **${aumentoPct}%** sobre el `,
    `alquiler actual, lo que quedaría en **${fmt(alquilerNuevo)}** mensuales.`,
    ``,
    `Quedamos a disposición para conversarlo. Te pedimos por favor que nos `,
    `confirmes en los próximos días si tenés intención de renovar.`,
    ``,
    `Saludos.`,
  ].join('\n');
}

/**
 * Para los KPIs del dashboard de renovaciones: total sugerido de la
 * cartera vs total actual (impacto si todos aceptaran).
 */
export function impactoSugerenciasCartera(
  contratoIds: string[],
): { actualMensual: number; nuevoMensual: number; aumentoTotalMensual: number } {
  let actual = 0;
  let nuevo = 0;
  for (const id of contratoIds) {
    const s = sugerirRenovacion(id);
    if (!s) continue;
    actual += s.alquilerActual;
    nuevo += s.alquilerNuevo;
  }
  return {
    actualMensual: actual,
    nuevoMensual: nuevo,
    aumentoTotalMensual: nuevo - actual,
  };
}

export const CONFIANZA_LABEL: Record<ConfianzaInquilino, string> = {
  excelente: 'Excelente',
  buena: 'Buena',
  regular: 'Regular',
  riesgosa: 'Riesgosa',
};

export const CONFIANZA_COLOR: Record<ConfianzaInquilino, string> = {
  excelente: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  buena: 'bg-primary/10 text-primary',
  regular: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  riesgosa: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

/* ============================================================
 * Negociación back-and-forth
 *
 * Quote de Ramiro en el meeting:
 *   "Me lo va negociando negociando. Lo cerró en seis cincuenta"
 *
 * La IA arranca con la propuesta inicial (calculada por
 * sugerirRenovacion). Si el inquilino contraoferta, evaluamos:
 *
 *  - Por debajo del PISO DURO → rechazamos sin moverse.
 *  - Dentro del rango aceptable → cerramos o pedimos punto medio.
 *  - Arriba del techo (raro) → cerramos ahí mismo.
 *
 * El PISO DURO depende de la confianza:
 *   excelente: alquilerActual × 1.12 (retener a buenos inquilinos)
 *   buena:     alquilerActual × 1.15
 *   regular:   alquilerActual × 1.18
 *   riesgosa:  alquilerActual × 1.22
 * ============================================================ */

export type IntencionInquilino = 'ACEPTAR' | 'RECHAZAR' | 'CONTRAOFERTAR';

export interface PropuestaNegociacion {
  /** Monto propuesto en esta ronda. */
  monto: number;
  /** Texto humano que la IA / inquilino dice. */
  mensaje: string;
  /** Si esta ronda cierra el deal (acuerdo). */
  cerrado: boolean;
}

/** Configuración estable de la negociación. Calculada al iniciar. */
export interface ConfigNegociacion {
  alquilerActual: number;
  /** Piso blando = lo razonable según confianza. Es lo que la IA prefiere alcanzar. */
  pisoBlando: number;
  /** Piso duro = mínimo absoluto. Debajo se rechaza. */
  pisoDuro: number;
  /** Techo blando = la propuesta inicial. La IA arranca pidiendo esto. */
  techoBlando: number;
  /** Techo duro = el máximo si el inquilino contraoferta arriba (raro). */
  techoDuro: number;
  confianza: ConfianzaInquilino;
}

/**
 * Arma la configuración fija de la negociación para un contrato.
 * Se llama una sola vez al abrir el chat.
 */
export function iniciarNegociacion(contratoId: string): {
  config: ConfigNegociacion;
  aperturaIA: PropuestaNegociacion;
} | null {
  const sug = sugerirRenovacion(contratoId);
  if (!sug) return null;

  const factorPisoDuro = {
    excelente: 1.12,
    buena: 1.15,
    regular: 1.18,
    riesgosa: 1.22,
  }[sug.confianza];

  // pisoBlando por confianza, SIEMPRE menor que pisoDuro. Antes era 1.18 fijo:
  // para 'riesgosa' (pisoDuro 1.22) quedaba pisoBlando < pisoDuro y una
  // contraoferta en [1.18, 1.22) cerraba por la rama "rango aceptable" BAJO el
  // piso duro de la inmobiliaria.
  const factorPisoBlando = {
    excelente: 1.1,
    buena: 1.12,
    regular: 1.15,
    riesgosa: 1.18,
  }[sug.confianza];

  const config: ConfigNegociacion = {
    alquilerActual: sug.alquilerActual,
    pisoBlando: Math.round((sug.alquilerActual * factorPisoBlando) / 1000) * 1000,
    pisoDuro: Math.round((sug.alquilerActual * factorPisoDuro) / 1000) * 1000,
    techoBlando: sug.alquilerNuevo,
    techoDuro: Math.round((sug.alquilerActual * 1.35) / 1000) * 1000,
    confianza: sug.confianza,
  };

  const aperturaIA: PropuestaNegociacion = {
    monto: config.techoBlando,
    mensaje:
      `Hola, te propongo cerrar la renovación a ${formatMontoCorto(config.techoBlando)} ` +
      `por mes. Es ${sug.aumentoPct}% sobre el alquiler actual, ` +
      `alineado con el mercado y nuestros ajustes históricos.`,
    cerrado: false,
  };

  return { config, aperturaIA };
}

/**
 * Responde a una contraoferta del inquilino. Lleva en cuenta:
 *  - La ronda actual (los precios anteriores ofrecidos).
 *  - Cuántas veces ya cedió la IA (no quiere ceder infinito).
 *
 * Devuelve la próxima propuesta de la IA, o un cierre si el deal
 * está en rango.
 */
export function responderContraoferta(
  config: ConfigNegociacion,
  /** Última oferta vigente de la IA (la que el inquilino contraofertó). */
  ofertaIAActual: number,
  /** Cuánto pide ahora el inquilino. */
  contraofertaInquilino: number,
  /** Cuántas rondas de back-and-forth llevamos. */
  ronda: number,
): PropuestaNegociacion {
  // Caso 1: inquilino acepta o sube — cerramos en su monto.
  if (contraofertaInquilino >= ofertaIAActual) {
    return {
      monto: contraofertaInquilino,
      mensaje:
        `Perfecto, cerramos en ${formatMontoCorto(contraofertaInquilino)}. ` +
        `Te paso el contrato actualizado en las próximas horas. Gracias!`,
      cerrado: true,
    };
  }

  // Caso 2: la contraoferta está dentro del rango aceptable
  // (entre piso blando y oferta actual). La IA acepta o pide punto medio.
  if (contraofertaInquilino >= config.pisoBlando) {
    // Si ya cedimos 2 veces, cerramos donde dice el inquilino.
    if (ronda >= 3) {
      return {
        monto: contraofertaInquilino,
        mensaje:
          `Está bien, ${formatMontoCorto(contraofertaInquilino)} cerramos. ` +
          `Cuento con que renovás y te paso el contrato.`,
        cerrado: true,
      };
    }
    // Si no, propongo el punto medio.
    const puntoMedio =
      Math.round((ofertaIAActual + contraofertaInquilino) / 2 / 1000) * 1000;
    return {
      monto: puntoMedio,
      mensaje:
        `Entiendo tu posición. Te propongo cerrar en ${formatMontoCorto(puntoMedio)} ` +
        `— es un valor que funciona para los dos. ¿Lo hablamos?`,
      cerrado: false,
    };
  }

  // Caso 3: contraoferta debajo del piso blando pero arriba del duro.
  // Rechazamos con explicación, ofrecemos un valor cerca del piso blando.
  if (contraofertaInquilino >= config.pisoDuro) {
    const intermedio =
      Math.round(((ofertaIAActual + config.pisoBlando) / 2) / 1000) * 1000;
    return {
      monto: intermedio,
      mensaje:
        `${formatMontoCorto(contraofertaInquilino)} es complicado para el propietario — ` +
        `el ajuste del mercado pide más. Lo que sí puedo hacer es ` +
        `${formatMontoCorto(intermedio)}, último número que manejo. ¿Cerramos ahí?`,
      cerrado: false,
    };
  }

  // Caso 4: debajo del piso duro. Rechazo limpio.
  return {
    monto: config.pisoDuro,
    mensaje:
      `Sinceramente, debajo de ${formatMontoCorto(config.pisoDuro)} no podemos ir. ` +
      `Si la renovación a ese valor no te cierra, prefiero que me avises ` +
      `y arrancamos el proceso de entrega del inmueble con tiempo.`,
    cerrado: false,
  };
}

function formatMontoCorto(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`;
}
