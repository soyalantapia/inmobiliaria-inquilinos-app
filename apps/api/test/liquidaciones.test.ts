import { describe, it, expect } from 'vitest';
import {
  computarLiquidacionesContrato,
  type ContratoParaLiquidar,
} from '../src/lib/liquidaciones.js';

/**
 * Tests PUROS del cómputo de liquidaciones (sin DB). `now` es inyectable, así
 * que son deterministas. Cubren el caso del circuito E2E (contrato nuevo →
 * período actual + siguiente para 1er y 2º pago) y los bordes históricos.
 */

const base: Omit<ContratoParaLiquidar, 'fechaInicio' | 'fechaFin'> = {
  id: 'cnt_test',
  inmobiliariaId: 'inmo_test',
  monto: 500_000,
  montoExpensas: 80_000,
  moneda: 'ARS',
  diaPago: 10,
};

function contrato(inicio: string, fin: string, over: Partial<ContratoParaLiquidar> = {}): ContratoParaLiquidar {
  return { ...base, fechaInicio: new Date(inicio), fechaFin: new Date(fin), ...over };
}

describe('computarLiquidacionesContrato', () => {
  it('contrato nuevo (inicio este mes): genera período actual + siguiente', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-06-01T00:00:00Z', '2028-06-01T00:00:00Z'),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2026-06', '2026-07']);
    // Monto total = alquiler + expensas, en las dos.
    expect(data.every((l) => Number(l.montoTotal) === 580_000)).toBe(true);
    expect(data.every((l) => Number(l.montoAlquiler) === 500_000)).toBe(true);
    expect(data.every((l) => Number(l.montoExpensas) === 80_000)).toBe(true);
    // Junio venció el 10 (< 15) → VENCIDO; julio vence el 10 → PENDIENTE.
    expect(data.map((l) => l.estado)).toEqual(['VENCIDO', 'PENDIENTE']);
  });

  it('clampa el día de pago al último día del mes (feb, diaPago 31)', () => {
    const now = new Date('2026-01-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', { diaPago: 31 }),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2026-01', '2026-02']);
    const feb = data.find((l) => l.periodo === '2026-02')!;
    // 2026 no es bisiesto → febrero tiene 28 días, no 31.
    expect((feb.fechaVencimiento as Date).getUTCDate()).toBe(28);
  });

  it('contrato que empezó hace meses: devenga todos los períodos pasados (VENCIDO) + el próximo', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-03-01T00:00:00Z', '2028-03-01T00:00:00Z'),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
    expect(data[0].estado).toBe('VENCIDO');
    expect(data[data.length - 1].periodo).toBe('2026-07');
    expect(data[data.length - 1].estado).toBe('PENDIENTE');
  });

  it('no pre-factura más allá de fechaFin (contrato que termina este mes)', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-06-01T00:00:00Z', '2026-06-30T00:00:00Z'),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2026-06']);
  });

  it('contrato futuro: solo el primer mes (no pre-factura todo el año)', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2027-01-01T00:00:00Z', '2029-01-01T00:00:00Z'),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2027-01']);
    expect(data[0].estado).toBe('PENDIENTE');
  });

  it('sin expensas: montoTotal = alquiler y montoExpensas null', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-06-01T00:00:00Z', '2027-06-01T00:00:00Z', { montoExpensas: null, monto: 300_000 }),
      now,
    );
    expect(data.every((l) => l.montoExpensas === null)).toBe(true);
    expect(data.every((l) => Number(l.montoTotal) === 300_000)).toBe(true);
  });
});
