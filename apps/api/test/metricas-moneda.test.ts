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
  it('TODOS los lugares que registran el cobro de un cargo escriben la moneda del cargo', () => {
    const src = api('routes/plata.ts');

    // Este test miraba SÓLO la primera aparición, y eso alcanzaba mientras hubo un solo lugar
    // que registraba el cobro de un cargo (`POST /cargos/:id/saldar`). Apareció un segundo
    // —`POST /contratos/:id/saldar-deuda`, que saldaba los mismos cargos y no registraba nada—,
    // y con un solo `indexOf` el test pasaba a vigilar uno y a dejar al otro sin mirar. Ahora
    // recorre todas las apariciones: si mañana aparece un tercero, entra solo.
    const marca = 'Cobro de cargo al inquilino';
    const posiciones: number[] = [];
    for (let i = src.indexOf(marca); i >= 0; i = src.indexOf(marca, i + 1)) posiciones.push(i);

    // Dos: el de `saldar` y el de `saldar-deuda`. Si baja a uno, alguien borró un registro de
    // plata; si sube, hay que confirmar que el nuevo también escriba la moneda.
    const esRegistro = (i: number) => src.slice(Math.max(0, i - 700), i).includes('movimientoCaja.create');
    const creates = posiciones.filter(esRegistro);
    expect(creates.length).toBeGreaterThanOrEqual(2);

    for (const i of posiciones) {
      // Sólo las apariciones que son un REGISTRO. La marca también aparece en `descobrar`, que
      // arma la misma descripción para BUSCAR el movimiento, no para crearlo — y ahí exigir
      // `moneda: x.moneda` no significa nada.
      //
      // ⚠️ Esa tercera aparición ya existía, y este test la daba por buena POR CASUALIDAD: la
      // ventana de 900 caracteres alcanzaba a tocar el `moneda: cargo.moneda` del `where` de la
      // búsqueda. Al crecer ese bloque (T-28-N1-N1) la ventana dejó de alcanzarlo y el test se
      // puso rojo sin que hubiera un solo registro de plata sin moneda. Un test que pasa por
      // dónde cae una ventana no está mirando lo que dice mirar.
      // El `create` está ARRIBA de la descripción (`create({ data: { … descripcion } })`), así
      // que se mira hacia atrás, no hacia adelante.
      if (!esRegistro(i)) continue;
      // La ventana del create que sigue a esa descripción.
      const create = src.slice(i, i + 900);
      // `MovimientoCaja.moneda` es @default(ARS): omitirla NO falla, escribe ARS igual. Un cargo
      // de US$800 quedaría en caja como $800 y después nadie podría notarlo, porque la fila ya
      // no dice de dónde vino. Se acepta cualquier nombre de variable —`cargo.moneda` en un
      // lugar, `c.moneda` en el otro— pero NO que falte ni que sea una constante.
      expect(create, `el create en la posición ${i} no escribe la moneda del cargo`).toMatch(
        /moneda:\s*\w+\.moneda/,
      );
    }
  });
});
