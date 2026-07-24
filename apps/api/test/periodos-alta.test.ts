import { describe, it, expect } from 'vitest';
import { enumerarPeriodosContrato } from '@llave/shared/periodos';
import { computarLiquidacionesContrato, type ContratoParaLiquidar } from '../src/lib/liquidaciones.js';

/**
 * INVARIANTE del bug i36 (alta de contrato falla con inicio a mitad de mes).
 *
 * El wizard de alta ofrece "períodos anteriores" = enumerarPeriodosContrato(...)
 * filtrado por vencido. El back devenga = computarLiquidacionesContrato(...).
 * El bug era que el front (con su fórmula propia) ofrecía un período que el back
 * NO devengaba (huérfano) → aplicarEstadoInicial tiraba 400 → rollback del alta
 * entera. Ahora ambos usan la MISMA enumeración (@llave/shared), así que esta
 * invariante — "el front nunca ofrece un período que el back no cree" — se
 * cumple por construcción. Estos tests son la red que faltaba: NINGÚN test
 * ejercía la coherencia entre lo que el wizard manda y lo que el back genera.
 */

// Lo que el WIZARD manda en periodosAnteriores (mismo cálculo que page.tsx).
function periodosQueOfreceElFront(
  p: { fechaInicio: string; fechaFin: string; diaPago: number },
  now: Date,
): string[] {
  return enumerarPeriodosContrato(p, now)
    .filter((x) => x.vencido)
    .map((x) => x.periodo);
}

// Lo que el BACK devenga como Liquidacion (el conjunto de períodos válidos).
function periodosQueDevengaElBack(c: ContratoParaLiquidar, now: Date): Set<string> {
  return new Set(computarLiquidacionesContrato(c, now).map((l) => l.periodo));
}

const base: Omit<ContratoParaLiquidar, 'fechaInicio' | 'fechaFin' | 'diaPago'> = {
  id: 'c',
  inmobiliariaId: 'i',
  monto: 500_000,
  montoExpensas: null,
  moneda: 'ARS',
};

const casos = [
  { desc: 'inicio 15/07 con diaPago 5 (EL caso que fallaba, i36)', fechaInicio: '2026-07-15', fechaFin: '2028-07-15', diaPago: 5 },
  { desc: 'inicio 01/07 con diaPago 5 (borde: NO se saltea)', fechaInicio: '2026-07-01', fechaFin: '2028-07-01', diaPago: 5 },
  { desc: 'inicio 20/03 con diaPago 10', fechaInicio: '2026-03-20', fechaFin: '2028-03-20', diaPago: 10 },
  { desc: 'inicio 31/01 con diaPago 31 (clamp fin de mes)', fechaInicio: '2026-01-31', fechaFin: '2028-01-31', diaPago: 31 },
  { desc: 'contrato de este mes (sin vencidos todavía)', fechaInicio: '2026-11-10', fechaFin: '2028-11-10', diaPago: 25 },
  { desc: 'inicio 28/02 con diaPago 1 (venc pre-inicio → skip)', fechaInicio: '2026-02-28', fechaFin: '2027-02-28', diaPago: 1 },
];

const NOW = new Date('2026-11-20T12:00:00Z');

describe('coherencia front↔back en el alta (invariante bug i36)', () => {
  for (const c of casos) {
    it(`el front NUNCA ofrece un período que el back no devengue — ${c.desc}`, () => {
      const front = periodosQueOfreceElFront(
        { fechaInicio: c.fechaInicio, fechaFin: c.fechaFin, diaPago: c.diaPago },
        NOW,
      );
      const back = periodosQueDevengaElBack(
        { ...base, diaPago: c.diaPago, fechaInicio: new Date(c.fechaInicio), fechaFin: new Date(c.fechaFin) },
        NOW,
      );
      for (const p of front) {
        expect(back.has(p), `el front ofrece "${p}" pero el back no lo devenga (huérfano → 400)`).toBe(true);
      }
    });
  }

  it('caso i36 puntual: inicio 15/07 diaPago 5 → el front NO ofrece 2026-07 (era el huérfano)', () => {
    const front = periodosQueOfreceElFront(
      { fechaInicio: '2026-07-15', fechaFin: '2028-07-15', diaPago: 5 },
      NOW,
    );
    // 2026-07 vencía el 05/07, ANTES del inicio 15/07 → el back lo saltea, el front tampoco lo ofrece.
    expect(front).not.toContain('2026-07');
    // El primer período cobrable/ofrecible es agosto.
    expect(front[0]).toBe('2026-08');
  });

  it('borde día-1: inicio 01/07 diaPago 5 → SÍ ofrece 2026-07 (venc 05/07 >= inicio 01/07)', () => {
    const front = periodosQueOfreceElFront(
      { fechaInicio: '2026-07-01', fechaFin: '2028-07-01', diaPago: 5 },
      NOW,
    );
    expect(front[0]).toBe('2026-07');
  });
});
