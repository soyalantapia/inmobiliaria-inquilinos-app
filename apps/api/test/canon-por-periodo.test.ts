import { describe, it, expect } from 'vitest';
import { computarLiquidacionesContrato, canonDelPeriodo } from '../src/lib/liquidaciones.js';

// CAZABUG P2 — /ajustar y /renovar bumpean contrato.monto INMEDIATAMENTE, pero el devengo
// usaba ese escalar para TODOS los períodos. Con una vigencia futura (renovar por
// adelantado es el flujo normal: se pacta el canon nuevo para cuando termina el plazo),
// los meses intermedios —que todavía son del canon viejo— se devengaban al canon NUEVO:
// sobrecobro al inquilino y comisión inflada (la comisión sale de montoAlquiler).
// Fix: canon POR PERÍODO. contrato.monto sigue siendo la autoridad (lo pisa el ajuste
// masivo PATCH /monto, que no deja fila de ajuste); las vigencias sólo retroceden los
// períodos anteriores a un ajuste que todavía no entró en vigor. Test puro, sin DB.

const CONTRATO = {
  id: 'cnt_x',
  inmobiliariaId: 'inm_x',
  monto: 150000, // ya bumpeado por la renovación
  montoExpensas: null,
  moneda: 'ARS' as const,
  fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
  fechaFin: new Date('2027-12-31T00:00:00.000Z'),
  diaPago: 10,
};

describe('CAZABUG — canonDelPeriodo', () => {
  it('sin vigencias futuras manda contrato.monto (respeta el ajuste masivo PATCH /monto)', () => {
    expect(canonDelPeriodo('2026-07', 150000, undefined)).toBe(150000);
    expect(canonDelPeriodo('2026-07', 150000, [])).toBe(150000);
  });

  it('un período ANTERIOR a la vigencia usa el canon viejo', () => {
    const vig = [{ desde: '2026-10', montoAnterior: 100000 }];
    expect(canonDelPeriodo('2026-07', 150000, vig)).toBe(100000);
    expect(canonDelPeriodo('2026-09', 150000, vig)).toBe(100000);
  });

  it('desde la vigencia en adelante manda el canon nuevo', () => {
    const vig = [{ desde: '2026-10', montoAnterior: 100000 }];
    expect(canonDelPeriodo('2026-10', 150000, vig)).toBe(150000);
    expect(canonDelPeriodo('2026-11', 150000, vig)).toBe(150000);
  });

  it('con varias vigencias manda la PRIMera posterior al período (escalonado)', () => {
    const vig = [
      { desde: '2026-10', montoAnterior: 100000 },
      { desde: '2027-04', montoAnterior: 150000 },
    ];
    expect(canonDelPeriodo('2026-08', 200000, vig)).toBe(100000); // antes de la 1ª
    expect(canonDelPeriodo('2026-11', 200000, vig)).toBe(150000); // entre la 1ª y la 2ª
    expect(canonDelPeriodo('2027-05', 200000, vig)).toBe(200000); // después de todas
  });
});

describe('CAZABUG — el devengo no cobra el canon nuevo a los meses intermedios', () => {
  const now = new Date('2026-07-15T00:00:00.000Z'); // devenga hasta 2026-08 inclusive

  it('SIN vigencias: todo al monto actual (comportamiento previo intacto)', () => {
    const data = computarLiquidacionesContrato(CONTRATO, now);
    expect(data.every((l) => Number(l.montoAlquiler) === 150000)).toBe(true);
  });

  it('CON renovación vigente desde 2026-10: julio y agosto siguen al canon viejo', () => {
    const data = computarLiquidacionesContrato(CONTRATO, now, [{ desde: '2026-10', montoAnterior: 100000 }]);
    const jul = data.find((l) => l.periodo === '2026-07');
    const ago = data.find((l) => l.periodo === '2026-08');
    expect(jul).toBeDefined();
    expect(ago).toBeDefined();
    // Con el bug: 150000 (el canon que recién rige desde octubre) → sobrecobro de $50.000/mes.
    expect(Number(jul!.montoAlquiler)).toBe(100000);
    expect(Number(ago!.montoAlquiler)).toBe(100000);
    expect(Number(ago!.montoTotal)).toBe(100000);
  });

  it('montoTotal acompaña al canon del período (con expensas)', () => {
    const data = computarLiquidacionesContrato({ ...CONTRATO, montoExpensas: 20000 }, now, [
      { desde: '2026-10', montoAnterior: 100000 },
    ]);
    const ago = data.find((l) => l.periodo === '2026-08');
    expect(Number(ago!.montoAlquiler)).toBe(100000);
    expect(Number(ago!.montoTotal)).toBe(120000);
  });
});

// T-16 — PATCH /contratos/:id/monto pasó a dejar fila en `AjusteAlquiler` (antes no dejaba
// ninguna, así que el historial salía incompleto y el aviso al inquilino nunca se disparaba
// por ese camino). Esa fila lleva `periodoDesde` = período ACTUAL, que es desde donde ese
// endpoint re-devenga.
//
// Este test blinda que ese cambio sea INERTE para el devengo: `vigenciasFuturas` sólo
// levanta ajustes con `periodoDesde > periodo`, así que una vigencia del período en curso
// —o anterior— no puede retroceder el canon. Si alguien cambiara ese filtro a `gte`, el
// monto recién ajustado dejaría de aplicarse al mes en curso y el inquilino pagaría el
// canon viejo: acá se pondría en rojo.
describe('T-16 — la fila de ajuste de PATCH /monto no cambia el devengo', () => {
  it('una vigencia del período EN CURSO no retrocede el canon', () => {
    const vig = [{ desde: '2026-07', montoAnterior: 100000 }];
    expect(canonDelPeriodo('2026-07', 150000, vig)).toBe(150000);
  });

  it('una vigencia PASADA tampoco lo retrocede', () => {
    const vig = [{ desde: '2026-05', montoAnterior: 100000 }];
    expect(canonDelPeriodo('2026-07', 150000, vig)).toBe(150000);
    expect(canonDelPeriodo('2026-06', 150000, vig)).toBe(150000);
  });

  it('convive con una vigencia futura real sin pisarla', () => {
    // La del período en curso (PATCH /monto) + una renovación pactada para octubre.
    const vig = [
      { desde: '2026-07', montoAnterior: 100000 },
      { desde: '2026-10', montoAnterior: 150000 },
    ];
    // Julio a septiembre siguen al canon vigente hasta octubre…
    expect(canonDelPeriodo('2026-07', 200000, vig)).toBe(150000);
    expect(canonDelPeriodo('2026-09', 200000, vig)).toBe(150000);
    // …y desde octubre manda el nuevo.
    expect(canonDelPeriodo('2026-10', 200000, vig)).toBe(200000);
  });
});
