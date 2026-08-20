import { describe, expect, it } from 'vitest';
import { parteRendible } from '../src/lib/parte-rendible.js';

/**
 * Test PURO (sin DB) de la aritmética de los dos topes de la rendición.
 *
 * Los tres descuentos —gastos de caja, reclamos, ingresos extra— hacían esta cuenta copiada, y
 * los ingresos se habían quedado sin el tope global. Estos casos fijan el invariante que eso
 * rompía: **nada se rinde más de una vez, ni por dueño ni en total.**
 *
 * Los tests que cubrían esto eran de integración (`rendicion-multiowner`,
 * `rendicion-reclamo-multiduenio`) y pegan a la Postgres de producción, así que no se pueden
 * correr en el día a día. Esto sí.
 */
describe('parteRendible · dueño único', () => {
  it('la primera vez se lleva todo', () => {
    expect(parteRendible({ montoTotal: 100, porcentaje: 100, yaRendidoPorMi: 0, yaRendidoGlobal: 0 })).toBe(100);
  });

  it('si ya se le rindió, no se le rinde de nuevo', () => {
    expect(parteRendible({ montoTotal: 100, porcentaje: 100, yaRendidoPorMi: 100, yaRendidoGlobal: 100 })).toBe(0);
  });

  it('rendido a medias: se lleva sólo lo que falta', () => {
    expect(parteRendible({ montoTotal: 100, porcentaje: 100, yaRendidoPorMi: 40, yaRendidoGlobal: 40 })).toBe(60);
  });
});

describe('parteRendible · co-dueños', () => {
  it('cada uno se lleva su porcentaje', () => {
    expect(parteRendible({ montoTotal: 100, porcentaje: 50, yaRendidoPorMi: 0, yaRendidoGlobal: 0 })).toBe(50);
    expect(parteRendible({ montoTotal: 100, porcentaje: 50, yaRendidoPorMi: 0, yaRendidoGlobal: 50 })).toBe(50);
  });

  it('el tope GLOBAL frena el doble pago cuando cambian las participaciones', () => {
    // El caso real que faltaba en los ingresos: A(50%) ya rindió sus $50. Después se re-arma
    // la participación y B pasa a 100%. Sin tope global, B se llevaba $100 → $150 sobre $100.
    const b = parteRendible({ montoTotal: 100, porcentaje: 100, yaRendidoPorMi: 0, yaRendidoGlobal: 50 });
    expect(b).toBe(50);
    expect(50 + b).toBe(100); // nunca más que el total
  });

  it('el tope POR DUEÑO frena que uno se lleve la parte del otro', () => {
    // Sin el cap por dueño, A(50%) podría llevarse los $100 completos porque globalmente
    // "queda todo": el que protege el reparto entre co-dueños es este, no el global.
    expect(parteRendible({ montoTotal: 100, porcentaje: 50, yaRendidoPorMi: 50, yaRendidoGlobal: 50 })).toBe(0);
  });

  it('los dos topes juntos: la suma entre todos nunca pasa el total', () => {
    // Tres dueños al 33/33/34 rindiendo en tandas distintas.
    let global = 0;
    for (const pct of [33, 33, 34]) {
      const parte = parteRendible({ montoTotal: 900, porcentaje: pct, yaRendidoPorMi: 0, yaRendidoGlobal: global });
      global += parte;
    }
    expect(global).toBeCloseTo(900, 6);
  });
});

describe('parteRendible · bordes que no pueden devolver plata de más', () => {
  it('nunca devuelve negativo, aunque el reparto haya cambiado a la baja', () => {
    // A tenía 100% y rindió $100; después pasa a 50%. `leToca` (50) − yaRendido (100) = −50.
    // Un negativo acá SUMARÍA al neto del dueño: le estaríamos pagando por un gasto.
    expect(parteRendible({ montoTotal: 100, porcentaje: 50, yaRendidoPorMi: 100, yaRendidoGlobal: 100 })).toBe(0);
  });

  it('si el global ya está pasado, tampoco devuelve negativo', () => {
    expect(parteRendible({ montoTotal: 100, porcentaje: 100, yaRendidoPorMi: 0, yaRendidoGlobal: 150 })).toBe(0);
  });

  it('monto 0 no genera nada', () => {
    expect(parteRendible({ montoTotal: 0, porcentaje: 100, yaRendidoPorMi: 0, yaRendidoGlobal: 0 })).toBe(0);
  });
});
