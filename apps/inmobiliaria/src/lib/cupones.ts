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
}

/** Catálogo de cupones aceptados — en backend real, endpoint del partner. */
export const CUPONES_VALIDOS: Cupon[] = [
  {
    codigo: 'CUCICBA10',
    convenio: 'CUCICBA',
    porcentaje: 10,
    vigenciaHasta: '2026-12-31',
    detalle: 'Convenio CUCICBA · matriculados CABA',
  },
  {
    codigo: 'CPI10',
    convenio: 'CPI Córdoba',
    porcentaje: 10,
    vigenciaHasta: '2026-12-31',
    detalle: 'Convenio Colegio Profesional Inmobiliario · Córdoba',
  },
  {
    codigo: 'EDIFICA15',
    convenio: 'Edifica Córdoba',
    porcentaje: 15,
    vigenciaHasta: '2026-12-31',
    detalle: 'Acuerdo con cámara Edifica',
  },
  {
    codigo: 'LANZAMIENTO20',
    convenio: 'Lanzamiento My Alquiler',
    porcentaje: 20,
    vigenciaHasta: '2026-08-01',
    detalle: 'Primeras 50 inmobiliarias · oferta de lanzamiento',
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
