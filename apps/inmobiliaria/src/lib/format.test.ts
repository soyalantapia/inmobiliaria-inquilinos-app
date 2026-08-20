/**
 * `formatTotalPorMoneda` — el helper que impide inventar plata.
 *
 * POR QUÉ IMPORTA. Sumar pesos con dólares en un solo número es plata inventada, y encima
 * `formatMonto` sin moneda lo pinta como pesos: el default TAPA el error, así que el resultado
 * se ve perfectamente normal. Es exactamente el bug que apareció en el saldo por cuenta de caja
 * (T-13), donde un gasto de US$800 y uno de $80.000 se restaban como si fueran la misma unidad.
 *
 * Los tests NO comparan strings exactos de `Intl`: el formato depende del ICU de cada máquina y
 * un test que se rompe al actualizar Node no protege nada. Comparan lo que sí es la garantía:
 * que cada moneda quede en su propio término y que nunca se fusionen en uno solo.
 */
import { describe, it, expect } from 'vitest';
import { formatMonto, formatTotalPorMoneda } from './format';

describe('formatTotalPorMoneda', () => {
  it('con UNA sola moneda se ve igual que un formateo común', () => {
    // El caso del 99%. Si esto cambiara, el helper estaría ensuciando la pantalla normal para
    // cubrir un borde.
    expect(formatTotalPorMoneda([{ monto: 480000, moneda: 'ARS' }])).toBe(formatMonto(480000, 'ARS'));
  });

  it('suma dentro de cada moneda, pero NUNCA entre monedas', () => {
    const r = formatTotalPorMoneda([
      { monto: 100000, moneda: 'ARS' },
      { monto: 20000, moneda: 'ARS' },
      { monto: 800, moneda: 'USD' },
    ]);
    // Dos términos separados, no uno.
    expect(r.split(' · ')).toHaveLength(2);
    expect(r).toContain(formatMonto(120000, 'ARS'));
    expect(r).toContain(formatMonto(800, 'USD'));
    // Y sobre todo: el total fusionado (120.800) NO puede aparecer en ningún lado.
    expect(r).not.toContain(formatMonto(120800, 'ARS'));
  });

  it('sin moneda asume ARS y no arma un grupo aparte', () => {
    // Los movimientos viejos no tienen moneda. Tratarlos como una moneda distinta partiría el
    // total en dos por un dato ausente.
    const r = formatTotalPorMoneda([{ monto: 500 }, { monto: 300, moneda: 'ARS' }]);
    expect(r).toBe(formatMonto(800, 'ARS'));
  });

  it('con la lista vacía devuelve cero, no una cadena vacía', () => {
    // Una card que muestra "" en vez de "$ 0" se lee como un error de carga.
    expect(formatTotalPorMoneda([])).toBe(formatMonto(0));
  });

  it('el orden es estable, no el de llegada', () => {
    // Sin orden fijo, dos renders de los mismos datos podrían mostrar las monedas al revés según
    // en qué orden vinieron las filas de la base.
    const a = formatTotalPorMoneda([
      { monto: 800, moneda: 'USD' },
      { monto: 1000, moneda: 'ARS' },
    ]);
    const b = formatTotalPorMoneda([
      { monto: 1000, moneda: 'ARS' },
      { monto: 800, moneda: 'USD' },
    ]);
    expect(a).toBe(b);
  });

  it('los negativos se conservan por moneda', () => {
    // Un saldo de caja puede quedar en negativo, y compensar un rojo en dólares con un verde en
    // pesos sería exactamente la mentira que este helper viene a evitar.
    const r = formatTotalPorMoneda([
      { monto: -3000, moneda: 'ARS' },
      { monto: 800, moneda: 'USD' },
    ]);
    expect(r).toContain(formatMonto(-3000, 'ARS'));
    expect(r).toContain(formatMonto(800, 'USD'));
  });
});
