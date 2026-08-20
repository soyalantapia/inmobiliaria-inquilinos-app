/**
 * Cómo se nombra una propiedad en pantalla.
 *
 * POR QUÉ MERECE UN TEST, y no es una preferencia estética. Es un pedido textual de la prueba
 * del 03/08: *"yo me guío directamente por el complejo. Nosotros cuando decimos Lourdes no le
 * decimos nunca Artigas la dirección"*. Y el archivo existe porque antes había **tres criterios
 * distintos** para lo mismo repartidos por el panel; su docblock dice que es "el único lugar
 * donde se decide el rótulo, para que no vuelva a haber tres".
 *
 * Un helper que centraliza una regla sólo sirve mientras la regla se respete. Estos tests fijan
 * la prioridad —consorcio real > complejo > dirección— para que la próxima persona que "mejore"
 * el orden tenga que decidirlo a conciencia.
 */
import { describe, it, expect } from 'vitest';
import { rotuloPrincipal, rotuloSecundario } from './rotulo-propiedad';

describe('rotuloPrincipal · la prioridad es la regla', () => {
  it('el consorcio real le gana al texto libre', () => {
    // Los dos son "el complejo", pero el consorcio es un dato administrado y `complejo` es texto
    // que alguien tipeó. Si difieren, manda el administrado.
    expect(
      rotuloPrincipal({
        direccion: 'Gorriti 4521, 3°B',
        complejo: 'Lourdes',
        consorcio: { nombre: 'Complejo Lourdes' },
      }),
    ).toBe('Complejo Lourdes');
  });

  it('sin consorcio, usa el complejo escrito a mano', () => {
    expect(rotuloPrincipal({ direccion: 'Gorriti 4521, 3°B', complejo: 'Complejo Lourdes' })).toBe(
      'Complejo Lourdes',
    );
  });

  it('sin ninguna referencia, cae a la dirección — nunca queda vacío', () => {
    expect(rotuloPrincipal({ direccion: 'Av. Cabildo 2890, 7°A' })).toBe('Av. Cabildo 2890, 7°A');
  });

  it('un complejo en blanco NO gana: cuenta como no tenerlo', () => {
    // Es el caso real de un campo opcional que quedó con espacios al importar la cartera. Sin
    // el trim, el rótulo principal sería una cadena vacía y la fila aparecería sin nombre.
    expect(rotuloPrincipal({ direccion: 'Honduras 4490, PB', complejo: '   ' })).toBe('Honduras 4490, PB');
    expect(rotuloPrincipal({ direccion: 'Honduras 4490, PB', consorcio: { nombre: '  ' } })).toBe(
      'Honduras 4490, PB',
    );
  });
});

describe('rotuloSecundario · no repetir lo que ya se dijo', () => {
  it('muestra la dirección cuando el principal es el complejo', () => {
    // La dirección real sigue haciendo falta: para el contrato, para el reclamo y para que el
    // profesional sepa a dónde ir.
    expect(
      rotuloSecundario({ direccion: 'Gorriti 4521, 3°B', complejo: 'Complejo Lourdes' }),
    ).toBe('Gorriti 4521, 3°B');
  });

  it('queda VACÍO si el principal ya es la dirección', () => {
    // Si no, la fila mostraría "Av. Cabildo 2890" dos veces, una arriba de la otra.
    expect(rotuloSecundario({ direccion: 'Av. Cabildo 2890, 7°A' })).toBe('');
  });
});
