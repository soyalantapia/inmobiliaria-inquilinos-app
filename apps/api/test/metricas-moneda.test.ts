import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CAZABUG — la caja del tablero mezclaba monedas.
 *
 * Estos tests miran el CÓDIGO, no lo ejecutan. Es deliberado: los tres bugs de acá son
 * "falta una clave en un where" y "falta un campo en un create", y probarlos de verdad
 * requiere una base viva (los 52 archivos que hoy no corren, ver T-01-N1-N1). Un test que
 * lee el source no prueba comportamiento, pero sí ataja la regresión concreta —que alguien
 * vuelva a sacar el filtro— y es lo que se puede correr en cada push.
 *
 * Si algún día `metricas.ts` se parte en helpers puros, esto se reemplaza por tests de
 * verdad y mejor.
 */
const api = (p: string) => readFileSync(join(import.meta.dirname, '..', 'src', p), 'utf8');

describe('la caja del tablero no suma dólares como si fueran pesos', () => {
  it('el groupBy de MovimientoCaja filtra por moneda', () => {
    const src = api('routes/metricas.ts');
    const bloque = src.slice(src.indexOf('movimientoCaja.groupBy'));
    const where = bloque.slice(bloque.indexOf('where:'), bloque.indexOf('_sum:'));

    // El endpoint entero se rotula `moneda: 'ARS'`; el where tiene que decir lo mismo.
    expect(where).toContain("moneda: 'ARS'");
  });

  it('la respuesta sigue rotulada en ARS (si esto cambia, el filtro de arriba ya no alcanza)', () => {
    expect(api('routes/metricas.ts')).toContain("moneda: 'ARS',");
  });

  it('el aviso de otras monedas mira también los movimientos, no sólo los contratos', () => {
    const src = api('routes/metricas.ts');

    // Con el filtro puesto, un movimiento en USD queda FUERA del neto. Excluir en silencio
    // es tan engañoso como sumar mal: el cartel tiene que prenderse igual.
    expect(src).toContain('movimientosOtraMoneda');
    expect(src).toContain('contratosOtraMoneda > 0 || movimientosOtraMoneda > 0');
  });
});

describe('cobrar un cargo al inquilino registra la moneda del cargo', () => {
  it('el MovimientoCaja del cargo saldado escribe moneda: cargo.moneda', () => {
    const src = api('routes/plata.ts');
    const i = src.indexOf('Cobro de cargo al inquilino');
    expect(i).toBeGreaterThan(0);

    // La ventana del create que sigue a esa descripción.
    const create = src.slice(i, i + 900);

    // `MovimientoCaja.moneda` es @default(ARS): omitirla NO fallaba, escribía ARS igual.
    // Un cargo de US$800 quedaba en caja como $800 y después nadie podía notarlo, porque
    // la fila ya no dice de dónde vino.
    expect(create).toContain('moneda: cargo.moneda');
  });
});
