/**
 * T-53 · "Cobrado y sin rendir" según qué dueño pregunta.
 *
 * EL CASO. Una propiedad con dos dueños, A 60% y B 40%. Se cobra el alquiler de agosto ($100).
 * La inmobiliaria le rinde a A su parte ($60) y todavía no le rindió a B.
 *
 * Antes, la cuenta del portal agrupaba `AlquilerRendido` sólo por `liquidacionId`, sin mirar de
 * quién era la rendición — pero esa tabla cuelga de `Rendicion.propietarioId` (schema.prisma:
 * "parte del propietario rendida en esta tanda"). Resultado: A entraba y seguía viendo $40
 * pendientes, que son de B, con la leyenda "te corresponde el 60%" — invitándolo a esperar $24
 * que nunca iban a llegar. Y al revés también fallaba.
 *
 * La aritmética espeja el DOBLE CAP de `POST /rendiciones` (plata.ts:2042):
 *   (1) lo que le falta a ESTE dueño de su parte, y
 *   (2) el remanente de la liquidación sumando a TODOS los dueños.
 * El (2) es el que evita el sobre-pago cuando se cambió el reparto después de rendir.
 *
 * Tests puros: no tocan la base ni la red.
 */
import { describe, it, expect } from 'vitest';
import { calcularPendienteSinRendir, type LiquidacionParaPendiente } from '../src/lib/rendicion-pendiente.js';

const liq = (id: string, periodo: string, alquiler: number, total: number, moneda = 'ARS'): LiquidacionParaPendiente =>
  ({ id, periodo, montoAlquiler: alquiler, montoTotal: total, moneda });

const mapa = (o: Record<string, number>) => new Map(Object.entries(o));

// Agosto: alquiler 100, total 100, cobrado entero.
const LIQS = [liq('l1', '2026-08', 100, 100)];
const COBRADO = mapa({ l1: 100 });

describe('T-53 — la parte de cada dueño', () => {
  it('a A (60%), ya rendido, no le queda nada — aunque a B todavía le deban', () => {
    const r = calcularPendienteSinRendir(
      LIQS,
      COBRADO,
      mapa({ l1: 60 }), // rendido en total: los $60 de A
      { porcentaje: 60, rendidoMioPorLiq: mapa({ l1: 60 }) },
    );
    // Antes daba 40 — la plata de B.
    expect(r.total).toBe(0);
    expect(r.periodos).toEqual([]);
  });

  it('a B (40%) le queda su parte entera, no el remanente de la propiedad', () => {
    const r = calcularPendienteSinRendir(
      LIQS,
      COBRADO,
      mapa({ l1: 60 }), // ya se rindieron los $60 de A
      { porcentaje: 40, rendidoMioPorLiq: mapa({}) }, // a B nada
    );
    expect(r.total).toBe(40);
  });

  it('sin rendir nada, cada uno ve su parte', () => {
    const a = calcularPendienteSinRendir(LIQS, COBRADO, mapa({}), { porcentaje: 60, rendidoMioPorLiq: mapa({}) });
    const b = calcularPendienteSinRendir(LIQS, COBRADO, mapa({}), { porcentaje: 40, rendidoMioPorLiq: mapa({}) });
    expect(a.total).toBe(60);
    expect(b.total).toBe(40);
    // Las dos partes suman lo cobrado: no se inventa ni se pierde plata.
    expect(a.total + b.total).toBe(100);
  });

  it('el segundo cap protege del sobre-pago si cambió el reparto después de rendir', () => {
    // A hoy figura al 100%, pero de esta liquidación ya se rindieron $90 entre todos.
    // Su parte diría 100, pero sólo quedan 10 sin rendir: gana el cap (2).
    const r = calcularPendienteSinRendir(
      LIQS,
      COBRADO,
      mapa({ l1: 90 }),
      { porcentaje: 100, rendidoMioPorLiq: mapa({}) },
    );
    expect(r.total).toBe(10);
  });

  it('sin el modo por dueño la cuenta sigue siendo de la PROPIEDAD (lo que usan los guards)', () => {
    const r = calcularPendienteSinRendir(LIQS, COBRADO, mapa({ l1: 60 }));
    // Los guards de core.ts preguntan "¿queda algo sin rendir acá?", ciegos a la participación.
    expect(r.total).toBe(40);
  });

  it('la tolerancia de un centavo sigue valiendo con prorrateo', () => {
    // 33.333% de 100 = 33.333; ya rendido 33.33 ⇒ resto 0.003, por debajo del umbral.
    const r = calcularPendienteSinRendir(
      LIQS,
      COBRADO,
      mapa({ l1: 33.33 }),
      { porcentaje: 33.333, rendidoMioPorLiq: mapa({ l1: 33.33 }) },
    );
    expect(r.total).toBe(0);
  });
});
