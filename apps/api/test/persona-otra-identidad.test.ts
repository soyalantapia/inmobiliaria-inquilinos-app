import { describe, it, expect } from 'vitest';
import { esOtraPersona } from '../src/lib/persona.js';

/**
 * CAZABUG — dos personas distintas quedaban bajo una sola identidad, en silencio.
 *
 * `buscarOCrearPersona` devuelve la Persona existente cuando el email coincide y el DNI no. Es
 * deliberado y lo necesita la importación de cartera (reventar a mitad de 2000 filas deja la
 * carga hecha a medias en la cuenta real del cliente). Pero ese helper se compartió con el alta
 * manual, y ahí `POST /contratos` ya prometía un 409 —"Ese email ya lo usa otra persona en tu
 * cartera"— confiando en que saltara el unique de Persona. Al no saltar nunca, el contrato
 * quedaba colgando de la persona equivocada sin que nadie se enterara.
 *
 * Apareció al correr por primera vez las suites que necesitan base: `multi-alquiler.test.ts`
 * afirmaba el 409 y recibía un 200. El test tenía razón; el código se había movido debajo.
 */
describe('esOtraPersona — cuándo bloquear un alta por identidad', () => {
  it('dos DNI distintos: es otra persona, se bloquea', () => {
    expect(esOtraPersona('40999888', '30111222')).toBe(true);
  });

  it('el mismo DNI: es el mismo inquilino con otro contrato — multi-alquiler, NO se bloquea', () => {
    // El caso que el unique de Persona rompía antes y que multi-alquiler existe para proteger.
    expect(esOtraPersona('30111222', '30111222')).toBe(false);
  });

  it('sin DNI en el alta no se afirma nada: puede ser el mismo cargado sin documento', () => {
    expect(esOtraPersona(null, '30111222')).toBe(false);
  });

  it('sin DNI en la Persona tampoco: es justo el dato que esta alta viene a aportar', () => {
    // buscarOCrearPersona completa el DNI en ese caso; bloquear sería impedir que lo complete.
    expect(esOtraPersona('40999888', null)).toBe(false);
  });

  it('sin ninguno de los dos: no hay con qué comparar', () => {
    expect(esOtraPersona(null, null)).toBe(false);
  });
});
