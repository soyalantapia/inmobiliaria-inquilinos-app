/**
 * Lo que le falta a UN dueño ≠ lo que le falta a la unidad (`porDuenio`).
 *
 * Encontrado revisando `GET /portal/pendiente` después de deployarlo: mostraba el remanente de
 * la PROPIEDAD, con un rótulo "te corresponde el X%" al lado. Con un solo dueño al 100% eso da
 * bien, y por eso pasó. Con dos deja de dar bien apenas se le rinde a uno, porque el remanente
 * pasa a ser íntegramente del otro y ya no es proporcional a ningún porcentaje.
 *
 * El arreglo (T-53) es el parámetro `porDuenio` de `calcularPendienteSinRendir`. Estos tests
 * fijan su aritmética, que tiene que espejar la de `POST /rendiciones` (plata.ts, paso BRUTO):
 * si divergen, el portal le promete al dueño un número que el depósito no le va a dar.
 *
 * Son PUROS: la cuenta vive separada del lector justamente para poder fijarla sin una Postgres.
 */
import { describe, it, expect } from 'vitest';
import { calcularPendienteSinRendir, type LiquidacionParaPendiente } from '../src/lib/rendicion-pendiente.js';

const liq = (
  id: string,
  periodo: string,
  montoAlquiler: number,
  montoTotal: number,
  moneda = 'ARS',
): LiquidacionParaPendiente => ({ id, periodo, montoAlquiler, montoTotal, moneda });

const mapa = (o: Record<string, number>) => new Map(Object.entries(o));

/** Azúcar para no repetir la forma del cuarto argumento en cada caso. */
const paraDuenio = (porcentaje: number, rendidoMio: Record<string, number> = {}) => ({
  porcentaje,
  rendidoMioPorLiq: mapa(rendidoMio),
});

describe('calcularPendienteSinRendir — la parte de UN dueño', () => {
  it('EL BUG: rendido A (60%), lo que queda es TODO de B, no el 40% de lo que queda', () => {
    // Liquidación de 100.000 cobrada entera. Se le rindieron 60.000 a A.
    const liqs = [liq('l1', '2026-08', 100_000, 100_000)];
    const cobrado = mapa({ l1: 100_000 });
    const rendidoTodos = mapa({ l1: 60_000 });

    // A ya cobró lo suyo: no le falta nada. Antes leía 40.000 × 60% = 24.000.
    const a = calcularPendienteSinRendir(liqs, cobrado, rendidoTodos, paraDuenio(60, { l1: 60_000 }));
    expect(a.total).toBe(0);

    // A B le deben sus 40.000 ENTEROS. Antes leía 40.000 × 40% = 16.000: dos veces y media
    // menos que lo real, y en la pantalla que usa para controlar a su inmobiliaria.
    const b = calcularPendienteSinRendir(liqs, cobrado, rendidoTodos, paraDuenio(40));
    expect(b.total).toBe(40_000);
  });

  it('sin rendir nada, cada uno ve su parte y las dos suman el total', () => {
    const liqs = [liq('l1', '2026-08', 100_000, 100_000)];
    const cobrado = mapa({ l1: 100_000 });
    const a = calcularPendienteSinRendir(liqs, cobrado, mapa({}), paraDuenio(60));
    const b = calcularPendienteSinRendir(liqs, cobrado, mapa({}), paraDuenio(40));
    expect(a.total).toBe(60_000);
    expect(b.total).toBe(40_000);
    expect(a.total + b.total).toBe(100_000);
  });

  it('el SEGUNDO cap protege del reparto cambiado después de rendir', () => {
    // Se rindieron 90.000 entre todos y después alguien subió a este dueño al 100%. Su
    // "parte" pasaría a ser 100.000 y le faltarían 100.000 — pero de la liquidación sólo
    // quedan 10.000 sin rendir. El cap cruzado es lo que evita prometer plata que no está.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 100_000, 100_000)],
      mapa({ l1: 100_000 }),
      mapa({ l1: 90_000 }), // entre TODOS ya salieron 90.000
      paraDuenio(100), // a ESTE dueño no se le rindió nada
    );
    expect(r.total).toBe(10_000);
  });

  it('cobro PARCIAL: se prorratea sobre lo cobrado, no sobre lo facturado', () => {
    // Facturado 100.000, cobrado 50.000. Al 60% le tocan 30.000, no 60.000.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 100_000, 100_000)],
      mapa({ l1: 50_000 }),
      mapa({}),
      paraDuenio(60),
    );
    expect(r.total).toBe(30_000);
  });

  it('las expensas quedan afuera: se prorratea por montoAlquiler/montoTotal', () => {
    // Alquiler 80.000 + expensas 20.000 = 100.000, cobrado entero. Al dueño le corresponde
    // el alquiler; las expensas van al consorcio.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 80_000, 100_000)],
      mapa({ l1: 100_000 }),
      mapa({}),
      paraDuenio(100),
    );
    expect(r.total).toBe(80_000);
  });

  it('la MORA queda afuera: el cobrado se capea a montoTotal', () => {
    // Se cobraron 120.000 por una liquidación de 100.000: los 20.000 son punitorios y no son
    // del dueño. Mismo criterio que POST /rendiciones.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 100_000, 100_000)],
      mapa({ l1: 120_000 }),
      mapa({}),
      paraDuenio(100),
    );
    expect(r.total).toBe(100_000);
  });

  it('una liquidación en 0 no produce NaN', () => {
    // 0/0 daría NaN, y NaN > 0.01 es false: se colaría en silencio, o contaminaría el total.
    // Pasa con un contrato SOLO_EXPENSAS sin expensas cargadas.
    const r = calcularPendienteSinRendir([liq('l1', '2026-08', 0, 0)], mapa({ l1: 5000 }), mapa({}), paraDuenio(100));
    expect(r.total).toBe(0);
    expect(Number.isNaN(r.total)).toBe(false);
  });

  it('cada período conserva su moneda y no se suman entre sí', () => {
    const r = calcularPendienteSinRendir(
      [liq('usd', '2025-06', 900, 900, 'USD'), liq('ars', '2026-03', 300_000, 300_000)],
      mapa({ usd: 900, ars: 300_000 }),
      mapa({}),
      paraDuenio(100),
    );
    expect(r.periodos.map((p) => [p.periodo, p.moneda, p.monto])).toEqual([
      ['2025-06', 'USD', 900],
      ['2026-03', 'ARS', 300_000],
    ]);
  });

  it('lo que no se cobró no cuenta, por más que esté facturado', () => {
    const r = calcularPendienteSinRendir([liq('l1', '2026-08', 100_000, 100_000)], mapa({}), mapa({}), paraDuenio(100));
    expect(r.total).toBe(0);
    expect(r.periodos).toEqual([]);
  });

  it('sin `porDuenio` sigue dando el remanente de la UNIDAD (lo que usan los guards)', () => {
    // No-regresión: core.ts pregunta "¿queda algo sin rendir acá, de cualquiera?" y necesita
    // seguir viendo los 40.000, aunque para mostrárselos a B haya que pasar por porDuenio.
    const r = calcularPendienteSinRendir(
      [liq('l1', '2026-08', 100_000, 100_000)],
      mapa({ l1: 100_000 }),
      mapa({ l1: 60_000 }),
    );
    expect(r.total).toBe(40_000);
  });
});
