/**
 * T-23-N3 · La cuenta que traba el cambio de reparto de dueños.
 *
 * El caso real: una propiedad tiene alquiler cobrado que todavía no se le rindió a nadie, y
 * alguien edita quiénes son los dueños. La rendición decide a quién le transfiere leyendo la
 * participación de HOY, pero el período que se rinde lo elige el operador y puede ser de hace
 * dos años: el dueño entrante se lleva la plata del mes del saliente, y el saliente, al borrarse
 * su fila, desaparece del universo de la rendición y no hay forma de rendirle lo suyo.
 *
 * `calcularPendienteSinRendir` es la cuenta que decide si el cambio se bloquea. Estos tests son
 * sobre esa función pura: no tocan la base ni la red.
 *
 * La aritmética TIENE que coincidir con el paso BRUTO de `POST /rendiciones` (plata.ts). Si
 * divergiera, el guard bloquearía por plata que la rendición no rinde —o, peor, dejaría pasar
 * plata que sí rinde.
 */
import { describe, it, expect } from 'vitest';
import { calcularPendienteSinRendir, type LiquidacionParaPendiente } from '../src/lib/rendicion-pendiente';

const liq = (
  id: string,
  periodo: string,
  montoAlquiler: number,
  montoTotal: number,
): LiquidacionParaPendiente => ({ id, periodo, montoAlquiler, montoTotal });

const mapa = (o: Record<string, number>) => new Map(Object.entries(o));

describe('calcularPendienteSinRendir', () => {
  it('sin liquidaciones no hay nada pendiente', () => {
    expect(calcularPendienteSinRendir([], mapa({}), mapa({}))).toEqual({ total: 0, periodos: [] });
  });

  it('una liquidación cobrada y nunca rendida: pendiente el alquiler entero', () => {
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-03', 300000, 300000)],
      mapa({ l1: 300000 }),
      mapa({}),
    );
    expect(r.total).toBe(300000);
    expect(r.periodos).toEqual([{ periodo: '2026-03', monto: 300000 }]);
  });

  it('cobrada y ya rendida entera: no traba nada', () => {
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-03', 300000, 300000)],
      mapa({ l1: 300000 }),
      mapa({ l1: 300000 }),
    );
    expect(r).toEqual({ total: 0, periodos: [] });
  });

  it('rendida a medias: queda pendiente sólo el resto', () => {
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-03', 300000, 300000)],
      mapa({ l1: 300000 }),
      mapa({ l1: 120000 }),
    );
    expect(r.total).toBe(180000);
  });

  it('una liquidación sin cobrar no cuenta, aunque exista', () => {
    const r = calcularPendienteSinRendir([liq('l1', '2026-03', 300000, 300000)], mapa({}), mapa({}));
    expect(r).toEqual({ total: 0, periodos: [] });
  });

  it('LAS EXPENSAS NO SE RINDEN: se prorratea por montoAlquiler/montoTotal', () => {
    // $300.000 de alquiler + $100.000 de expensas. El inquilino pagó todo.
    // Al dueño le corresponde el alquiler; las expensas van al consorcio.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-03', 300000, 400000)],
      mapa({ l1: 400000 }),
      mapa({}),
    );
    expect(r.total).toBe(300000);
  });

  it('LA MORA NO SE RINDE: el cobrado se capea a montoTotal', () => {
    // Pagó $420.000 sobre una liquidación de $400.000 (los $20.000 son punitorios).
    // Sin el cap, la porción de alquiler daría más que el alquiler mismo.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-03', 300000, 400000)],
      mapa({ l1: 420000 }),
      mapa({}),
    );
    expect(r.total).toBe(300000);
  });

  it('un pago parcial rinde su parte proporcional de alquiler', () => {
    // Pagó la mitad de una liquidación con expensas: le toca la mitad del alquiler.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-03', 300000, 400000)],
      mapa({ l1: 200000 }),
      mapa({}),
    );
    expect(r.total).toBe(150000);
  });

  it('suma varios períodos y los devuelve ordenados cronológicamente', () => {
    const r = calcularPendienteSinRendir(
      [
        liq('l3', '2026-05', 100000, 100000),
        liq('l1', '2026-03', 100000, 100000),
        liq('l2', '2026-04', 100000, 100000),
      ],
      mapa({ l1: 100000, l2: 100000, l3: 100000 }),
      mapa({}),
    );
    expect(r.total).toBe(300000);
    expect(r.periodos.map((p) => p.periodo)).toEqual(['2026-03', '2026-04', '2026-05']);
  });

  it('un resto de redondeo de un centavo NO traba el cambio de reparto', () => {
    // Es la razón de la tolerancia: sin ella, un prorrateo que deja $0,004 colgados
    // bloquearía el cambio de dueños para siempre y nadie entendería por qué.
    // Alquiler 100.000 sobre un total de 300.000: el prorrateo da 99.999,99999…
    // Se rindieron 99.999,99 y quedó un centavo colgado que no es plata de nadie.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-03', 100000, 300000)],
      mapa({ l1: 300000 }),
      mapa({ l1: 99999.99 }),
    );
    expect(r.total).toBe(0);
    expect(r.periodos).toEqual([]);
  });

  it('una liquidación de monto 0 no divide por cero', () => {
    const r = calcularPendienteSinRendir([liq('l1', '2026-03', 0, 0)], mapa({ l1: 5000 }), mapa({}));
    expect(r).toEqual({ total: 0, periodos: [] });
  });

  it('rendido de más (corrección manual) no genera pendiente negativo', () => {
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-03', 100000, 100000)],
      mapa({ l1: 100000 }),
      mapa({ l1: 150000 }),
    );
    expect(r.total).toBe(0);
  });

  it('el caso que motiva el guard: un solo período viejo sin rendir ya lo traba', () => {
    // Tres meses: dos rendidos, uno no. Alcanza el que falta para frenar el cambio de
    // reparto — es exactamente esa plata la que se le transferiría al dueño equivocado.
    const r = calcularPendienteSinRendir(
      [
        liq('l1', '2025-11', 250000, 250000),
        liq('l2', '2025-12', 250000, 250000),
        liq('l3', '2026-01', 250000, 250000),
      ],
      mapa({ l1: 250000, l2: 250000, l3: 250000 }),
      mapa({ l1: 250000, l3: 250000 }),
    );
    expect(r.total).toBe(250000);
    expect(r.periodos).toEqual([{ periodo: '2025-12', monto: 250000 }]);
  });
});
