/**
 * El resumen "te depositamos en <año>" — la cuenta que el dueño le lleva al contador.
 *
 * Estos ocho casos se venían corriendo a mano con un script suelto porque el front no tenía
 * runner. Con T-32 ya lo hay, así que quedan como guard: si alguien vuelve a sumar monedas
 * distintas, esto se pone rojo.
 */
import { describe, it, expect } from 'vitest';
import { cortarPorMoneda } from './resumen-pagos';
import type { RendicionPortal } from '@/lib/api';

const R = (moneda: 'ARS' | 'USD', teDepositamos: number, rendidoAt: string, periodo: string): RendicionPortal =>
  ({ moneda, teDepositamos, rendidoAt, periodo } as RendicionPortal);

describe('cortarPorMoneda', () => {
  it('NO suma monedas distintas: cada una es un corte', () => {
    // Es lo que motivó persistir `Rendicion.moneda`. Un dueño con una unidad en pesos y otra
    // en dólares no puede ver los dos montos sumados en un número que no existe.
    const c = cortarPorMoneda([R('ARS', 100000, '2026-05-10', '2026-04'), R('USD', 500, '2026-06-10', '2026-05')], 2026);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ moneda: 'ARS' });
    expect(c[0].esteAnio.total).toBe(100000);
    expect(c[1].esteAnio.total).toBe(500);
  });

  it('los pesos van primero: es la moneda del 99% de los contratos', () => {
    const c = cortarPorMoneda([R('USD', 500, '2026-06-10', '2026-05'), R('ARS', 1, '2026-06-10', '2026-05')], 2026);
    expect(c[0].moneda).toBe('ARS');
  });

  it('el eje es la fecha de DEPÓSITO, no el período liquidado', () => {
    // "Cuánto me entró en 2026" es una pregunta de caja: un período de diciembre rendido en
    // enero cuenta en enero, que es cuando la plata se movió. Es lo que le sirve al contador.
    const c = cortarPorMoneda([R('ARS', 50000, '2026-01-15', '2025-12')], 2026);
    expect(c[0].esteAnio.total).toBe(50000);
    expect(c[0].anteriores.cantidad).toBe(0);
  });

  it('separa este año de los anteriores, con su cantidad', () => {
    const c = cortarPorMoneda(
      [R('ARS', 10000, '2026-03-01', '2026-02'), R('ARS', 90000, '2025-03-01', '2025-02')],
      2026,
    );
    expect(c[0].esteAnio).toEqual({ total: 10000, cantidad: 1 });
    expect(c[0].anteriores).toEqual({ total: 90000, cantidad: 1 });
  });

  it('una rendición sin moneda (fila vieja, anterior a la migración) cae en pesos y no rompe', () => {
    const c = cortarPorMoneda([{ teDepositamos: 1, rendidoAt: '2026-05-01', periodo: '2026-04' } as RendicionPortal], 2026);
    expect(c[0].moneda).toBe('ARS');
  });

  it('los centavos no acumulan basura de float', () => {
    const c = cortarPorMoneda([R('ARS', 0.1, '2026-05-01', '2026-04'), R('ARS', 0.2, '2026-05-02', '2026-04')], 2026);
    expect(c[0].esteAnio.total).toBe(0.3);
  });

  it('sin rendiciones no devuelve nada, y la sección no se pinta', () => {
    expect(cortarPorMoneda([], 2026)).toEqual([]);
  });

  it('la última es la primera de la lista: viene ordenada de la más nueva a la más vieja', () => {
    const c = cortarPorMoneda([R('ARS', 1, '2026-06-10', '2026-05'), R('ARS', 1, '2026-05-10', '2026-04')], 2026);
    expect(c[0].ultima).toBe('2026-05');
  });

  it('«la última» nombra un período del año de la tarjeta, no de uno anterior', () => {
    // El rótulo vive abajo de "Te depositamos en 2026". Si la única rendición es de 2025,
    // decía "la última, diciembre 2025" pegado a un total de 2026 que es cero.
    const c = cortarPorMoneda([R('ARS', 90000, '2025-12-10', '2025-11')], 2026);
    expect(c[0].esteAnio.cantidad).toBe(0);
    expect(c[0].ultima).toBeNull();
  });
});
