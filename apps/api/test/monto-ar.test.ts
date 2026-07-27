import { describe, it, expect } from 'vitest';
import { parsearMonto } from '../src/lib/monto.js';

// CAZABUG P1 — el normalizador del extracto bancario (matching-bancario.ts) hacía
// `replace(/[^\d.-]/g, '')`: borraba la coma decimal y dejaba el punto de miles como
// decimal. En formato argentino (lo que exporta CUALQUIER banco local) eso daba:
//   "150.000,00" → 150        (÷1000, se pierde el 99,9% de la plata)
//   "150000,00"  → 15000000   (×100)
// y entraba en silencio a la DB (no cuenta como fila ignorada). Test puro, sin DB.

describe('CAZABUG — parsearMontoAR', () => {
  it('formato argentino (punto de miles + coma decimal)', () => {
    expect(parsearMonto('150.000,00')).toBe(150000); // antes: 150
    expect(parsearMonto('1.234,56')).toBe(1234.56); // antes: 1.23456
    expect(parsearMonto('1.234.567,89')).toBe(1234567.89);
    expect(parsearMonto('1.500')).toBe(1500); // antes: 1.5
  });

  it('coma decimal sin separador de miles', () => {
    expect(parsearMonto('150000,00')).toBe(150000); // antes: 15000000 (×100)
    expect(parsearMonto('1234,5')).toBe(1234.5);
  });

  it('formato US (coma de miles + punto decimal)', () => {
    expect(parsearMonto('1,234.56')).toBe(1234.56);
    expect(parsearMonto('1,500')).toBe(1500); // antes (importador): 1.5
    expect(parsearMonto('150000.5')).toBe(150000.5);
  });

  it('ruido alrededor del número (símbolos, espacios)', () => {
    expect(parsearMonto('$ 1.500,50')).toBe(1500.5);
    expect(parsearMonto(' ARS 150.000,00 ')).toBe(150000);
  });

  it('negativos (débitos del extracto)', () => {
    expect(parsearMonto('-150.000,00')).toBe(-150000);
    expect(parsearMonto('-1,234.56')).toBe(-1234.56);
  });

  it('números ya numéricos pasan derecho (Excel con cellDates)', () => {
    expect(parsearMonto(150000)).toBe(150000);
    expect(parsearMonto(1234.56)).toBe(1234.56);
  });

  it('basura → NaN (el caller ignora la fila)', () => {
    expect(parsearMonto('')).toBeNaN();
    expect(parsearMonto(null)).toBeNaN();
    expect(parsearMonto(undefined)).toBeNaN();
    expect(parsearMonto('TRANSFERENCIA')).toBeNaN();
  });
});
