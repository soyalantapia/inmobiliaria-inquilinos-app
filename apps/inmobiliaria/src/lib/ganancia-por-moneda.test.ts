/**
 * La card de ganancia decía «Proyección total» y mostraba una sola moneda.
 *
 * El endpoint devuelve `total` = el de la moneda PRINCIPAL, no la suma —hay un test de la API
 * que lo afirma con un `not.toBeCloseTo`—. La card lo pintaba igual, con la palabra «total»
 * al lado. Una propiedad alquilada primero en pesos y después en dólares mostraba la comisión
 * de una sola de las dos: un número creíble y corto, sin nada que avise.
 */
import { describe, it, expect } from 'vitest';
import { gananciaParaMostrar } from './ganancia-por-moneda';

describe('la ganancia de una propiedad con dos monedas', () => {
  const dosMonedas = [
    { moneda: 'ARS' as const, ganado: 1_200_000, proyeccion: 1_800_000 },
    { moneda: 'USD' as const, ganado: 800, proyeccion: 1_200 },
  ];

  it('🔴 muestra LAS DOS, no la principal sola', () => {
    const { ganado } = gananciaParaMostrar(dosMonedas);
    // Con el bug se leía sólo el renglón de pesos.
    expect(ganado).toContain('US$');
    expect(ganado).toContain('1.200.000');
    expect(ganado).toContain('800');
  });

  it('🔴 y no las suma en un número inventado', () => {
    // 1.200.000 + 800 = 1.200.800. Ese número no existe: no hay cotización en el sistema.
    expect(gananciaParaMostrar(dosMonedas).ganado).not.toContain('1.200.800');
  });

  it('ganado y proyección no se cruzan', () => {
    // Los dos campos son `number`: el tipo no atrapa el mapeo cambiado. Acá sí.
    const { ganado, proyeccion } = gananciaParaMostrar(dosMonedas);
    expect(ganado).toContain('1.200.000');
    expect(ganado).not.toContain('1.800.000');
    expect(proyeccion).toContain('1.800.000');
    expect(proyeccion).toContain('1.200');
  });

  it('CONTROL POSITIVO — con una sola moneda se ve igual que antes', () => {
    const { ganado, proyeccion } = gananciaParaMostrar([
      { moneda: 'ARS', ganado: 1_200_000, proyeccion: 1_800_000 },
    ]);
    expect(ganado).not.toContain('·');
    expect(ganado).toContain('1.200.000');
    expect(proyeccion).toContain('1.800.000');
  });

  it('una propiedad sin nada ganado no rompe la card', () => {
    const { ganado } = gananciaParaMostrar([]);
    expect(ganado).toContain('0');
  });
});
