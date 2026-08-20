import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  PREFIJO_REVERSION_INTERNA,
  esReversionInterna,
  observacionDeReversion,
} from '../src/lib/reversion-interna.js';

/**
 * CAZABUG — a un inquilino cuyo pago CONFIRMÓ EL BANCO se le decía que se lo habían rechazado.
 *
 * El esquema tiene un solo `RECHAZADO` para dos cosas que no se parecen: un comprobante del
 * inquilino que no servía, y la inmobiliaria dando de baja un cobro propio. Lo único que los
 * distingue es un prefijo en la `observacion`, y ese prefijo estaba escrito a mano en tres
 * archivos. Cuando la conciliación por extracto bancario empezó a cerrar avisos de pago, su
 * autor no tenía cómo saber que la convención existía.
 *
 * Consecuencia real, en producción: el inquilino avisaba que pagó, el banco lo confirmaba, y el
 * sistema le mostraba "Tu pago fue rechazado", se lo publicaba en el feed con severidad crítica,
 * le filtraba la nota interna y le bajaba el nivel de buen pagador del certificado — justo lo
 * que el comentario de `PAGO_RECHAZADO_REAL` dice que hay que evitar.
 */
describe('observacionDeReversion / esReversionInterna', () => {
  it('lo que arma el helper, el detector lo reconoce', () => {
    // Es la invariante entera: si estos dos se separan, vuelve el bug.
    expect(esReversionInterna(observacionDeReversion('cargué mal el monto'))).toBe(true);
  });

  it('un rechazo de verdad NO es reversión interna', () => {
    expect(esReversionInterna('El comprobante no se lee')).toBe(false);
    expect(esReversionInterna('Transferencia inexistente')).toBe(false);
  });

  it('sin observación tampoco: ante la duda es un rechazo real y cuenta como tal', () => {
    expect(esReversionInterna(null)).toBe(false);
    expect(esReversionInterna(undefined)).toBe(false);
    expect(esReversionInterna('')).toBe(false);
  });

  it('el motivo queda legible después del prefijo', () => {
    expect(observacionDeReversion('el extracto lo confirmó')).toBe(
      `${PREFIJO_REVERSION_INTERNA} el extracto lo confirmó`,
    );
  });
});

describe('nadie escribe una observación de rechazo a mano', () => {
  it('ningún handler asigna `observacion:` con un literal', () => {
    // ESTE es el test que faltaba, y la regla es simple: en `routes/` no se escribe una
    // `observacion` a mano. El motivo de un rechazo REAL sale de lo que tipeó el operador
    // (`body.data.observacion`); una reversión INTERNA tiene que pasar por
    // `observacionDeReversion()`, que le pone el prefijo. Un literal ahí es exactamente el bug:
    // alguien que no sabía que la convención existía.
    //
    // Hoy hay CERO, así que la regla no tiene falsos positivos que tolerar.
    //
    // (Un primer intento buscaba `estado: 'RECHAZADO'` y un `observacion:` en las 6 líneas
    // siguientes. Era más "inteligente" y no servía: el propio comentario explicativo que se
    // agregó al arreglo empujaba la línea fuera de la ventana, y el test pasaba con el bug
    // puesto. Se comprobó reintroduciéndolo.)
    const dir = join(import.meta.dirname, '..', 'src', 'routes');
    const sospechosos: string[] = [];

    for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const lineas = readFileSync(join(dir, archivo), 'utf8').split('\n');
      lineas.forEach((linea, i) => {
        if (/observacion:\s*[`'"]/.test(linea)) sospechosos.push(`${archivo}:${i + 1}`);
      });
    }

    expect(
      sospechosos,
      'arman la observación a mano: si es una reversión de la inmobiliaria tiene que ir por ' +
        'observacionDeReversion(), o al inquilino se le cuenta como un rechazo suyo y le baja ' +
        'el nivel del certificado',
    ).toEqual([]);
  });
});
