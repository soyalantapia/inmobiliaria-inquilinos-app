import { describe, it, expect } from 'vitest';
import { contratoQuedaPendiente } from '@llave/shared';

/**
 * La regla del disparador de aprobación. Es PURA (sin DB) a propósito: es la
 * decisión de negocio y tiene que poder testearse sin levantar nada.
 */
describe('contratoQuedaPendiente', () => {
  it('CARGA siempre queda pendiente, aunque el flag esté apagado (baseline del catálogo)', () => {
    expect(contratoQuedaPendiente('CARGA', false)).toBe(true);
    expect(contratoQuedaPendiente('CARGA', true)).toBe(true);
  });

  it('OPERADOR queda pendiente SOLO si la inmobiliaria lo pidió', () => {
    expect(contratoQuedaPendiente('OPERADOR', false)).toBe(false); // comportamiento de hoy
    expect(contratoQuedaPendiente('OPERADOR', true)).toBe(true);
  });

  it('ADMIN nunca queda pendiente: puede aprobar, así que no necesita aprobación', () => {
    expect(contratoQuedaPendiente('ADMIN', false)).toBe(false);
    expect(contratoQuedaPendiente('ADMIN', true)).toBe(false);
  });

  it('con el flag prendido y un solo ADMIN, no hay lockout posible', () => {
    // Si el único usuario que puede cargar es ADMIN y ADMIN está exento,
    // prender el flag nunca deja a la inmobiliaria sin poder dar de alta.
    expect(contratoQuedaPendiente('ADMIN', true)).toBe(false);
  });
});
