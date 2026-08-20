/**
 * El resumen anual — la cuenta que el dueño le lleva al contador.
 *
 * Se testea `cortarAnual` y no el papel: el HTML se puede mirar, un total mal sumado no. Y en
 * este papel el error es especialmente caro porque va a una liquidación de impuestos, donde
 * nadie lo va a cruzar contra otra fuente.
 */
import { describe, it, expect } from 'vitest';
import { cortarAnual } from './imprimir-anual';
import type { RendicionPortal } from '@/lib/api';

/** Una rendición mínima: sólo lo que la cuenta mira. */
const R = (
  moneda: 'ARS' | 'USD',
  rendidoAt: string,
  periodo: string,
  n: { cobrado: number; comision: number; gastos?: number; otros?: number },
): RendicionPortal =>
  ({
    id: `r-${rendidoAt}-${moneda}`,
    moneda,
    rendidoAt,
    periodo,
    cobrado: n.cobrado,
    comision: n.comision,
    gastos: n.gastos ?? 0,
    otrosIngresos: n.otros ?? 0,
    teDepositamos: n.cobrado - n.comision - (n.gastos ?? 0) + (n.otros ?? 0),
  }) as RendicionPortal;

describe('cortarAnual', () => {
  it('el eje es la FECHA DE DEPÓSITO, no el período liquidado', () => {
    // "Cuánto me entró en 2026" es una pregunta de caja: un período de diciembre depositado
    // en enero cuenta en enero. Es el mismo criterio que la tarjeta de "te depositamos en
    // 2026" de la pantalla — si divergieran, el dueño tendría dos totales distintos delante.
    const c = cortarAnual([R('ARS', '2026-01-15', '2025-12', { cobrado: 100000, comision: 8000 })], 2026);
    expect(c).toHaveLength(1);
    expect(c[0]!.cobrado).toBe(100000);
  });

  it('lo depositado en OTRO año no entra', () => {
    expect(cortarAnual([R('ARS', '2025-06-10', '2025-05', { cobrado: 1, comision: 0 })], 2026)).toEqual([]);
  });

  it('NO suma monedas: una tabla por cada una', () => {
    // En un papel que va al contador, un total que mezcla pesos y dólares no se descubre.
    const c = cortarAnual(
      [
        R('ARS', '2026-03-10', '2026-02', { cobrado: 300000, comision: 24000 }),
        R('USD', '2026-04-10', '2026-03', { cobrado: 900, comision: 72 }),
      ],
      2026,
    );
    expect(c.map((x) => x.moneda)).toEqual(['ARS', 'USD']);
    expect(c[0]!.cobrado).toBe(300000);
    expect(c[1]!.cobrado).toBe(900);
  });

  it('las cinco columnas suman por separado, y el neto cierra', () => {
    // Es la fila de totales del papel: si una columna suma mal, el dueño declara mal.
    const c = cortarAnual(
      [
        R('ARS', '2026-02-10', '2026-01', { cobrado: 100000, comision: 8000, gastos: 5000, otros: 2000 }),
        R('ARS', '2026-03-10', '2026-02', { cobrado: 200000, comision: 16000, gastos: 1000, otros: 0 }),
      ],
      2026,
    );
    const t = c[0]!;
    expect(t.cobrado).toBe(300000);
    expect(t.comision).toBe(24000);
    expect(t.gastos).toBe(6000);
    expect(t.otrosIngresos).toBe(2000);
    expect(t.teDepositamos).toBe(272000);
    // La cuenta de memoria del dueño: cobrado − comisión − gastos + otros.
    expect(t.teDepositamos).toBe(t.cobrado - t.comision - t.gastos + t.otrosIngresos);
  });

  it('las filas van de la más vieja a la más nueva, que es como se lee un extracto', () => {
    const c = cortarAnual(
      [
        R('ARS', '2026-05-10', '2026-04', { cobrado: 1, comision: 0 }),
        R('ARS', '2026-02-10', '2026-01', { cobrado: 1, comision: 0 }),
        R('ARS', '2026-03-10', '2026-02', { cobrado: 1, comision: 0 }),
      ],
      2026,
    );
    expect(c[0]!.filas.map((r) => r.rendidoAt)).toEqual(['2026-02-10', '2026-03-10', '2026-05-10']);
  });

  it('los pesos primero, igual que en la pantalla', () => {
    const c = cortarAnual(
      [
        R('USD', '2026-04-10', '2026-03', { cobrado: 900, comision: 72 }),
        R('ARS', '2026-03-10', '2026-02', { cobrado: 1, comision: 0 }),
      ],
      2026,
    );
    expect(c[0]!.moneda).toBe('ARS');
  });

  it('una rendición sin moneda (fila vieja) cae en pesos y no rompe', () => {
    const c = cortarAnual(
      [{ id: 'x', rendidoAt: '2026-03-10', periodo: '2026-02', cobrado: 1, comision: 0, gastos: 0, otrosIngresos: 0, teDepositamos: 1 } as RendicionPortal],
      2026,
    );
    expect(c[0]!.moneda).toBe('ARS');
  });

  it('los centavos no acumulan basura de float', () => {
    // Doce rendiciones con centavos son doce sumas: sin redondear en cada paso, el total del
    // año termina en algo como 1200,0000000000002 y eso se imprime.
    const c = cortarAnual(
      [
        R('ARS', '2026-02-10', '2026-01', { cobrado: 0.1, comision: 0 }),
        R('ARS', '2026-03-10', '2026-02', { cobrado: 0.2, comision: 0 }),
      ],
      2026,
    );
    expect(c[0]!.cobrado).toBe(0.3);
  });

  it('sin rendiciones del año no devuelve nada, y el botón no se pinta', () => {
    expect(cortarAnual([], 2026)).toEqual([]);
  });
});
