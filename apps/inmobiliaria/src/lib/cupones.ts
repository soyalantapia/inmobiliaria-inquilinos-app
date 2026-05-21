'use client';

/**
 * Cupones de descuento por convenios con colegios profesionales o partners.
 * El admin ingresa el código en /configuracion y se aplica sobre todos los
 * planes mientras esté activo.
 *
 * En backend real esto vive en una tabla `Cupon` con FK al Convenio y
 * vigencia. Acá hay un catálogo fijo en código + el cupón activo en
 * localStorage por inmobiliaria.
 */

const STORAGE_KEY = 'llave-inmo:cupon:v1';

export type EstadoConvenio = 'ACTIVO' | 'PROXIMAMENTE' | 'CERRADO';

export interface Cupon {
  codigo: string;
  /** Convenio que respalda el cupón (CUCICBA, CPI, etc.). */
  convenio: string;
  /** % de descuento sobre el plan mensual (0-100). */
  porcentaje: number;
  /** Vigencia hasta esta fecha (ISO). null = sin vencimiento. */
  vigenciaHasta: string | null;
  /** Texto para mostrar al lado del cupón (ej. "Convenio CUCICBA"). */
  detalle: string;
  /* ============================================================
   * Metadata extra para la pantalla "Convenios" en /configuracion
   * ============================================================ */
  /** Sigla / nombre corto para el chip. */
  sigla?: string;
  /** Provincia o ámbito de cobertura. */
  cobertura?: string;
  /** Descripción larga del partnership. */
  descripcion?: string;
  /** Sitio web del colegio / partner. */
  sitioWeb?: string;
  /** Estado del convenio (ACTIVO = se puede usar, PROXIMAMENTE = en firma). */
  estado?: EstadoConvenio;
  /** Cantidad estimada de matriculados (para mostrar tamaño del partnership). */
  matriculados?: number;
  /** Beneficio textual extra ("Soporte prioritario", "Capacitaciones gratis", etc.). */
  beneficios?: string[];
}

/** Catálogo de cupones aceptados — en backend real, endpoint del partner. */
export const CUPONES_VALIDOS: Cupon[] = [
  {
    codigo: 'CUCICBA10',
    convenio: 'CUCICBA',
    sigla: 'CUCICBA',
    porcentaje: 10,
    vigenciaHasta: '2026-12-31',
    detalle: 'Convenio CUCICBA · matriculados CABA',
    cobertura: 'Ciudad de Buenos Aires',
    descripcion:
      'Colegio Único de Corredores Inmobiliarios de la Ciudad de Buenos Aires. ' +
      'Acuerdo marco para que sus matriculados accedan a la plataforma con un ' +
      'descuento permanente del 10% sobre cualquier plan.',
    sitioWeb: 'https://cucicba.com.ar',
    estado: 'ACTIVO',
    matriculados: 12500,
    beneficios: [
      '10% de descuento permanente',
      'Capacitación inicial sin cargo',
      'Soporte prioritario',
    ],
  },
  {
    codigo: 'CPI10',
    convenio: 'CPI Córdoba',
    sigla: 'CPI',
    porcentaje: 10,
    vigenciaHasta: '2026-12-31',
    detalle: 'Convenio Colegio Profesional Inmobiliario · Córdoba',
    cobertura: 'Provincia de Córdoba',
    descripcion:
      'Colegio Profesional Inmobiliario de Córdoba. Convenio activo para sus ' +
      'colegiados con beneficios en pricing y soporte localizado.',
    sitioWeb: 'https://cpicordoba.com',
    estado: 'ACTIVO',
    matriculados: 4200,
    beneficios: [
      '10% de descuento permanente',
      'Onboarding con un asesor My Alquiler',
    ],
  },
  {
    codigo: 'EDIFICA15',
    convenio: 'Edifica Córdoba',
    sigla: 'Edifica',
    porcentaje: 15,
    vigenciaHasta: '2026-12-31',
    detalle: 'Acuerdo con cámara Edifica',
    cobertura: 'Córdoba capital',
    descripcion:
      'Acuerdo especial con Edifica, cámara que reúne a las inmobiliarias más ' +
      'grandes de Córdoba capital. Descuento del 15% durante el primer año.',
    sitioWeb: 'https://edifica.com.ar',
    estado: 'ACTIVO',
    matriculados: 320,
    beneficios: [
      '15% de descuento el primer año',
      'Mesa de trabajo conjunta con producto',
    ],
  },
  {
    codigo: 'LANZAMIENTO20',
    convenio: 'Lanzamiento My Alquiler',
    sigla: 'Early',
    porcentaje: 20,
    vigenciaHasta: '2026-08-01',
    detalle: 'Primeras 50 inmobiliarias · oferta de lanzamiento',
    cobertura: 'Nacional',
    descripcion:
      'Oferta de lanzamiento para las primeras 50 inmobiliarias que se sumen al ' +
      'producto. 20% de descuento permanente y trato directo con el equipo fundador.',
    estado: 'ACTIVO',
    beneficios: [
      '20% de descuento permanente',
      'Acceso anticipado a features beta',
      'Línea directa con founders',
    ],
  },
  /* ============================================================
   * Convenios en negociación (mostrados como "Próximamente")
   * ============================================================ */
  {
    codigo: 'CMCI10',
    convenio: 'CMCI Mendoza',
    sigla: 'CMCI',
    porcentaje: 10,
    vigenciaHasta: null,
    detalle: 'Colegio de Corredores Inmobiliarios · Mendoza · firma en mayo 2026',
    cobertura: 'Provincia de Mendoza',
    descripcion:
      'Acuerdo en proceso de firma con el Colegio de Mendoza. Lanzamiento ' +
      'previsto para mayo 2026 con un descuento del 10% para matriculados.',
    estado: 'PROXIMAMENTE',
    matriculados: 1900,
    beneficios: ['10% de descuento al firmar', 'Capacitación regional'],
  },
  {
    codigo: 'CACBA15',
    convenio: 'Cámara Inmobiliaria Argentina',
    sigla: 'CIA',
    porcentaje: 15,
    vigenciaHasta: null,
    detalle: 'Cámara Inmobiliaria Argentina · acuerdo nacional',
    cobertura: 'Nacional',
    descripcion:
      'Conversaciones avanzadas con la Cámara Inmobiliaria Argentina para un ' +
      'descuento del 15% a sus asociados. Anuncio previsto para Q3 2026.',
    estado: 'PROXIMAMENTE',
    matriculados: 8500,
    beneficios: ['15% asociados CIA', 'Webinars conjuntos', 'Pricing especial multi-sociedad'],
  },
];

