/**
 * El libro de auditoría no dice pesos cuando son dólares.
 *
 * DE DÓNDE SALIÓ. La auditoría del 31/08 encontró UN sitio: el evento `PROPIETARIO_RENDIDO`
 * escribía `neto $1200` mientras el evento de ANULACIÓN de la misma rendición escribía
 * `neto US$1200`. El mismo hecho, dos asientos que se contradicen, en la fuente que se consulta
 * cuando un propietario reclama por plata.
 *
 * La barrida encontró **nueve más**, incluido uno que no ve un operador sino el INQUILINO: el
 * aviso "Tu comprobante fue confirmado", que es el que guarda como constancia de que pagó.
 *
 * POR QUÉ EL ARREGLO ES UNA FUNCIÓN Y NO NUEVE TERNARIOS. El ternario correcto ya estaba escrito
 * a mano en cuatro lugares y faltaba en trece. Con `sim()` en un solo archivo, el próximo lugar
 * lo escribe bien quien no conozca la historia — que es exactamente lo que no pasó las últimas
 * nueve veces.
 *
 * NO NECESITA BASE: prueba la función y barre el fuente.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { montoConSigno, sim } from '../src/lib/simbolo-moneda.js';

const DIR_ROUTES = fileURLToPath(new URL('../src/routes', import.meta.url));

/**
 * Sitios donde el `$` a mano es CORRECTO porque el monto nunca puede ser USD, con el motivo.
 * Es una lista blanca: el archivo nuevo entra al barrido por defecto.
 */
const SIEMPRE_EN_PESOS: Record<string, string> = {
  // `MovimientoConsorcio` no tiene columna `moneda`: el asiento del edificio es ARS por
  // construcción (schema.prisma).
  'operacion.ts': 'MovimientoConsorcio no tiene moneda',
  // La conciliación por extracto filtra `moneda: 'ARS'` explícitamente, con comentario: el
  // extracto no declara moneda, así que una liquidación en USD no puede matchear.
  'resumenes-bancarios.ts': "el matcher filtra moneda: 'ARS'",
};

describe('sim() — el signo de la moneda', () => {
  it('USD lleva US$ y todo lo demás lleva $', () => {
    expect(sim('USD')).toBe('US$');
    expect(sim('ARS')).toBe('$');
  });

  it('sin dato NO se inventa el dólar: cae a pesos', () => {
    // El default importa: la mayoría de los contratos son en pesos, así que ante un dato
    // faltante el error menos malo es el signo de pesos, no el de dólares.
    expect(sim(null)).toBe('$');
    expect(sim(undefined)).toBe('$');
    expect(sim('')).toBe('$');
  });

  it('el símbolo va pegado al número, como en todos los asientos', () => {
    expect(montoConSigno(1200, 'USD')).toBe('US$1200');
    expect(montoConSigno(480000, 'ARS')).toBe('$480000');
  });
});

describe('ningún asiento nuevo vuelve a quemar el signo', () => {
  /** Un `$` literal pegado a una interpolación dentro de un template string. */
  const QUEMADO = new RegExp('`[^`\\n]*' + '\\$\\$\\{');

  const archivos = readdirSync(DIR_ROUTES).filter((f) => f.endsWith('.ts'));

  it('el barrido encuentra archivos: si esto baja, el test dejó de medir', () => {
    // Control negativo del propio instrumento. Un test que escanea el fuente y no encuentra
    // nada pasa en verde midiendo cero.
    expect(archivos.length).toBeGreaterThan(10);
    expect(archivos).toContain('plata.ts');
  });

  it('no quedan símbolos de moneda quemados fuera de la lista blanca', () => {
    const sucios: string[] = [];
    for (const f of archivos) {
      if (f in SIEMPRE_EN_PESOS) continue;
      const lineas = readFileSync(join(DIR_ROUTES, f), 'utf8').split('\n');
      lineas.forEach((l, i) => {
        if (QUEMADO.test(l) && !l.includes('sim(')) sucios.push(`${f}:${i + 1}  ${l.trim().slice(0, 100)}`);
      });
    }
    expect(
      sucios,
      `Estos textos meten un "$" a mano donde el monto puede ser USD:\n` +
        sucios.map((x) => `  - ${x}`).join('\n') +
        `\n\nUsá \`sim(moneda)\` de \`lib/simbolo-moneda.ts\`. Si ese monto NUNCA puede ser USD, ` +
        `sumá el archivo a SIEMPRE_EN_PESOS con el motivo — la lista blanca es una decisión, no un trámite.`,
    ).toEqual([]);
  });

  it('lo declarado en la lista blanca sigue existiendo', () => {
    // Que la excepción muera con el archivo, y no quede tapando a otro que se llame igual.
    for (const f of Object.keys(SIEMPRE_EN_PESOS)) expect(archivos, `excepción huérfana: ${f}`).toContain(f);
  });
});
