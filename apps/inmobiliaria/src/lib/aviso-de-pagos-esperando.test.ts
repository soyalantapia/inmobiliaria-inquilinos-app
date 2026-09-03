/**
 * P2 · El cero de Caja tiene que explicarse, y no puede explicarse con un dato que no medimos.
 *
 * Los dos casos 🔴 son las dos mitades del pedido: que el aviso APAREZCA cuando hay pagos
 * esperando (sin eso, la operadora ve un cero y concluye que el pago se perdió) y que NO aparezca
 * cuando la query falló (un `[]` con error no es «bandeja vacía» — lo dice el propio hook).
 */
import { describe, it, expect } from 'vitest';
import { avisoDePagosEsperando } from './aviso-de-pagos-esperando';

describe('el aviso de pagos esperando validación', () => {
  it('🔴 con pagos esperando, dice cuántos y por qué no están en caja', () => {
    const a = avisoDePagosEsperando({ cantidad: 3, fallo: false });
    // Sin esto, la pantalla es la que vio Camila: un cero sin una sola línea que lo explique.
    expect(a).not.toBeNull();
    expect(a!.titulo).toContain('3 pagos');
    expect(a!.detalle).toMatch(/gastos/);
  });

  it('en singular no dice «1 pagos»', () => {
    expect(avisoDePagosEsperando({ cantidad: 1, fallo: false })!.titulo).toBe(
      'Hay 1 pago de un inquilino esperando que lo valides',
    );
  });

  it('🔴 si la query FALLÓ no se afirma nada, aunque venga una cantidad', () => {
    // `usePagosInformados` devuelve `pagos: []` cuando se cae, y su doc avisa: eso NO es
    // «bandeja vacía». Un aviso construido sobre ese cero sería exactamente el error que esta
    // pantalla vino a corregir, con el signo dado vuelta.
    expect(avisoDePagosEsperando({ cantidad: 0, fallo: true })).toBeNull();
    expect(avisoDePagosEsperando({ cantidad: 5, fallo: true })).toBeNull();
  });

  it('CONTROL POSITIVO — sin pagos esperando y sin error, no hay aviso', () => {
    // La bandeja vacía de verdad no necesita cartel: el empty state de la lista ya dice adónde
    // van los pagos del inquilino.
    expect(avisoDePagosEsperando({ cantidad: 0, fallo: false })).toBeNull();
  });
});