export interface CuponActivo {
  cupon: Cupon;
  aplicadoAt: string;
}

export function leerCuponActivo(): CuponActivo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CuponActivo) : null;
  } catch {
    return null;
  }
}

/** Busca un cupón por código (case-insensitive). */
export function buscarCupon(codigo: string): Cupon | null {
  const normalizado = codigo.trim().toUpperCase();
  return CUPONES_VALIDOS.find((c) => c.codigo === normalizado) ?? null;
}

export function aplicarCupon(codigo: string): { ok: true; cupon: Cupon } | { ok: false; error: string } {
  const cupon = buscarCupon(codigo);
  if (!cupon) {
    return { ok: false, error: 'No encontramos ese cupón. Revisá que esté bien escrito.' };
  }
  if (cupon.estado === 'PROXIMAMENTE') {
    return {
      ok: false,
      error: 'Este convenio todavía no está activo. Te avisamos cuando se firme.',
    };
  }
  if (cupon.estado === 'CERRADO') {
    return { ok: false, error: 'Este convenio cerró.' };
  }
  if (cupon.vigenciaHasta && new Date(cupon.vigenciaHasta) < new Date()) {
    return { ok: false, error: `Este cupón venció el ${cupon.vigenciaHasta}.` };
  }
  if (typeof window !== 'undefined') {
    try {
      const activo: CuponActivo = { cupon, aplicadoAt: new Date().toISOString() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activo));
    } catch {
      // ignore
    }
  }
  return { ok: true, cupon };
}

export function removerCupon(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Aplica el descuento del cupón activo al precio.
 * @param precio Precio base (mensual o anual ya con descuento de anual).
 */
export function aplicarDescuentoCupon(precio: number): {
  final: number;
  descuento: number;
  cupon: Cupon | null;
} {
  const activo = leerCuponActivo();
  if (!activo) return { final: precio, descuento: 0, cupon: null };
  const descuento = Math.round(precio * (activo.cupon.porcentaje / 100));
  return { final: precio - descuento, descuento, cupon: activo.cupon };
}
