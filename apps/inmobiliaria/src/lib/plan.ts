// Pricing y plan de la inmobiliaria.
// Modelo simple: $X ARS por propiedad activa por mes.
// Cuando el backend exista esto vive en Inmobiliaria.plan + tabla pricing.

import { propiedadesMock } from './mock-data';

export const COSTO_PROPIEDAD_MENSUAL = 10000; // ARS por propiedad
export const PLAN_ACTUAL = 'Starter' as const;

export interface ResumenPlan {
  plan: string;
  propiedadesActivas: number;
  costoPorPropiedad: number;
  costoMensualTotal: number;
  proximaFacturacion: string; // ISO
}

export function calcularResumenPlan(): ResumenPlan {
  const propiedadesActivas = propiedadesMock.filter(
    (p) => p.estado === 'ALQUILADA' || p.estado === 'DISPONIBLE',
  ).length;
  return {
    plan: PLAN_ACTUAL,
    propiedadesActivas,
    costoPorPropiedad: COSTO_PROPIEDAD_MENSUAL,
    costoMensualTotal: propiedadesActivas * COSTO_PROPIEDAD_MENSUAL,
    proximaFacturacion: '2026-06-01',
  };
}

export interface Factura {
  id: string;
  periodo: string; // ej '2026-05'
  fechaEmision: string; // ISO
  propiedadesEnPlan: number;
  importeBase: number;
  importeIva: number;
  importeTotal: number;
  estado: 'PAGADA' | 'PENDIENTE' | 'VENCIDA';
  fechaPago: string | null;
  metodoPago: 'TRANSFERENCIA' | 'TARJETA' | null;
  pdfUrl: string;
}

// Historial mock de facturas mes a mes
export const facturasMock: Factura[] = [
  {
    id: 'fac_2026_05',
    periodo: '2026-05',
    fechaEmision: '2026-05-01',
    propiedadesEnPlan: 6,
    importeBase: 60000,
    importeIva: 12600,
    importeTotal: 72600,
    estado: 'PENDIENTE',
    fechaPago: null,
    metodoPago: null,
    pdfUrl: '#',
  },
  {
    id: 'fac_2026_04',
    periodo: '2026-04',
    fechaEmision: '2026-04-01',
    propiedadesEnPlan: 6,
    importeBase: 60000,
    importeIva: 12600,
    importeTotal: 72600,
    estado: 'PAGADA',
    fechaPago: '2026-04-05',
    metodoPago: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
  {
    id: 'fac_2026_03',
    periodo: '2026-03',
    fechaEmision: '2026-03-01',
    propiedadesEnPlan: 5,
    importeBase: 50000,
    importeIva: 10500,
    importeTotal: 60500,
    estado: 'PAGADA',
    fechaPago: '2026-03-08',
    metodoPago: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
  {
    id: 'fac_2026_02',
    periodo: '2026-02',
    fechaEmision: '2026-02-01',
    propiedadesEnPlan: 5,
    importeBase: 50000,
    importeIva: 10500,
    importeTotal: 60500,
    estado: 'PAGADA',
    fechaPago: '2026-02-10',
    metodoPago: 'TARJETA',
    pdfUrl: '#',
  },
  {
    id: 'fac_2026_01',
    periodo: '2026-01',
    fechaEmision: '2026-01-01',
    propiedadesEnPlan: 4,
    importeBase: 40000,
    importeIva: 8400,
    importeTotal: 48400,
    estado: 'PAGADA',
    fechaPago: '2026-01-07',
    metodoPago: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
  {
    id: 'fac_2025_12',
    periodo: '2025-12',
    fechaEmision: '2025-12-01',
    propiedadesEnPlan: 4,
    importeBase: 40000,
    importeIva: 8400,
    importeTotal: 48400,
    estado: 'PAGADA',
    fechaPago: '2025-12-06',
    metodoPago: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
];
