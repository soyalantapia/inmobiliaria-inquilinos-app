// Cálculo de punitorios por mora.
//
// Modelo simple del MVP: tasa punitoria DIARIA expresada en porcentaje del
// monto original (igual al schema de packages/db.Contrato.tasaPunitorioDiaria).
//
// Total con punitorios = montoOriginal * (1 + tasaDiaria% * diasAtraso)
//
// Esto es lineal — el contrato real puede tener tasa compuesta, pero hasta
// que conectemos un servicio de cálculo arancelado lo manejamos así.

import { parseLocal } from './format';
import type { Liquidacion } from './types';

export interface CalculoPunitorios {
  diasAtraso: number; // 0 si está al día o no vencida
  montoOriginal: number;
  punitorioAcumulado: number;
  punitorioPorDia: number; // cuánto se suma cada día más que pase
  tasaDiariaPct: number; // ej 0.1 = 0.1% diario
  totalAPagar: number;
}

export function calcularPunitorios(
  liq: Liquidacion,
  tasaDiariaPct: number,
  hoy: Date = new Date(),
): CalculoPunitorios {
  // Antes: `new Date(liq.fechaVencimiento)` interpretaba "2026-05-05"
  // como UTC midnight → en AR (GMT-3) retrocedía 1 día → diff con hoy
  // daba 22 cuando `diasHastaVencimiento(...)` daba 21. Esto generaba
  // discrepancia en la home: saludo decía "21 días" pero el banner
  // "Venció hace 22 días". Unificamos con parseFechaLocal.
  const venc = parseLocal(liq.fechaVencimiento);
  venc.setHours(0, 0, 0, 0);
  const ref = new Date(hoy);
  ref.setHours(0, 0, 0, 0);

  const diff = Math.floor((ref.getTime() - venc.getTime()) / 86400000);
  const diasAtraso = Math.max(0, diff);

  const montoOriginal = liq.montoTotal - liq.montoPunitorio; // base sin punitorios
  const punitorioPorDia = montoOriginal * (tasaDiariaPct / 100);
  const punitorioAcumulado = +(punitorioPorDia * diasAtraso).toFixed(2);
  const totalAPagar = +(montoOriginal + punitorioAcumulado).toFixed(2);

  return {
    diasAtraso,
    montoOriginal,
    punitorioAcumulado,
    punitorioPorDia: +punitorioPorDia.toFixed(2),
    tasaDiariaPct,
    totalAPagar,
  };
}

export const TASA_PUNITORIA_DIARIA_DEFAULT = 0.15; // 0.15% diario ≈ 4.5% mensual
