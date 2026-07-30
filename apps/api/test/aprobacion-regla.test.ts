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

  it('LECTURA falla CERRADO: no tiene permiso de cargar contratos, así que queda pendiente pase lo que pase', () => {
    // LECTURA no está en `roles` de `contratos.crear` — no puede cargar contratos.
    // Si por un bug futuro igual llegara a crear uno, la regla no debe activarlo
    // solo: debe quedar pendiente tanto con el flag apagado como prendido.
    expect(contratoQuedaPendiente('LECTURA', false)).toBe(true);
    expect(contratoQuedaPendiente('LECTURA', true)).toBe(true);
  });
});
