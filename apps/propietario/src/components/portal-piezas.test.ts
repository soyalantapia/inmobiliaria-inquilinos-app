/**
 * El aviso de vencimiento del contrato.
 *
 * El caso que importa es el borde: comparar con `new Date()` a secas hacía que el ÚLTIMO día
 * del contrato ya contara como vencido a la mañana. El dueño abría la app el día que su
 * inquilino todavía estaba en término y leía que se le había vencido.
 */
import { describe, it, expect } from 'vitest';
import { diasHasta } from './portal-piezas';

// 19/08/2026, con hora: si la cuenta usara timestamps en vez de día civil, se rompería.
const HOY = new Date(2026, 7, 19, 15, 42);

describe('diasHasta', () => {
  it('el último día del contrato NO está vencido: da 0, no -1', () => {
    expect(diasHasta('2026-08-19', HOY)).toBe(0);
  });

  it('mañana da 1 y ayer da -1', () => {
    expect(diasHasta('2026-08-20', HOY)).toBe(1);
    expect(diasHasta('2026-08-18', HOY)).toBe(-1);
  });

  it('el borde del aviso: a 90 días entra, a 91 todavía no', () => {
    expect(diasHasta('2026-11-17', HOY)).toBe(90);
    expect(diasHasta('2026-11-18', HOY)).toBe(91);
  });

  it('cruza fin de mes y fin de año sin corrimiento', () => {
    expect(diasHasta('2026-09-01', new Date(2026, 7, 31, 23, 30))).toBe(1);
    expect(diasHasta('2027-01-01', new Date(2026, 11, 31, 1, 5))).toBe(1);
  });

  it('una fecha vacía o inválida no explota: devuelve NaN y el aviso no se pinta', () => {
    expect(Number.isNaN(diasHasta('', HOY))).toBe(true);
    expect(Number.isNaN(diasHasta('basura', HOY))).toBe(true);
  });

  it('un contrato largo da el número correcto', () => {
    expect(diasHasta('2027-03-31', HOY)).toBe(224);
  });
});
