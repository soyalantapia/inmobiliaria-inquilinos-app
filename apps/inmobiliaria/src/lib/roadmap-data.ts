/**
 * Roadmap público de My Alquiler — lo que viene en los próximos 12 meses.
 *
 * Quote de Ramiro en el meeting:
 *   "Después empezamos a cobrar servicios extra y que de acá doce
 *    meses (cubre más cosas)"
 *
 * Esta data se muestra en /configuracion → Roadmap y en una variante
 * pública en /roadmap. Idea: crear expectativa, mostrar la visión y
 * que los pilotos voten qué priorizar.
 */

export type EstadoRoadmap =
  | 'ENVIO' // recientemente publicado
  | 'EN_DESARROLLO' // entra próximo release
  | 'PROXIMO_TRIMESTRE'
  | 'EXPLORANDO'; // idea con investigación pero sin fecha

export type CategoriaRoadmap =
  | 'COBRANZAS'
  | 'CONTRATOS'
  | 'CONSORCIOS'
  | 'INTEGRACIONES'
  | 'IA'
  | 'MULTI_PAIS'
  | 'EXPERIENCIA';

export interface ItemRoadmap {
  id: string;
  titulo: string;
  resumen: string;
  detalle?: string;
  categoria: CategoriaRoadmap;
  estado: EstadoRoadmap;
  /** Trimestre estimado en formato YYYY-Q (ej "2026-Q3"). null = sin fecha. */
  trimestreObjetivo: string | null;
  /** Si el ítem es un "+ servicio extra" se cobra aparte (mencionado por Ramiro). */
  cobrosAparte?: boolean;
  /** Cantidad de pilotos que pidieron este item (señal de demanda). */
  pedidoPor: number;
}

