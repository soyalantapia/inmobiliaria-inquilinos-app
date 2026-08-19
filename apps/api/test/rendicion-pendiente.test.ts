import { describe, expect, it } from 'vitest';
import {
  calcularPendienteSinRendir,
  type LiquidacionParaPendiente,
} from '../src/lib/rendicion-pendiente.js';

/**
 * Tests PUROS (sin DB) del cálculo que decide si un contrato puede cambiar de modo de
 * cobranza: cuánto alquiler se cobró y todavía NO se le rindió al propietario.
 *
 * Por qué importa que estén: esa cuenta tiene que dar lo MISMO que el paso BRUTO de
 * `POST /rendiciones` (plata.ts). Si se desincronizan, el guard bloquea por plata que la
 * rendición no rinde —el operador queda trabado sin motivo— o deja pasar plata que sí
 * era rendible, y entonces al cambiar el modo esa plata sale del circuito y no hay
 * camino en el código para hacérsela llegar al dueño. Las dos reglas que replica son el
 * CAP a montoTotal (deja la mora afuera) y el PRORRATEO por montoAlquiler/montoTotal
 * (deja las expensas afuera, que van al consorcio).
 */

const liq = (
  id: string,
  periodo: string,
  montoAlquiler: number,
  montoTotal: number,
): LiquidacionParaPendiente => ({ id, periodo, montoAlquiler, montoTotal });

/** Azúcar: arma los dos Map desde objetos planos. */
const mapa = (o: Record<string, number>) => new Map(Object.entries(o));

describe('calcularPendienteSinRendir', () => {
  it('sin liquidaciones no hay nada pendiente', () => {
    expect(calcularPendienteSinRendir([], mapa({}), mapa({}))).toEqual({ total: 0, periodos: [] });
  });

  it('una liquidación sin cobros no cuenta (no hay plata que rendir)', () => {
    const r = calcularPendienteSinRendir([liq('l1', '2026-08', 500_000, 500_000)], mapa({}), mapa({}));
    expect(r).toEqual({ total: 0, periodos: [] });
  });

  it('cobrada entera y sin rendir: pendiente = el alquiler', () => {
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 500_000, 500_000)],
      mapa({ l1: 500_000 }),
      mapa({}),
    );
    expect(r.total).toBe(500_000);
    expect(r.periodos).toEqual([{ periodo: '2026-08', monto: 500_000 }]);
  });

  it('EL CAP deja la mora afuera: cobrar de más no aumenta lo rendible', () => {
    // Alquiler 500k, vence el 10, paga el 20 con 30k de mora → transfiere 530k.
    // La mora es de la inmobiliaria, no del dueño: sólo se le rinden los 500k.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 500_000, 500_000)],
      mapa({ l1: 530_000 }),
      mapa({}),
    );
    expect(r.total).toBe(500_000);
  });

  it('EL PRORRATEO deja las expensas afuera: van al consorcio, no al dueño', () => {
    // Alquiler 500k + expensas 100k = total 600k. Paga todo.
    // Rendible = 600k × (500k/600k) = 500k.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 500_000, 600_000)],
      mapa({ l1: 600_000 }),
      mapa({}),
    );
    expect(r.total).toBe(500_000);
  });

  it('pago PARCIAL: se prorratea sobre lo efectivamente cobrado', () => {
    // Mismo contrato de arriba, pero paga sólo 300k de los 600k.
    // Rendible = 300k × (500k/600k) = 250k.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 500_000, 600_000)],
      mapa({ l1: 300_000 }),
      mapa({}),
    );
    expect(r.total).toBe(250_000);
  });

  it('cap + prorrateo juntos: mora sobre un contrato con expensas', () => {
    // Alquiler 500k + expensas 100k = 600k. Paga 630k (30k de mora).
    // El cap lo baja a 600k y el prorrateo deja 500k.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 500_000, 600_000)],
      mapa({ l1: 630_000 }),
      mapa({}),
    );
    expect(r.total).toBe(500_000);
  });

  it('ya rendido del todo: no queda nada pendiente', () => {
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 500_000, 500_000)],
      mapa({ l1: 500_000 }),
      mapa({ l1: 500_000 }),
    );
    expect(r).toEqual({ total: 0, periodos: [] });
  });

  it('rendido a medias (rendición incremental): queda el remanente', () => {
    // Caso real de multi-dueño: A ya cobró su 50%, B todavía no.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 500_000, 500_000)],
      mapa({ l1: 500_000 }),
      mapa({ l1: 250_000 }),
    );
    expect(r.total).toBe(250_000);
  });

  it('rendido de MÁS no da negativo ni resta del total', () => {
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 500_000, 500_000)],
      mapa({ l1: 500_000 }),
      mapa({ l1: 600_000 }),
    );
    expect(r).toEqual({ total: 0, periodos: [] });
  });

  it('montoTotal en 0 no divide por cero ni devuelve NaN', () => {
    // Un NaN acá sería silencioso y peligroso: NaN > 0.01 es false, así que el guard
    // dejaría pasar el cambio de modo como si no hubiera plata pendiente.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 0, 0)],
      mapa({ l1: 100_000 }),
      mapa({}),
    );
    expect(r.total).toBe(0);
    expect(Number.isNaN(r.total)).toBe(false);
  });

  it('una diferencia de menos de un centavo NO traba el cambio de modo', () => {
    // El prorrateo deja restos: sin la tolerancia, un contrato quedaba bloqueado para
    // siempre por medio centavo. Es el mismo umbral que usa la rendición.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 500_000, 500_000)],
      mapa({ l1: 500_000 }),
      mapa({ l1: 499_999.995 }),
    );
    expect(r).toEqual({ total: 0, periodos: [] });
  });

  it('suma varios períodos y los devuelve ordenados cronológicamente', () => {
    const r = calcularPendienteSinRendir(
      [
        liq('l3', '2026-09', 100_000, 100_000),
        liq('l1', '2026-07', 200_000, 200_000),
        liq('l2', '2026-08', 300_000, 300_000),
      ],
      mapa({ l1: 200_000, l2: 300_000, l3: 100_000 }),
      mapa({}),
    );
    expect(r.total).toBe(600_000);
    expect(r.periodos.map((p) => p.periodo)).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('sólo lista los períodos que tienen algo pendiente', () => {
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-07', 200_000, 200_000), liq('l2', '2026-08', 300_000, 300_000)],
      mapa({ l1: 200_000, l2: 300_000 }),
      mapa({ l1: 200_000 }), // julio ya rendido
    );
    expect(r.total).toBe(300_000);
    expect(r.periodos).toEqual([{ periodo: '2026-08', monto: 300_000 }]);
  });

  it('redondea a centavos, no a peso entero (tiene que cuadrar con la rendición)', () => {
    // La rendición persiste Decimal(14,2); redondear a entero acá produciría un drift
    // de centavos al reconciliar guard vs rendición.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 1000, 3000)],
      mapa({ l1: 1000 }),
      mapa({}),
    );
    // 1000 × (1000/3000) = 333.333… → 333.33
    expect(r.total).toBe(333.33);
  });
});
