import { describe, it, expect } from 'vitest';
import { sePuedeBorrarGastoDeCaja } from '../src/lib/borrar-gasto-caja.js';

/**
 * CAZABUG — se podía borrar un gasto que a un co-dueño ya se le había descontado.
 *
 * El candado del DELETE miraba `descontadoEnRendicion`, y ese flag no significa "no se le
 * descontó a nadie": significa "todavía no se cubrió el 100%". En multi-dueño queda en `false`
 * mientras falte alguna parte, así que el borrado pasaba con una parte ya cobrada.
 */
describe('sePuedeBorrarGastoDeCaja', () => {
  it('un gasto que nadie rindió se borra', () => {
    expect(
      sePuedeBorrarGastoDeCaja({ gastosRendidosQueLoApuntan: 0, descontadoEnRendicion: false }),
    ).toBe(true);
  });

  it('EL BUG: rendido a UNO de dos dueños, el flag sigue en false y NO se puede borrar', () => {
    // Departamento 50/50. Se rindió la mitad de Silvana; falta la del hermano, así que el
    // flag no se movió. Antes esto devolvía true y el gasto desaparecía con ella ya cobrada.
    expect(
      sePuedeBorrarGastoDeCaja({ gastosRendidosQueLoApuntan: 1, descontadoEnRendicion: false }),
    ).toBe(false);
  });

  it('rendido a los dos: tampoco, obviamente', () => {
    expect(
      sePuedeBorrarGastoDeCaja({ gastosRendidosQueLoApuntan: 2, descontadoEnRendicion: true }),
    ).toBe(false);
  });

  it('el flag sigue siendo red: marcado como cubierto sin GastoRendido tampoco se borra', () => {
    // Una fila vieja, de antes de que existiera GastoRendido para esto. No hay rastro que
    // contar, pero el flag dice que se rindió: se le cree.
    expect(
      sePuedeBorrarGastoDeCaja({ gastosRendidosQueLoApuntan: 0, descontadoEnRendicion: true }),
    ).toBe(false);
  });

  it('alcanza UN solo rastro para bloquear — no espera a que se cubra el total', () => {
    // Es la diferencia entera entre el candado viejo y el nuevo.
    const conUnaParte = sePuedeBorrarGastoDeCaja({
      gastosRendidosQueLoApuntan: 1,
      descontadoEnRendicion: false,
    });
    const soloElFlagViejo = !false; // lo que decidía antes: !descontadoEnRendicion
    expect(conUnaParte).toBe(false);
    expect(soloElFlagViejo).toBe(true);
  });
});