export const ROADMAP: ItemRoadmap[] = [
  /* ============================================================
   * Recién publicado (últimos 30 días)
   * ============================================================ */
  {
    id: 'rm_certificado',
    titulo: 'Certificado de inquilino verificable',
    resumen:
      'El inquilino al día genera un PDF firmado con su historial. ' +
      'Sirve como reemplazo del garante en la próxima mudanza.',
    categoria: 'EXPERIENCIA',
    estado: 'ENVIO',
    trimestreObjetivo: '2026-Q2',
    pedidoPor: 14,
  },
  {
    id: 'rm_negociador_chat',
    titulo: 'Negociador IA back-and-forth en renovaciones',
    resumen:
      'La IA negocia el aumento turn-by-turn con el inquilino dentro ' +
      'del rango que vos definís. Cierra cuando ambos acuerdan.',
    categoria: 'IA',
    estado: 'ENVIO',
    trimestreObjetivo: '2026-Q2',
    pedidoPor: 9,
  },
  {
    id: 'rm_migracion_masiva',
    titulo: 'Migración masiva de cartera con IA',
    resumen:
      'Subís el Excel/CSV/PDF que tenías de tu sistema viejo y ' +
      'la IA importa todos los contratos en bloque.',
    categoria: 'EXPERIENCIA',
    estado: 'ENVIO',
    trimestreObjetivo: '2026-Q2',
    pedidoPor: 22,
  },

  /* ============================================================
   * En desarrollo (entran en el próximo release · 6-8 semanas)
   * ============================================================ */
  {
    id: 'rm_screening_avanzado',
    titulo: 'Verificación de inquilino con IA',
    resumen:
      'Subís el DNI + recibo de sueldo + datos del garante y la IA ' +
      'corre todos los chequeos (Veraz, BCRA, antecedentes) y devuelve ' +
      'un score en 60 segundos.',
    detalle: 'Reemplaza las 4 herramientas que hoy uno usa por separado.',
    categoria: 'IA',
    estado: 'EN_DESARROLLO',
    trimestreObjetivo: '2026-Q3',
    cobrosAparte: true,
    pedidoPor: 31,
  },
  {
    id: 'rm_firma_digital_contratos',
    titulo: 'Firma digital de contratos integrada',
    resumen:
      'Generás el contrato desde un template, lo enviás al inquilino y ' +
      'al garante. Ellos firman desde el celular sin imprimir nada.',
    detalle:
      'Validez legal con AFIP (firma electrónica con token). Quedan ' +
      'almacenados con timestamp y hash inmutable.',
    categoria: 'CONTRATOS',
    estado: 'EN_DESARROLLO',
    trimestreObjetivo: '2026-Q3',
    pedidoPor: 28,
  },
  {
    id: 'rm_lectura_comprobante_real',
    titulo: 'Lectura IA del comprobante en producción',
    resumen:
      'Hoy es mock determinístico. Pasamos a OCR + Claude para que ' +
      'lea cualquier comprobante real (Galicia, Mercado Pago, transferencia ' +
      'manual escaneada).',
    categoria: 'IA',
    estado: 'EN_DESARROLLO',
    trimestreObjetivo: '2026-Q3',
    pedidoPor: 18,
  },

  /* ============================================================
   * Próximo trimestre (Q4 2026 · 3-5 meses)
   * ============================================================ */
  {
    id: 'rm_app_propietario',
    titulo: 'App nativa para propietarios',
    resumen:
      'PWA dedicada para que cada propietario vea en vivo su cartera: ' +
      'cobranzas del mes, rendiciones, gastos atribuidos, próximos ajustes.',
    detalle: 'Hoy el propietario ve todo por mail o WhatsApp; queremos darle un panel.',
    categoria: 'EXPERIENCIA',
    estado: 'PROXIMO_TRIMESTRE',
    trimestreObjetivo: '2026-Q4',
    pedidoPor: 41,
  },
  {
    id: 'rm_mercado_pago',
    titulo: 'Integración con Mercado Pago',
    resumen:
      'Botón de pago dentro de la app del inquilino con tarjeta o saldo ' +
      'de MP. Auto-validación del pago en tiempo real (sin esperar el resumen).',
    categoria: 'INTEGRACIONES',
    estado: 'PROXIMO_TRIMESTRE',
    trimestreObjetivo: '2026-Q4',
    pedidoPor: 35,
  },
  {
    id: 'rm_caucion_digital',
    titulo: 'Caución digital integrada',
    resumen:
      'Acuerdos con aseguradoras (Cobertura SUMA, Provincia, otros) para ' +
      'emitir la garantía digital directo desde la app, sin papelería.',
    categoria: 'INTEGRACIONES',
    estado: 'PROXIMO_TRIMESTRE',
    trimestreObjetivo: '2026-Q4',
    cobrosAparte: true,
    pedidoPor: 19,
  },
  {
    id: 'rm_modulo_legales',
    titulo: 'Módulo legales: intimaciones + juicios',
    resumen:
      'Templates de carta documento, seguimiento de juicios por desalojo, ' +
      'fechas clave del proceso. Pensado para estudios jurídicos asociados.',
    categoria: 'CONTRATOS',
    estado: 'PROXIMO_TRIMESTRE',
    trimestreObjetivo: '2026-Q4',
    cobrosAparte: true,
    pedidoPor: 12,
  },

  /* ============================================================
   * Explorando (Q1+ 2027 · sin fecha aún)
   * ============================================================ */
  {
    id: 'rm_multipais',
    titulo: 'Internacionalización · Uruguay + Brasil',
    resumen:
      'Adaptación del producto para administradores de Uruguay y Brasil. ' +
      'Multi-moneda, multi-índice de ajuste, normas locales de contrato.',
    detalle:
      'Argentina seguramente nos quede chico de acá a 18 meses. Ramiro ' +
      'ya tiene contactos en Uruguay y Paraguay.',
    categoria: 'MULTI_PAIS',
    estado: 'EXPLORANDO',
    trimestreObjetivo: null,
    pedidoPor: 6,
  },
  {
    id: 'rm_voicebot_cobranzas',
    titulo: 'Voicebot de cobranzas',
    resumen:
      'Llamada automatizada con voz natural cuando un inquilino se atrasa ' +
      'más de 5 días. Conversa, busca acuerdo de fecha de pago, registra ' +
      'el compromiso.',
    categoria: 'IA',
    estado: 'EXPLORANDO',
    trimestreObjetivo: null,
    cobrosAparte: true,
    pedidoPor: 8,
  },
  {
    id: 'rm_marketplace_inmuebles',
    titulo: 'Marketplace de inmuebles entre inmos asociadas',
    resumen:
      'Las inmos que están en My Alquiler pueden compartir inmuebles ' +
      'disponibles entre sí (un inmo CABA tiene cliente, otro inmo Mar ' +
      'del Plata tiene casa libre — se hace el match dentro del sistema).',
    categoria: 'EXPERIENCIA',
    estado: 'EXPLORANDO',
    trimestreObjetivo: null,
    pedidoPor: 5,
  },
];

export const ESTADO_LABEL: Record<EstadoRoadmap, string> = {
  ENVIO: 'Recién enviado',
  EN_DESARROLLO: 'En desarrollo',
  PROXIMO_TRIMESTRE: 'Próximo trimestre',
  EXPLORANDO: 'Explorando',
};

export const ESTADO_COLOR: Record<EstadoRoadmap, string> = {
  ENVIO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  EN_DESARROLLO: 'bg-primary/10 text-primary',
  PROXIMO_TRIMESTRE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  EXPLORANDO: 'bg-muted text-muted-foreground',
};

export const CATEGORIA_LABEL: Record<CategoriaRoadmap, string> = {
  COBRANZAS: 'Cobranzas',
  CONTRATOS: 'Contratos',
  CONSORCIOS: 'Consorcios',
  INTEGRACIONES: 'Integraciones',
  IA: 'IA',
  MULTI_PAIS: 'Multi-país',
  EXPERIENCIA: 'Experiencia',
};
