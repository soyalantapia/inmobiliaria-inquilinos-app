// Pricing y plan de la inmobiliaria.
//
// La inmo paga 2 planes en paralelo (uno por cada vertical que opere):
//   1. Plan Alquileres — por cantidad de propiedades en cartera.
//   2. Plan Consorcios — por cantidad de unidades funcionales (UF)
//      bajo administración. Es ~40% más barato por unidad porque el
//      ticket promedio de un consorcio es menor que el de un alquiler
//      (idea de Ramiro: "consorcios más baratos, jugamos con una
//      bonificación").
//
// Si la inmo no administra consorcios, ese plan no aparece en la
// factura. Si administra los dos, se suman.

import { consorciosMock } from './consorcios-storage';
import { propiedadesMock } from './mock-data';

export interface TramoPlan {
  /** Slug interno. */
  key: 'STARTER' | 'GROWTH' | 'PRO' | 'ENTERPRISE';
  /** Nombre comercial. */
  nombre: string;
  /** Cota inferior de propiedades (inclusive). */
  desde: number;
  /** Cota superior de propiedades (inclusive). null = sin tope. */
  hasta: number | null;
  /** Precio fijo mensual en ARS. */
  precio: number;
  /** Texto que se muestra en la card del plan. */
  rango: string;
}

/** Tabla de tramos del pricing comercial. */
export const TRAMOS_PLAN: TramoPlan[] = [
  {
    key: 'STARTER',
    nombre: 'Starter',
    desde: 0,
    hasta: 10,
    precio: 50_000,
    rango: 'Hasta 10 propiedades',
  },
  {
    key: 'GROWTH',
    nombre: 'Growth',
    desde: 11,
    hasta: 50,
    precio: 100_000,
    rango: 'Hasta 50 propiedades',
  },
  {
    key: 'PRO',
    nombre: 'Pro',
    desde: 51,
    hasta: 100,
    precio: 200_000,
    rango: 'Hasta 100 propiedades',
  },
  {
    key: 'ENTERPRISE',
    nombre: 'Enterprise',
    desde: 101,
    hasta: null,
    precio: 350_000,
    rango: 'Más de 100 propiedades',
  },
];

/** Devuelve el tramo correspondiente a N propiedades. Siempre matchea. */
export function tramoPara(propiedades: number): TramoPlan {
  for (const t of TRAMOS_PLAN) {
    if (propiedades >= t.desde && (t.hasta === null || propiedades <= t.hasta)) {
      return t;
    }
  }
  return TRAMOS_PLAN[TRAMOS_PLAN.length - 1]!;
}

export interface ResumenPlan {
  /** Nombre comercial del tramo. */
  plan: string;
  /** Slug interno. */
  key: TramoPlan['key'];
  /** Cantidad de propiedades activas. */
  propiedadesActivas: number;
  /** Tope del plan actual (null si es Enterprise). */
  topePlan: number | null;
  /** Costo fijo del plan actual. */
  costoMensualTotal: number;
  /** Próximo tramo si existe (para mostrar "te quedan N para pasar al siguiente"). */
  proximoTramo: TramoPlan | null;
  /** Cuántas propiedades faltan para llegar al próximo tramo. */
  propiedadesParaProximo: number | null;
  /** Próxima fecha de facturación. */
  proximaFacturacion: string;
}

export function calcularResumenPlan(): ResumenPlan {
  const propiedadesActivas = propiedadesMock.filter(
    (p) => p.estado === 'ALQUILADA' || p.estado === 'DISPONIBLE',
  ).length;
  return resumenPara(propiedadesActivas);
}

/**
 * Calcula el resumen del plan para una cantidad arbitraria de propiedades
 * (útil para simular "qué pasa si agrego una más" en el wizard).
 */
export function resumenPara(propiedadesActivas: number): ResumenPlan {
  const tramo = tramoPara(propiedadesActivas);
  const idx = TRAMOS_PLAN.findIndex((t) => t.key === tramo.key);
  const proximoTramo = idx >= 0 && idx < TRAMOS_PLAN.length - 1 ? TRAMOS_PLAN[idx + 1]! : null;
  const propiedadesParaProximo =
    tramo.hasta !== null ? Math.max(0, tramo.hasta - propiedadesActivas + 1) : null;
  return {
    plan: tramo.nombre,
    key: tramo.key,
    propiedadesActivas,
    topePlan: tramo.hasta,
    costoMensualTotal: tramo.precio,
    proximoTramo,
    propiedadesParaProximo,
    proximaFacturacion: '2026-06-01',
  };
}

// Constante legacy mantenida para que las pantallas que la usen sigan
// compilando — siempre devuelve el precio fijo del plan ACTUAL de la
// inmobiliaria (no "por propiedad").
export const COSTO_PROPIEDAD_MENSUAL = 0;

/* ============================================================
 * Plan Consorcios
 *
 * Métrica = cantidad de UF bajo administración (no cantidad de
 * consorcios — un consorcio chico de 8 UF cuesta menos administrar
 * que uno grande de 80 UF).
 *
 * Precios ~40% más baratos por unidad que el plan de alquileres
 * porque el ticket promedio de la cobranza (expensas) es menor que
 * el de un alquiler residencial/comercial.
 * ============================================================ */

export interface TramoPlanConsorcios {
  key: 'CNS_BASIC' | 'CNS_STANDARD' | 'CNS_PREMIUM' | 'CNS_ELITE';
  nombre: string;
  /** Cota inferior de UF (inclusive). */
  desde: number;
  /** Cota superior de UF (inclusive). null = sin tope. */
  hasta: number | null;
  /** Precio fijo mensual en ARS. */
  precio: number;
  rango: string;
}

