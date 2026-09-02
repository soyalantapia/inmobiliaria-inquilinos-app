/**
 * «8,5» se guardaba como 85.
 *
 * El campo de comisión del alta filtraba con `replace(/[^\d.]/g, '')`, que deja pasar el punto y
 * **borra la coma**. En Argentina el decimal se escribe con coma, así que el modo natural de
 * tipear era justo el que fallaba: quien escribía «8,5» guardaba **85** — diez veces la comisión,
 * sin un error a la vista y sin nada que se pusiera rojo.
 *
 * Salió de revisar los PRs de julio que quedaban abiertos: estaba enterrado adentro de #39, un PR
 * de 700 líneas que como conjunto ya no se puede rebasar.
 */
import { describe, it, expect } from 'vitest';
import { numeroTipeado } from './numero-tipeado';

describe('un número tipeado por una persona', () => {
  it('🔴 la coma es un separador decimal, no basura que se borra', () => {
    // Con el bug: '85'.
    expect(numeroTipeado('8,5')).toBe('8.5');
    expect(numeroTipeado('12,75')).toBe('12.75');
    expect(numeroTipeado('0,5')).toBe('0.5');
  });

  it('el punto sigue funcionando igual que antes', () => {
    expect(numeroTipeado('8.5')).toBe('8.5');
    expect(numeroTipeado('8')).toBe('8');
  });

  it('las letras y los símbolos se siguen filtrando', () => {
    expect(numeroTipeado('8%')).toBe('8');
    expect(numeroTipeado('$8,5')).toBe('8.5');
    expect(numeroTipeado('abc')).toBe('');
  });

  it('dos separadores son un tipeo, no un número: se queda con el primero', () => {
    // Sin esto, '8.5.2' llega a `Number()` como NaN y el campo se guarda vacío en silencio.
    expect(numeroTipeado('8.5.2')).toBe('8.52');
    expect(numeroTipeado('8,5,2')).toBe('8.52');
  });

  it('respeta el tope de largo del campo', () => {
    expect(numeroTipeado('123456789')).toBe('12345');
    expect(numeroTipeado('1,23456', 5)).toBe('1.234');
  });

  it('el vacío sigue siendo vacío: dejar la comisión en blanco es válido', () => {
    // El alta no manda el campo si está vacío; convertirlo en '0' cambiaría el significado.
    expect(numeroTipeado('')).toBe('');
  });
});
