import { describe, expect, it } from 'vitest';
import { normalizarDni } from '../src/lib/normalizar-dni.js';

/**
 * Test PURO (sin DB).
 *
 * `Persona.dni` es la llave con la que se decide si dos contratos son de la misma persona. Si
 * lo guardado y lo buscado no tienen la misma forma, la dedup falla en silencio y se crean
 * fichas duplicadas — y desde T-24-N2, la ausencia del cartel "ya está en tu cartera" se lee
 * como "no está", que es una afirmación falsa.
 *
 * Cada caso es un formato que aparece de verdad en una planilla argentina.
 */
describe('normalizarDni', () => {
  it('saca los puntos: es el formato en el que viene cualquier Excel', () => {
    expect(normalizarDni('20.123.456')).toBe('20123456');
    expect(normalizarDni('7.654.321')).toBe('7654321');
  });

  it('saca guiones y espacios', () => {
    expect(normalizarDni('20-123-456')).toBe('20123456');
    expect(normalizarDni('20 123 456')).toBe('20123456');
    expect(normalizarDni('  20123456  ')).toBe('20123456');
  });

  it('el mismo documento escrito de cinco formas da UN solo valor', () => {
    // Esto es lo que arregla la dedup: las cinco filas son la misma persona.
    const formas = ['20123456', '20.123.456', '20-123-456', ' 20 123 456 ', 'DNI 20.123.456'];
    const normalizados = new Set(formas.map((f) => normalizarDni(f)));
    expect(normalizados.size).toBe(1);
    expect([...normalizados][0]).toBe('20123456');
  });

  it('es idempotente: la migración de backfill puede correrse dos veces', () => {
    expect(normalizarDni(normalizarDni('20.123.456'))).toBe('20123456');
  });

  it('sin documento devuelve null, NUNCA cadena vacía', () => {
    // `@@unique([inmobiliariaId, dni])` trata los NULL como distintos entre sí, así que muchas
    // personas sin documento conviven. Un `''` sería un valor real y la segunda reventaría.
    expect(normalizarDni(undefined)).toBeNull();
    expect(normalizarDni(null)).toBeNull();
    expect(normalizarDni('')).toBeNull();
    expect(normalizarDni('   ')).toBeNull();
    expect(normalizarDni('sin datos')).toBeNull();
    expect(normalizarDni('-')).toBeNull();
  });

  it('NO recorta un CUIT a su DNI: sería adivinar y podría fusionar dos personas', () => {
    // La importación acepta `cuit`/`cuil` como sinónimos de esta columna, así que conviven
    // los dos largos. Unificarlos es una decisión de producto, no de este helper.
    expect(normalizarDni('20-12345678-9')).toBe('20123456789');
    expect(normalizarDni('27123456784')).toBe('27123456784');
  });
});