export const TRAMOS_PLAN_CONSORCIOS: TramoPlanConsorcios[] = [
  {
    key: 'CNS_BASIC',
    nombre: 'Consorcios · Basic',
    desde: 0,
    hasta: 30,
    precio: 30_000,
    rango: 'Hasta 30 UF',
  },
  {
    key: 'CNS_STANDARD',
    nombre: 'Consorcios · Standard',
    desde: 31,
    hasta: 80,
    precio: 60_000,
    rango: 'Hasta 80 UF',
  },
  {
    key: 'CNS_PREMIUM',
    nombre: 'Consorcios · Premium',
    desde: 81,
    hasta: 200,
    precio: 120_000,
    rango: 'Hasta 200 UF',
  },
  {
    key: 'CNS_ELITE',
    nombre: 'Consorcios · Elite',
    desde: 201,
    hasta: null,
    precio: 210_000,
    rango: 'Más de 200 UF',
  },
];

export function tramoConsorciosPara(ufs: number): TramoPlanConsorcios {
  for (const t of TRAMOS_PLAN_CONSORCIOS) {
    if (ufs >= t.desde && (t.hasta === null || ufs <= t.hasta)) return t;
  }
  return TRAMOS_PLAN_CONSORCIOS[TRAMOS_PLAN_CONSORCIOS.length - 1]!;
}

export interface ResumenConsorcios {
  /** Cantidad total de UF que administra la inmo. */
  ufsTotales: number;
  /** Cantidad de consorcios bajo administración. */
  consorcios: number;
  /** Tramo actual (null si no administra consorcios). */
  tramo: TramoPlanConsorcios | null;
  costoMensual: number;
  /** Bonificación equivalente vs plan de alquileres del mismo tramo. */
  bonificacionVsAlquileres: number;
}

/**
 * Cuenta las UF totales sumando los consorcios bajo administración.
 * Si la inmo no administra ninguno, devuelve un resumen con tramo=null
 * y costo 0 (ese plan no se factura).
 */
export function calcularResumenConsorcios(): ResumenConsorcios {
  const consorcios = consorciosMock.length;
  const ufsTotales = consorciosMock.reduce((s, c) => s + c.cantUf, 0);
  if (consorcios === 0) {
    return {
      ufsTotales: 0,
      consorcios: 0,
      tramo: null,
      costoMensual: 0,
      bonificacionVsAlquileres: 0,
    };
  }
  const tramo = tramoConsorciosPara(ufsTotales);
  // Comparación contra el precio del tramo de alquileres con el mismo
  // tope de unidades — sirve para mostrar "ahorro vs si fuera alquiler".
  const tramoAlqEquivalente = tramoPara(ufsTotales);
  const bonificacion = Math.max(0, tramoAlqEquivalente.precio - tramo.precio);
  return {
    ufsTotales,
    consorcios,
    tramo,
    costoMensual: tramo.precio,
    bonificacionVsAlquileres: bonificacion,
  };
}

/**
 * Costo total combinado: alquileres + consorcios.
 */
export function calcularCostoCombinado(): {
  alquileres: number;
  consorcios: number;
  total: number;
} {
  const alq = calcularResumenPlan().costoMensualTotal;
  const cns = calcularResumenConsorcios().costoMensual;
  return { alquileres: alq, consorcios: cns, total: alq + cns };
}

export interface Factura {
  id: string;
  periodo: string;
  fechaEmision: string;
  propiedadesEnPlan: number;
  plan: TramoPlan['key'];
  importeBase: number;
  importeIva: number;
  importeTotal: number;
  estado: 'PAGADA' | 'PENDIENTE' | 'VENCIDA';
  fechaPago: string | null;
  metodoPago: 'TRANSFERENCIA' | 'TARJETA' | null;
  pdfUrl: string;
}

/** Helper para armar factura mock de un período. */
function mkFactura(
  id: string,
  periodo: string,
  fechaEmision: string,
  propiedades: number,
  estado: Factura['estado'],
  fechaPago: string | null,
  metodoPago: Factura['metodoPago'],
): Factura {
  const tramo = tramoPara(propiedades);
  const base = tramo.precio;
  const iva = Math.round(base * 0.21);
  return {
    id,
    periodo,
    fechaEmision,
    propiedadesEnPlan: propiedades,
    plan: tramo.key,
    importeBase: base,
    importeIva: iva,
    importeTotal: base + iva,
    estado,
    fechaPago,
    metodoPago,
    pdfUrl: '#',
  };
}

// Historial mock de facturas — se recalculan con el tramo nuevo según
// la cantidad de propiedades que la inmo tenía cada mes.
export const facturasMock: Factura[] = [
  mkFactura('fac_2026_05', '2026-05', '2026-05-01', 6, 'PENDIENTE', null, null),
  mkFactura('fac_2026_04', '2026-04', '2026-04-01', 6, 'PAGADA', '2026-04-05', 'TRANSFERENCIA'),
  mkFactura('fac_2026_03', '2026-03', '2026-03-01', 5, 'PAGADA', '2026-03-08', 'TRANSFERENCIA'),
  mkFactura('fac_2026_02', '2026-02', '2026-02-01', 5, 'PAGADA', '2026-02-10', 'TARJETA'),
  mkFactura('fac_2026_01', '2026-01', '2026-01-01', 4, 'PAGADA', '2026-01-07', 'TRANSFERENCIA'),
  mkFactura('fac_2025_12', '2025-12', '2025-12-01', 4, 'PAGADA', '2025-12-06', 'TRANSFERENCIA'),
];
