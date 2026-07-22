import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parsearMonto, parsearFilasResumen } from '../src/lib/matching-bancario.js';

/**
 * Tests PUROS (sin DB) del parseo del extracto bancario.
 *
 * El extracto es la única fuente de la conciliación: el monto que sale de acá se persiste
 * en CreditoDetectado y pasa tal cual al Pago CONCILIADO, y la fecha es el `asOf` con el
 * que se calcula la mora. Un parseo con criterio en-US distorsionaba las dos cosas en
 * silencio sobre plata real.
 */

describe('parsearMonto — formato argentino', () => {
  it('el punto es separador de MILES, no decimal', () => {
    // El bug: Number("150.000".replace(/[^\d.-]/g,'')) daba 150 — mil veces menos.
    expect(parsearMonto('150.000')).toBe(150_000);
    expect(parsearMonto('1.500.000')).toBe(1_500_000);
    expect(parsearMonto('$ 150.000')).toBe(150_000);
  });

  it('la coma es el separador DECIMAL', () => {
    // El bug: la coma se borraba y "250000,50" entraba como 25.000.050.
    expect(parsearMonto('250000,50')).toBe(250_000.5);
    expect(parsearMonto('1.234,56')).toBe(1234.56);
    expect(parsearMonto('$ 1.234,56')).toBe(1234.56);
  });

  it('también acepta el formato en-US (algunos bancos exportan así)', () => {
    expect(parsearMonto('1,234.56')).toBe(1234.56);
    expect(parsearMonto('1,500,000')).toBe(1_500_000);
  });

  it('enteros, números nativos y negativos contables', () => {
    expect(parsearMonto('150000')).toBe(150_000);
    expect(parsearMonto(150_000)).toBe(150_000);
    expect(parsearMonto('(1.234,56)')).toBe(-1234.56);
    expect(parsearMonto('-150.000')).toBe(-150_000);
  });

  it('basura devuelve NaN (la fila se ignora, no entra como 0)', () => {
    expect(Number.isNaN(parsearMonto(''))).toBe(true);
    expect(Number.isNaN(parsearMonto('SALDO'))).toBe(true);
    expect(Number.isNaN(parsearMonto(null))).toBe(true);
  });
});

describe('parseo del CSV con lectura raw (fecha argentina)', () => {
  // Reproduce el camino real del endpoint: XLSX.read(..., { raw: true }).
  function filasDe(csv: string): unknown[][] {
    const wb = XLSX.read(Buffer.from(csv, 'utf8'), { type: 'buffer', raw: true });
    const hoja = wb.Sheets[wb.SheetNames[0]!]!;
    return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true }) as unknown[][];
  }

  it('dd/mm con día <= 12 NO se invierte a mm/dd', () => {
    // El bug: con cellDates:true, "05/07/2026" entraba como 7 de MAYO. Esa fecha es el
    // asOf de la mora → condonaba o inventaba mora en silencio.
    const { creditos } = parsearFilasResumen(
      filasDe('fecha;monto;titular\n05/07/2026;150.000;Juan Perez\n'),
    );
    expect(creditos.length).toBe(1);
    const f = creditos[0]!.fecha;
    expect(f.getFullYear()).toBe(2026);
    expect(f.getMonth()).toBe(6); // julio (0-indexed)
    expect(f.getDate()).toBe(5);
    expect(creditos[0]!.monto).toBe(150_000);
  });

  it('día > 12 (nunca fue ambiguo) sigue funcionando', () => {
    const { creditos } = parsearFilasResumen(
      filasDe('fecha;monto;titular\n25/07/2026;1.234,56;Ana Gomez\n'),
    );
    expect(creditos.length).toBe(1);
    expect(creditos[0]!.fecha.getMonth()).toBe(6);
    expect(creditos[0]!.fecha.getDate()).toBe(25);
    expect(creditos[0]!.monto).toBe(1234.56);
  });

  it('ignora filas sin fecha o sin monto válido en vez de meterlas como 0', () => {
    const { creditos, filasIgnoradas } = parsearFilasResumen(
      filasDe('fecha;monto;titular\n05/07/2026;150.000;Juan\n;90.000;Sin fecha\n06/07/2026;SALDO;Sin monto\n'),
    );
    expect(creditos.length).toBe(1);
    expect(filasIgnoradas).toBe(2);
  });
});
