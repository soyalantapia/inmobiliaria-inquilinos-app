import { describe, it, expect } from 'vitest';
import { componerDeposito } from '../src/lib/deposito.js';

/**
 * Tests PUROS (sin DB) de la aritmética del depósito de garantía.
 *
 * Esta cuenta vivía duplicada en tres lugares y sólo uno la hacía bien:
 * /depositos/en-custodia restaba las reparaciones imputadas, mientras que
 * finalizar-preview y deposito/resolver usaban el BRUTO. Resultado: el diálogo de
 * rescisión mostraba más depósito del que había, y se podía devolver el 100% teniendo
 * arreglos ya imputados contra él. Ahora la cuenta es una sola función y esto la fija.
 */
describe('componerDeposito', () => {
  it('sin deducciones, el disponible es el depósito entero', () => {
    expect(componerDeposito(100_000, 0)).toEqual({
      bruto: 100_000,
      deducciones: 0,
      disponible: 100_000,
      excedente: 0,
    });
  });

  it('descuenta las reparaciones imputadas al depósito', () => {
    // El caso que rompía: devolver 100.000 teniendo 30.000 en arreglos imputados.
    expect(componerDeposito(100_000, 30_000)).toEqual({
      bruto: 100_000,
      deducciones: 30_000,
      disponible: 70_000,
      excedente: 0,
    });
  });

  it('deducciones iguales al depósito → no queda nada para devolver', () => {
    const d = componerDeposito(100_000, 100_000);
    expect(d.disponible).toBe(0);
    expect(d.excedente).toBe(0);
  });

  it('deducciones MAYORES al depósito: disponible 0 y el resto queda expuesto como excedente', () => {
    // Antes ese excedente se evaporaba: el disponible se clampeaba a 0 y nadie registraba
    // que quedaban $20.000 de reparaciones sin cubrir.
    expect(componerDeposito(100_000, 120_000)).toEqual({
      bruto: 100_000,
      deducciones: 120_000,
      disponible: 0,
      excedente: 20_000,
    });
  });

  it('contrato sin depósito cargado', () => {
    expect(componerDeposito(0, 0)).toEqual({ bruto: 0, deducciones: 0, disponible: 0, excedente: 0 });
  });

  it('redondea a centavos (los Decimal viajan como Number)', () => {
    const d = componerDeposito(100_000.555, 30_000.114);
    expect(d.bruto).toBe(100_000.56);
    expect(d.deducciones).toBe(30_000.11);
    expect(d.disponible).toBe(70_000.45);
  });

  it('el total de una cartera cuadra con la suma de los disponibles por contrato', () => {
    // Es el invariante que rompía el listado: el total por moneda hacía
    // `Σbruto − Σdeducciones`, que con un contrato sobre-deducido no coincide con
    // `Σ disponible` de las filas mostradas.
    const contratos = [
      componerDeposito(100_000, 30_000), // 70.000
      componerDeposito(50_000, 80_000), // 0 (y 30.000 de excedente)
      componerDeposito(200_000, 0), // 200.000
    ];
    const sumaFilas = contratos.reduce((s, c) => s + c.disponible, 0);
    expect(sumaFilas).toBe(270_000);
    // La cuenta vieja habría dado 240.000 y no cuadraría con lo que ve el usuario.
    const cuentaVieja = contratos.reduce((s, c) => s + c.bruto - c.deducciones, 0);
    expect(cuentaVieja).not.toBe(sumaFilas);
    expect(contratos.reduce((s, c) => s + c.excedente, 0)).toBe(30_000);
  });
});
