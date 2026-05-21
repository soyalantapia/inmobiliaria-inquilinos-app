/**
 * Datos del dashboard interno de objetivos 2026.
 *
 * Esta info es para el equipo de My Alquiler (founders + sales + producto),
 * NO para la inmobiliaria cliente. Por eso vive bajo /admin/objetivos y se
 * marca visualmente como "panel interno".
 *
 * Los números acá son mocks coherentes con la meta semestral declarada:
 * 1331 inmobiliarias clientes y $93M ARS de MRR a los 6 meses de lanzar.
 * En producción esto sale del datawarehouse interno + Stripe/Mercado Pago.
 */

export const META_SEMESTRE = {
  /** Cantidad objetivo de inmobiliarias clientes activas. */
  clientesActivos: 1331,
  /** MRR objetivo en ARS al cierre del semestre. */
  mrrArs: 93_000_000,
  /** Mes de cierre del objetivo (YYYY-MM). */
  cierre: '2026-08',
  /** Cuándo arrancó el reloj. */
  inicio: '2026-02',
};

export interface CohortMes {
  periodo: string; // YYYY-MM
  /** Clientes nuevos que firmaron en ese mes. */
  nuevos: number;
  /** Clientes que se dieron de baja en ese mes. */
  churn: number;
  /** Acumulado al cierre del mes. */
  activos: number;
  /** MRR al cierre del mes. */
  mrr: number;
}

export const COHORTS: CohortMes[] = [
  { periodo: '2026-02', nuevos: 87, churn: 0, activos: 87, mrr: 6_525_000 },
  { periodo: '2026-03', nuevos: 168, churn: 3, activos: 252, mrr: 18_900_000 },
  { periodo: '2026-04', nuevos: 245, churn: 9, activos: 488, mrr: 36_600_000 },
  { periodo: '2026-05', nuevos: 332, churn: 16, activos: 804, mrr: 60_300_000 },
  // Junio y julio son proyección (dataset interno).
  { periodo: '2026-06', nuevos: 290, churn: 22, activos: 1072, mrr: 80_400_000 },
  { periodo: '2026-07', nuevos: 285, churn: 26, activos: 1331, mrr: 93_175_000 },
];

export interface FunnelStep {
  etapa: string;
  cantidad: number;
  /** Tasa de conversión hacia la etapa siguiente. */
  conversion: number;
}

export const FUNNEL: FunnelStep[] = [
  { etapa: 'Lead capturado', cantidad: 4820, conversion: 0.62 },
  { etapa: 'Demo agendada', cantidad: 2990, conversion: 0.71 },
  { etapa: 'Demo realizada', cantidad: 2120, conversion: 0.55 },
  { etapa: 'Onboarding iniciado', cantidad: 1170, conversion: 0.69 },
  { etapa: 'Cliente activo', cantidad: 804, conversion: 1 },
];

export interface FuenteAdquisicion {
  nombre: string;
  clientes: number;
  costoTotal: number;
}

export const FUENTES: FuenteAdquisicion[] = [
  { nombre: 'CUCICBA · evento', clientes: 142, costoTotal: 1_200_000 },
  { nombre: 'Referidos de inmos clientes', clientes: 218, costoTotal: 0 },
  { nombre: 'LinkedIn ads (gerentes inmobiliarios)', clientes: 96, costoTotal: 4_800_000 },
  { nombre: 'Instagram ads', clientes: 64, costoTotal: 1_900_000 },
  { nombre: 'Google · keywords inmo', clientes: 121, costoTotal: 5_200_000 },
  { nombre: 'CPI Córdoba · jornada', clientes: 72, costoTotal: 850_000 },
  { nombre: 'Orgánico / boca a boca', clientes: 91, costoTotal: 0 },
];

export interface UnitEconomic {
  label: string;
  valor: string;
  detalle: string;
  /** "positivo" = bueno, "negativo" = malo, "neutral" = informativo. */
  tono: 'positivo' | 'negativo' | 'neutral';
}

/**
 * Unit economics calculados sobre las cohorts. En producción esto sale
 * del datawarehouse joineando Stripe (revenue) con marketing (spend).
 */
export const UNIT_ECONOMICS: UnitEconomic[] = [
  {
    label: 'ARPU mensual',
    valor: '$75.000',
    detalle: 'Promedio ponderado por tramo de plan',
    tono: 'positivo',
  },
  {
    label: 'CAC blended',
    valor: '$17.500',
    detalle: 'Spend marketing dividido por clientes activos',
    tono: 'positivo',
  },
  {
    label: 'LTV estimado',
    valor: '$1.350.000',
    detalle: 'Asume vida media de 18 meses · churn 2.5% mensual',
    tono: 'positivo',
  },
  {
    label: 'LTV / CAC',
    valor: '77×',
    detalle: 'Saludable arriba de 3× — estamos sobrados',
    tono: 'positivo',
  },
  {
    label: 'Payback period',
    valor: '0.23 meses',
    detalle: 'Recuperás CAC con ~1 semana de uso del cliente',
    tono: 'positivo',
  },
  {
    label: 'Churn mensual',
    valor: '2.0 %',
    detalle: 'Promedio últimos 4 meses · objetivo <3%',
    tono: 'positivo',
  },
];

export interface BloqueadorObjetivo {
  prioridad: 'alta' | 'media' | 'baja';
  titulo: string;
  responsable: string;
  detalle: string;
}

export const BLOQUEADORES: BloqueadorObjetivo[] = [
  {
    prioridad: 'alta',
    titulo: 'Convenio nacional con la CIA',
    responsable: 'Ramiro',
    detalle:
      'Está en firma desde hace 3 semanas. Cerrar antes de junio para activar el descuento del 15% y desbloquear 800+ inmos asociadas.',
  },
  {
    prioridad: 'alta',
    titulo: 'Hiring · 2 reps de ventas Córdoba',
    responsable: 'Laura',
    detalle:
      'Sin SDR dedicada en Córdoba, el plan EDIFICA y CPI no se exprime. Buscar 2 reps locales con experiencia en SaaS.',
  },
  {
    prioridad: 'media',
    titulo: 'Lectura IA del comprobante en producción',
    responsable: 'Producto',
    detalle:
      'Hoy es mock. Integrar OCR (Textract o Google Vision) + LLM (Claude) para que sea real en pilotos. Cada inmo que lo prueba se queda — es el feature más diferenciador.',
  },
  {
    prioridad: 'media',
    titulo: 'NPS post-onboarding',
    responsable: 'CX',
    detalle:
      'Disparar encuesta NPS a los 30 días de activación. Usarlo para detectar churn temprano y armar caso de éxito con las inmos que dan 9-10.',
  },
];
