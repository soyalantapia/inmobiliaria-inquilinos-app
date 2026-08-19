import { describe, it, expect } from 'vitest';
import { computarLiquidacionesContrato } from '../src/lib/liquidaciones.js';

// T-20 — El devengo cobraba ALQUILER en un contrato SOLO_EXPENSAS.
//
// `computarLiquidacionesContrato` usaba `contrato.monto` sin mirar el tipo de contrato,
// mientras que `recomputarLiquidacionesFuturas` sí aplicaba `montoAlquilerSegunTipo`. Las
// dos rutas divergían, y el agujero era alcanzable desde el panel:
//
//   1. Alta SOLO_EXPENSAS → el wizard fuerza monto 0 → devengo correcto.
//   2. Alguien usa "Ajustar alquiler" (PATCH /contratos/:id/monto). Ese endpoint EXIGE un
//      monto positivo y lo guarda en `contrato.monto`; después recalcula las cuotas
//      futuras y las deja en 0, así que en el momento se ve bien.
//   3. Seis horas más tarde corre el cron. Devenga el mes siguiente con `contrato.monto`
//      positivo y SIN mirar el tipo → cuota con alquiler > 0 sobre un contrato que sólo
//      cobra expensas. El ajuste se "deshacía solo".
//
// Test puro, sin DB.

const BASE = {
  id: 'cnt_se',
  inmobiliariaId: 'inm_x',
  moneda: 'ARS' as const,
  fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
  fechaFin: new Date('2027-12-31T00:00:00.000Z'),
  diaPago: 10,
  devengarDesde: null,
};
const AHORA = new Date('2026-03-15T12:00:00.000Z');

describe('T-20 — devengo según el tipo de contrato', () => {
  it('SOLO_EXPENSAS no cobra alquiler aunque contrato.monto haya quedado positivo', () => {
    const liqs = computarLiquidacionesContrato(
      { ...BASE, monto: 500_000, montoExpensas: 80_000, tipoContrato: 'SOLO_EXPENSAS' },
      AHORA,
    );

    expect(liqs.length).toBeGreaterThan(0);
    for (const l of liqs) {
      expect(Number(l.montoAlquiler)).toBe(0);
      expect(Number(l.montoExpensas)).toBe(80_000);
      // Es lo que se le exige al inquilino: sólo las expensas.
      expect(Number(l.montoTotal)).toBe(80_000);
    }
  });

  it('ALQUILER_Y_EXPENSAS cobra los dos, en un solo total', () => {
    const [l] = computarLiquidacionesContrato(
      { ...BASE, monto: 500_000, montoExpensas: 80_000, tipoContrato: 'ALQUILER_Y_EXPENSAS' },
      AHORA,
    );

    expect(Number(l!.montoAlquiler)).toBe(500_000);
    expect(Number(l!.montoExpensas)).toBe(80_000);
    expect(Number(l!.montoTotal)).toBe(580_000);
  });

  it('ALQUILER sin expensas: el total es el alquiler', () => {
    const [l] = computarLiquidacionesContrato(
      { ...BASE, monto: 500_000, montoExpensas: null, tipoContrato: 'ALQUILER' },
      AHORA,
    );

    expect(Number(l!.montoAlquiler)).toBe(500_000);
    expect(Number(l!.montoTotal)).toBe(500_000);
  });

  it('en un consorcio MIXTO las dos unidades conviven sin pisarse', () => {
    // El caso que planteó Camila: "tengo dos edificios donde tengo cinco departamentos
    // nada más propios, lo demás sólo cobro [expensas]". El tipo vive en el CONTRATO, no
    // en el consorcio, así que dos unidades del mismo edificio pueden tener regímenes
    // distintos sin ninguna configuración especial.
    const [propia] = computarLiquidacionesContrato(
      { ...BASE, id: 'cnt_1a', monto: 500_000, montoExpensas: 80_000, tipoContrato: 'ALQUILER_Y_EXPENSAS' },
      AHORA,
    );
    const [soloExpensas] = computarLiquidacionesContrato(
      { ...BASE, id: 'cnt_2b', monto: 500_000, montoExpensas: 80_000, tipoContrato: 'SOLO_EXPENSAS' },
      AHORA,
    );

    expect(Number(propia!.montoTotal)).toBe(580_000);
    expect(Number(soloExpensas!.montoTotal)).toBe(80_000);
  });
});
