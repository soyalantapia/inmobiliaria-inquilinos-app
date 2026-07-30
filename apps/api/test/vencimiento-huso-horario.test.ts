import { describe, it, expect } from 'vitest';
import { diaCivilAR } from '@llave/shared';
import { calcularMora, type EsquemaMora } from '../src/lib/punitorios.js';

/**
 * El día del vencimiento es del inquilino: si la cuota vence el 10, tiene TODO el
 * 10 (hora de Argentina) para pagar sin figurar moroso ni devengar punitorios.
 *
 * Los vencimientos se guardan como medianoche UTC del día civil (`Date.UTC(y,m,dia)`),
 * así que el 10 vive en el instante `10T00:00:00Z` = 9 a las 21:00 en Argentina.
 * Comparar esa fecha contra el instante UTC actual adelanta el corte tres horas y
 * cae en el día anterior: a las 21:00 del 9 el sistema ya lo daba por vencido.
 *
 * Puro a propósito: es aritmética de fechas, no necesita DB.
 */
describe('el corte del día se hace en hora de Argentina, no en UTC', () => {
  const VENC_10 = new Date('2026-07-10T00:00:00.000Z'); // la cuota vence el 10

  it('a las 21:00 del 9 (AR) el corte sigue siendo el 9: la cuota del 10 NO está vencida', () => {
    // 2026-07-10T00:30Z === 2026-07-09 21:30 en Argentina
    const corte = diaCivilAR(new Date('2026-07-10T00:30:00.000Z'));
    expect(corte.toISOString()).toBe('2026-07-09T00:00:00.000Z');
    expect(VENC_10 < corte).toBe(false); // el barrido usa `fechaVencimiento < corte`
  });

  it('a las 21:00 del PROPIO día 10 tampoco vence: le queda el día entero', () => {
    // 2026-07-11T00:30Z === 2026-07-10 21:30 en Argentina
    const corte = diaCivilAR(new Date('2026-07-11T00:30:00.000Z'));
    expect(corte.toISOString()).toBe('2026-07-10T00:00:00.000Z');
    expect(VENC_10 < corte).toBe(false);
  });

  it('recién el 11 (AR) queda vencida', () => {
    const corte = diaCivilAR(new Date('2026-07-11T12:00:00.000Z')); // 11 a las 09:00 AR
    expect(corte.toISOString()).toBe('2026-07-11T00:00:00.000Z');
    expect(VENC_10 < corte).toBe(true);
  });

  it('la medianoche argentina del 10 (03:00Z) ya es el día 10', () => {
    expect(diaCivilAR(new Date('2026-07-10T03:00:00.000Z')).toISOString()).toBe('2026-07-10T00:00:00.000Z');
    expect(diaCivilAR(new Date('2026-07-10T02:59:59.000Z')).toISOString()).toBe('2026-07-09T00:00:00.000Z');
  });
});

describe('los punitorios no se devengan durante el día del vencimiento', () => {
  const esquema: EsquemaMora = { tipo: 'PORCENTAJE_DIARIO', valor: 1 };
  const VENC_10 = new Date('2026-07-10T00:00:00.000Z');

  it('a las 21:00 del propio día del vencimiento la mora sigue en cero', () => {
    // Antes cobraba 1 día: `asOf` normalizado a medianoche UTC ya caía en el 11.
    expect(calcularMora(100000, esquema, VENC_10, new Date('2026-07-11T00:30:00.000Z'))).toBe(0);
  });

  it('a las 21:00 del día ANTERIOR tampoco', () => {
    expect(calcularMora(100000, esquema, VENC_10, new Date('2026-07-10T00:30:00.000Z'))).toBe(0);
  });

  it('al día siguiente devenga exactamente un día (1% de 100.000)', () => {
    expect(calcularMora(100000, esquema, VENC_10, new Date('2026-07-11T12:00:00.000Z'))).toBe(1000);
  });

  it('dos días después, dos días — el corte no se corre solo', () => {
    expect(calcularMora(100000, esquema, VENC_10, new Date('2026-07-12T12:00:00.000Z'))).toBe(2000);
  });
});
