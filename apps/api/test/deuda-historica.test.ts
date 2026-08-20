import { describe, it, expect } from 'vitest';
import { computarLiquidacionesContrato, type ContratoParaLiquidar } from '../src/lib/liquidaciones.js';

/**
 * DEUDA HISTÓRICA — la aritmética de POST /contratos/historico.
 *
 * El endpoint carga a un inquilino que YA SE FUE debiendo: crea un contrato
 * FINALIZADO que no reclama la propiedad y le devenga las cuotas de la ventana
 * de deuda. Toda la plata que ese endpoint inventa sale de UNA función pura
 * —`computarLiquidacionesContrato`— y es lo que se fija acá.
 *
 * Lo que se está protegiendo, en concreto:
 *
 *  1. Que la ventana quede CERRADA. `enumerarPeriodosContrato` topea en
 *     `min(mes que viene, mes de fin)`. Si ese `min` se rompiera, un contrato
 *     histórico de 2024 devengaría cuotas hasta HOY: deuda inventada a nombre de
 *     alguien que se fue hace dos años, con mora corriendo. Es el peor error
 *     posible de esta feature y no lo atrapa ningún tipo.
 *
 *  2. Que TODAS nazcan VENCIDO. Es lo que las hace contar como deuda en la ficha
 *     de la Persona (`GET /personas/:id` suma `liqVencida(l) || PARCIAL`). Una
 *     cuota PENDIENTE no sumaría y el moroso entraría al sistema sin deber nada.
 *
 * Tests PUROS: no tocan la DB.
 */

/** Contrato histórico tal como lo crea el endpoint (FIJO, sin devengarDesde). */
function contratoHistorico(over: Partial<ContratoParaLiquidar> = {}): ContratoParaLiquidar {
  return {
    id: 'cnt_hist',
    inmobiliariaId: 'inmo_1',
    monto: 80_000,
    montoExpensas: null,
    moneda: 'ARS',
    fechaInicio: new Date(Date.UTC(2024, 2, 1)), // 2024-03-01
    fechaFin: new Date(Date.UTC(2024, 4, 31)), // 2024-05-31
    diaPago: 10,
    devengarDesde: null,
    ...over,
  };
}

/** "Hoy" bien lejos del contrato: dos años después de la ventana. */
const HOY = new Date(Date.UTC(2026, 7, 19)); // 2026-08-19

describe('deuda histórica · ventana de períodos', () => {
  it('devenga exactamente los meses de la ventana, sin llegar hasta hoy', () => {
    const liqs = computarLiquidacionesContrato(contratoHistorico(), HOY);

    expect(liqs.map((l) => l.periodo)).toEqual(['2024-03', '2024-04', '2024-05']);
  });

  it('todas las cuotas nacen VENCIDO: son deuda desde el minuto cero', () => {
    const liqs = computarLiquidacionesContrato(contratoHistorico(), HOY);

    expect(liqs.every((l) => l.estado === 'VENCIDO')).toBe(true);
  });

  it('un solo mes adeudado devenga una sola cuota', () => {
    const liqs = computarLiquidacionesContrato(
      contratoHistorico({
        fechaInicio: new Date(Date.UTC(2025, 0, 1)),
        fechaFin: new Date(Date.UTC(2025, 0, 31)),
      }),
      HOY,
    );

    expect(liqs).toHaveLength(1);
    expect(liqs[0]?.periodo).toBe('2025-01');
  });

  it('la ventana de deuda no se estira: 3 meses cargados en 2024 siguen siendo 3 en 2026', () => {
    // Mismo contrato, "hoy" un año más tarde todavía: la cantidad de cuotas es
    // función de la ventana, no del tiempo transcurrido.
    const enero2027 = new Date(Date.UTC(2027, 0, 5));

    expect(computarLiquidacionesContrato(contratoHistorico(), HOY)).toHaveLength(3);
    expect(computarLiquidacionesContrato(contratoHistorico(), enero2027)).toHaveLength(3);
  });
});

describe('deuda histórica · montos', () => {
  it('sin expensas, el total es el alquiler', () => {
    const liqs = computarLiquidacionesContrato(contratoHistorico(), HOY);

    expect(liqs[0]?.montoAlquiler).toBe(80_000);
    expect(liqs[0]?.montoExpensas).toBeNull();
    expect(liqs[0]?.montoTotal).toBe(80_000);
  });

  it('con expensas, el total las incluye en cada cuota', () => {
    const liqs = computarLiquidacionesContrato(contratoHistorico({ montoExpensas: 25_000 }), HOY);

    expect(liqs).toHaveLength(3);
    for (const l of liqs) {
      expect(l.montoTotal).toBe(105_000);
    }
  });

  it('el canon del contrato histórico no se ajusta: los 3 meses valen lo mismo', () => {
    // El endpoint fuerza indiceAjuste FIJO y proximoAjuste null. Sin vigencias
    // futuras, `canonDelPeriodo` devuelve el monto tal cual para todo período.
    const liqs = computarLiquidacionesContrato(contratoHistorico(), HOY);

    expect(new Set(liqs.map((l) => l.montoAlquiler))).toEqual(new Set([80_000]));
  });

  it('hereda la moneda del contrato (un moroso en dólares no se carga en pesos)', () => {
    const liqs = computarLiquidacionesContrato(contratoHistorico({ moneda: 'USD', monto: 500 }), HOY);

    expect(liqs.every((l) => l.moneda === 'USD')).toBe(true);
    expect(liqs[0]?.montoTotal).toBe(500);
  });
});
