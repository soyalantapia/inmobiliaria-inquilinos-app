import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parsearFilasResumen } from '../src/lib/matching-bancario.js';

// CAZABUG P1 — el extracto bancario se leía con XLSX.read(..., { cellDates: true }) SIN
// `raw: true`. Para CSV, xlsx coacciona la celda ANTES de que la veamos:
//   "150.000,00" → el número 150      (÷1000: se pierde el 99,9% de la plata)
//   "01/06/2024" → 6 de ENERO (mm/dd) (la mora se calcula contra el mes equivocado)
// y encima el normalizador de monto borraba la coma decimal ("150000,00" → 15.000.000).
// Los DOS fixes van juntos: con raw:true el monto llega como texto "150.000,00", que el
// normalizador viejo también rompía. Test PURO (sin DB): parsea igual que la ruta.

// Réplica exacta de la lectura de resumenes-bancarios.ts para un archivo .csv.
function leerCsvComoLaRuta(csv: string): unknown[][] {
  const wb = XLSX.read(Buffer.from(csv), { type: 'buffer', raw: true });
  const hoja = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true }) as unknown[][];
}

const CSV_AR = [
  'fecha,concepto,importe,titular',
  '01/06/2024,TRANSFERENCIA,"150.000,00",PEREZ JUAN',
  '15/06/2024,TRANSFERENCIA,"1.234.567,89",GOMEZ ANA',
  '20/06/2024,TRANSFERENCIA,"150000,00",LOPEZ LUIS',
  '25/06/2024,DEBITO,"-5.000,00",COMISION BANCO',
].join('\n');

describe('CAZABUG — extracto bancario CSV en formato argentino', () => {
  const parseo = parsearFilasResumen(leerCsvComoLaRuta(CSV_AR));

  it('los montos se leen completos (no ÷1000 ni ×100)', () => {
    const montos = parseo.creditos.map((c) => c.monto);
    expect(montos).toContain(150000); // antes: 150
    expect(montos).toContain(1234567.89); // antes: 1.23456...
    expect(montos).toContain(150000); // "150000,00" — antes: 15000000
    expect(montos).not.toContain(150);
    expect(montos).not.toContain(15000000);
  });

  it('las fechas dd/mm/yyyy NO se invierten a mm/dd', () => {
    const primero = parseo.creditos.find((c) => c.monto === 150000);
    expect(primero).toBeDefined();
    // 01/06/2024 = 1 de JUNIO (mes 5 en JS). Antes salía 6 de enero (mes 0).
    expect(primero!.fecha.getMonth()).toBe(5);
    expect(primero!.fecha.getDate()).toBe(1);
  });

  it('el débito (monto negativo) se ignora: sólo entran créditos', () => {
    expect(parseo.creditos.some((c) => c.monto < 0)).toBe(false);
    expect(parseo.filasIgnoradas).toBe(1);
  });

  it('no quedan columnas faltantes con headers típicos de banco', () => {
    expect(parseo.columnasFaltantes).toHaveLength(0);
  });
});
