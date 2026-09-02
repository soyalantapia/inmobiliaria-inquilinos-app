/**
 * Una unidad con deuda cargada no dice "Al día".
 *
 * De la auditoría del 31/08. `UnidadFuncional.estado` se carga a mano y el diálogo del panel no
 * tenía ningún control para elegirlo: toda unidad creada en producción nacía —y quedaba— con el
 * default `AL_DIA` de Prisma. `PENDIENTE`, `VENCIDO` y `CON_PLAN_PAGO` eran **inalcanzables**;
 * sólo aparecían en los datos sembrados de la demo, que es lo que hacía que el defecto fuera
 * invisible mostrando el producto.
 *
 * El síntoma en pantalla: la fila de la unidad "3°B" mostraba **$50.000 en ámbar** en la columna
 * de saldo y, al lado, un badge **verde "Al día"**. La tarjeta de morosidad de arriba, que sí usa
 * `saldoDeudor`, la contaba bien como morosa. La fila se contradecía sola.
 */
import { describe, it, expect } from 'vitest';
import { ESTADO_UF_LABEL, estadoUfVisible } from './consorcios-storage';

describe('el estado que se muestra de una unidad', () => {
  it('🔴 con deuda cargada NO dice "Al día", aunque el enum diga eso', () => {
    expect(estadoUfVisible({ estado: 'AL_DIA', saldoDeudor: 50_000 })).toBe('VENCIDO');
  });

  it('sin deuda sí dice "Al día"', () => {
    expect(estadoUfVisible({ estado: 'AL_DIA', saldoDeudor: 0 })).toBe('AL_DIA');
  });

  it('los otros tres estados se respetan tal cual: el operador sabe algo que el saldo no', () => {
    // `CON_PLAN_PAGO` es el caso que justifica que el campo siga siendo editable: una unidad
    // que debe pero arregló cómo pagar no es lo mismo que una vencida, y eso el saldo no lo
    // puede decir.
    expect(estadoUfVisible({ estado: 'CON_PLAN_PAGO', saldoDeudor: 80_000 })).toBe('CON_PLAN_PAGO');
    expect(estadoUfVisible({ estado: 'PENDIENTE', saldoDeudor: 10_000 })).toBe('PENDIENTE');
    expect(estadoUfVisible({ estado: 'VENCIDO', saldoDeudor: 10_000 })).toBe('VENCIDO');
  });

  it('un saldo negativo (a favor de la unidad) tampoco la pone en mora', () => {
    // Defensivo: el campo es un Decimal y nada impide un valor negativo. "Debe menos que cero"
    // no es deuda.
    expect(estadoUfVisible({ estado: 'AL_DIA', saldoDeudor: -5_000 })).toBe('AL_DIA');
  });

  it('los cuatro estados tienen rótulo: el select los ofrece todos', () => {
    // El diálogo arma sus opciones con `Object.keys(ESTADO_UF_LABEL)`. Si mañana el enum crece
    // y el rótulo no, la opción nueva desaparece del formulario sin que nadie lo note.
    expect(Object.keys(ESTADO_UF_LABEL).sort()).toEqual(['AL_DIA', 'CON_PLAN_PAGO', 'PENDIENTE', 'VENCIDO']);
  });

  it('🔴 sin deuda NO dice "Vencido", aunque el enum diga eso — la contradicción al revés', () => {
    // Alcanzable desde que el diálogo deja elegir el estado: se marca VENCIDO a mano, la
    // unidad paga, y el saldo queda en 0. La fila mostraba «—» y un badge rojo al lado.
    expect(estadoUfVisible({ estado: 'VENCIDO', saldoDeudor: 0 })).toBe('AL_DIA');
    expect(estadoUfVisible({ estado: 'PENDIENTE', saldoDeudor: 0 })).toBe('AL_DIA');
    // Un plan de pago sin saldo es un plan que ya se cumplió.
    expect(estadoUfVisible({ estado: 'CON_PLAN_PAGO', saldoDeudor: 0 })).toBe('AL_DIA');
  });

  it('y un saldo a favor tampoco sostiene un estado de mora', () => {
    expect(estadoUfVisible({ estado: 'VENCIDO', saldoDeudor: -5_000 })).toBe('AL_DIA');
  });

  it('el control que le da sentido: la regla vieja mostraba el enum crudo', () => {
    const viejo = (u: { estado: string }) => u.estado;
    const conDeuda = { estado: 'AL_DIA' as const, saldoDeudor: 50_000 };
    expect(viejo(conDeuda)).toBe('AL_DIA'); // ← el badge verde al lado del saldo en ámbar
    expect(estadoUfVisible(conDeuda)).toBe('VENCIDO');
  });
});
