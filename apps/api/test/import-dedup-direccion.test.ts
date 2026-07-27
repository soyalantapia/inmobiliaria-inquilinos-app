import { describe, it, expect } from 'vitest';
import { validarFila, normalizarDireccion, type FilaMapeada } from '../src/lib/importacion-cartera.js';

// CAZABUG P1 — la importación de cartera marcaba DUPLICADO sólo por email del inquilino,
// pero el email es OPCIONAL (las filas sin email se importan con una ADVERTENCIA) y el
// alta siempre hace propiedad.create, nunca busca una existente. Re-subir la misma
// planilla duplicaba propiedades, inquilinos y contratos con sus liquidaciones.
// Fix: dedup también por DIRECCIÓN normalizada (la clave natural de una cartera).

const base: FilaMapeada = {
  direccion: 'Av. Colón 1234',
  ciudad: 'Córdoba',
  provincia: 'Córdoba',
  tipo: 'DEPARTAMENTO',
  inquilinoNombre: 'Juan',
  inquilinoApellido: 'Pérez',
  inquilinoEmail: 'juan.perez@mail.com',
  inquilinoTelefono: '351 555 1234',
  inquilinoDni: '30111222',
  propietarioNombre: 'Ana Gómez',
  monto: 150000,
  moneda: 'ARS',
  fechaInicio: new Date('2026-01-01'),
  fechaFin: new Date('2027-12-31'),
  diaPago: 10,
};
const sinEmail: FilaMapeada = { ...base, inquilinoEmail: null };

describe('CAZABUG — dedup de importación por dirección', () => {
  it('normaliza la dirección (mayúsculas, puntos y espacios de más)', () => {
    expect(normalizarDireccion('Av. Colón 1234')).toBe(normalizarDireccion('av  colon 1234'));
    expect(normalizarDireccion('Av. Colón 1234')).not.toBe(normalizarDireccion('Av. Colón 1235'));
  });

  it('una fila SIN email cuya dirección ya existe se marca DUPLICADO', () => {
    const dirs = new Set([normalizarDireccion('Av. Colón 1234')]);
    const v = validarFila(sinEmail, new Set(), dirs);
    expect(v.estado).toBe('DUPLICADO'); // antes: ADVERTENCIA → se importaba de nuevo
    expect(v.motivo).toMatch(/dirección/i);
  });

  it('la misma dirección escrita distinto también se detecta', () => {
    const dirs = new Set([normalizarDireccion('av colon  1234')]);
    expect(validarFila(sinEmail, new Set(), dirs).estado).toBe('DUPLICADO');
  });

  it('una dirección nueva pasa (sin email queda ADVERTENCIA, como antes)', () => {
    const dirs = new Set([normalizarDireccion('Otra Calle 999')]);
    expect(validarFila(sinEmail, new Set(), dirs).estado).toBe('ADVERTENCIA');
  });

  it('sin el set de direcciones el comportamiento previo se mantiene (compatible)', () => {
    expect(validarFila(base, new Set()).estado).toBe('OK');
  });

  it('el dedup por email sigue funcionando', () => {
    const v = validarFila(base, new Set(['juan.perez@mail.com']));
    expect(v.estado).toBe('DUPLICADO');
    expect(v.motivo).toMatch(/email/i);
  });
});
