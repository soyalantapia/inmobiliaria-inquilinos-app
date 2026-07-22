import { describe, it, expect } from 'vitest';
import {
  computarLiquidacionesContrato,
  sumarMesesUTC,
  recomputarLiquidacionesFuturas,
  type ContratoParaLiquidar,
  type LiquidacionParaReajustar,
} from '../src/lib/liquidaciones.js';

/**
 * Tests PUROS del cómputo de liquidaciones (sin DB). `now` es inyectable, así
 * que son deterministas. Cubren el caso del circuito E2E (contrato nuevo →
 * período actual + siguiente para 1er y 2º pago) y los bordes históricos.
 */

const base: Omit<ContratoParaLiquidar, 'fechaInicio' | 'fechaFin'> = {
  id: 'cnt_test',
  inmobiliariaId: 'inmo_test',
  monto: 500_000,
  montoExpensas: 80_000,
  moneda: 'ARS',
  diaPago: 10,
};

function contrato(inicio: string, fin: string, over: Partial<ContratoParaLiquidar> = {}): ContratoParaLiquidar {
  return { ...base, fechaInicio: new Date(inicio), fechaFin: new Date(fin), ...over };
}

describe('computarLiquidacionesContrato', () => {
  it('contrato nuevo (inicio este mes): genera período actual + siguiente', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-06-01T00:00:00Z', '2028-06-01T00:00:00Z'),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2026-06', '2026-07']);
    // Monto total = alquiler + expensas, en las dos.
    expect(data.every((l) => Number(l.montoTotal) === 580_000)).toBe(true);
    expect(data.every((l) => Number(l.montoAlquiler) === 500_000)).toBe(true);
    expect(data.every((l) => Number(l.montoExpensas) === 80_000)).toBe(true);
    // Junio venció el 10 (< 15) → VENCIDO; julio vence el 10 → PENDIENTE.
    expect(data.map((l) => l.estado)).toEqual(['VENCIDO', 'PENDIENTE']);
  });

  it('clampa el día de pago al último día del mes (feb, diaPago 31)', () => {
    const now = new Date('2026-01-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', { diaPago: 31 }),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2026-01', '2026-02']);
    const feb = data.find((l) => l.periodo === '2026-02')!;
    // 2026 no es bisiesto → febrero tiene 28 días, no 31.
    expect((feb.fechaVencimiento as Date).getUTCDate()).toBe(28);
  });

  it('contrato que empezó hace meses: devenga todos los períodos pasados (VENCIDO) + el próximo', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-03-01T00:00:00Z', '2028-03-01T00:00:00Z'),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
    expect(data[0].estado).toBe('VENCIDO');
    expect(data[data.length - 1].periodo).toBe('2026-07');
    expect(data[data.length - 1].estado).toBe('PENDIENTE');
  });

  it('no pre-factura más allá de fechaFin (contrato que termina este mes)', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-06-01T00:00:00Z', '2026-06-30T00:00:00Z'),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2026-06']);
  });

  it('contrato futuro: solo el primer mes (no pre-factura todo el año)', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2027-01-01T00:00:00Z', '2029-01-01T00:00:00Z'),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2027-01']);
    expect(data[0].estado).toBe('PENDIENTE');
  });

  it('sin expensas: montoTotal = alquiler y montoExpensas null', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-06-01T00:00:00Z', '2027-06-01T00:00:00Z', { montoExpensas: null, monto: 300_000 }),
      now,
    );
    expect(data.every((l) => l.montoExpensas === null)).toBe(true);
    expect(data.every((l) => Number(l.montoTotal) === 300_000)).toBe(true);
  });

  it('contrato arranca 15/07 con diaPago 5: la 1ª cuota NO nace vencida pre-inicio', () => {
    // venc natural del 1er período = 05/07 < inicio 15/07 → antes nacía VENCIDA
    // con mora imposible. Ahora se saltea julio: el 1er cobro es agosto (05/08).
    const now = new Date('2026-07-20T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-07-15T00:00:00Z', '2028-07-15T00:00:00Z', { diaPago: 5 }),
      now,
    );
    // El período 2026-07 (venc pre-inicio) NO existe; arranca en 2026-08.
    expect(data.map((l) => l.periodo)).toEqual(['2026-08']);
    const primera = data[0];
    // La 1ª cuota vence DESPUÉS del inicio del contrato (no antes).
    expect((primera.fechaVencimiento as Date) >= new Date('2026-07-15T00:00:00Z')).toBe(true);
    expect((primera.fechaVencimiento as Date).toISOString().slice(0, 10)).toBe('2026-08-05');
  });

  it('contrato arranca 01/07 con diaPago 5: NO se saltea (venc 05/07 >= inicio 01/07)', () => {
    // Borde: cuando el inicio es día 1, el venc del día 5 NO es pre-inicio, así
    // que el 1er período se conserva (el skip solo aplica a venc < fechaInicio).
    const now = new Date('2026-07-20T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-07-01T00:00:00Z', '2028-07-01T00:00:00Z', { diaPago: 5 }),
      now,
    );
    expect(data[0].periodo).toBe('2026-07');
    expect((data[0].fechaVencimiento as Date).toISOString().slice(0, 10)).toBe('2026-07-05');
  });
});

describe('sumarMesesUTC (proximoAjuste)', () => {
  it('suma meses simples en UTC', () => {
    expect(sumarMesesUTC(new Date('2026-07-15T00:00:00Z'), 12).toISOString().slice(0, 10)).toBe('2027-07-15');
    expect(sumarMesesUTC(new Date('2026-07-15T00:00:00Z'), 6).toISOString().slice(0, 10)).toBe('2027-01-15');
  });

  it('clampa fin de mes (31/01 + 1 mes = 28/02, no 03/03)', () => {
    expect(sumarMesesUTC(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    // Año bisiesto: 31/01/2028 + 1 mes = 29/02.
    expect(sumarMesesUTC(new Date('2028-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2028-02-29');
  });
});

describe('recomputarLiquidacionesFuturas (ajuste manual de monto)', () => {
  const periodoActual = '2026-07';
  function liq(over: Partial<LiquidacionParaReajustar>): LiquidacionParaReajustar {
    return {
      id: 'liq_x',
      periodo: '2026-07',
      estado: 'PENDIENTE',
      montoExpensas: 80_000,
      cantidadPagos: 0,
      ...over,
    };
  }

  it('reajusta las futuras SIN pagos (PENDIENTE/VENCIDO) al monto nuevo + expensas', () => {
    const out = recomputarLiquidacionesFuturas(
      [
        liq({ id: 'jul', periodo: '2026-07', estado: 'PENDIENTE' }),
        liq({ id: 'ago', periodo: '2026-08', estado: 'PENDIENTE' }),
        liq({ id: 'venc', periodo: '2026-07', estado: 'VENCIDO' }),
      ],
      { montoNuevo: 600_000, tipoContrato: 'ALQUILER', periodoActual },
    );
    expect(out.map((r) => r.id).sort()).toEqual(['ago', 'jul', 'venc']);
    // Alquiler nuevo 600k + expensas 80k = 680k.
    expect(out.every((r) => r.montoAlquiler === 600_000 && r.montoTotal === 680_000)).toBe(true);
  });

  it('NO toca meses pasados, ni PAGADO/PARCIAL, ni las que tienen algún pago', () => {
    const out = recomputarLiquidacionesFuturas(
      [
        liq({ id: 'pasado', periodo: '2026-06', estado: 'PENDIENTE' }), // mes pasado
        liq({ id: 'pagado', periodo: '2026-07', estado: 'PAGADO' }), // ya paga
        liq({ id: 'parcial', periodo: '2026-08', estado: 'PARCIAL' }), // parcial
        liq({ id: 'conPago', periodo: '2026-09', estado: 'PENDIENTE', cantidadPagos: 1 }), // pago informado
      ],
      { montoNuevo: 600_000, tipoContrato: 'ALQUILER', periodoActual },
    );
    expect(out).toEqual([]);
  });

  it('SOLO_EXPENSAS: el alquiler nuevo es 0, el total = solo expensas', () => {
    const out = recomputarLiquidacionesFuturas(
      [liq({ id: 'ago', periodo: '2026-08', estado: 'PENDIENTE', montoExpensas: 50_000 })],
      { montoNuevo: 600_000, tipoContrato: 'SOLO_EXPENSAS', periodoActual },
    );
    expect(out).toEqual([{ id: 'ago', montoAlquiler: 0, montoTotal: 50_000 }]);
  });

  it('sin expensas (null): total = solo el alquiler nuevo', () => {
    const out = recomputarLiquidacionesFuturas(
      [liq({ id: 'ago', periodo: '2026-08', estado: 'PENDIENTE', montoExpensas: null })],
      { montoNuevo: 600_000, tipoContrato: 'ALQUILER', periodoActual },
    );
    expect(out).toEqual([{ id: 'ago', montoAlquiler: 600_000, montoTotal: 600_000 }]);
  });
});

describe('devengarDesde — cartera importada (no inventar deuda histórica)', () => {
  // El cron y el botón "Devengar" releen el contrato de la DB. Si el punto de arranque
  // no está PERSISTIDO, vuelven a generar todos los meses desde `fechaInicio` como
  // VENCIDO: deuda falsa masiva para una cartera recién importada, encima con el monto
  // actual (post-ajustes). Estos tests fijan que la decisión se respeta.
  const INICIO_HISTORICO = '2025-03-01T00:00:00Z';
  const FIN = '2028-03-01T00:00:00Z';
  const now = new Date('2026-07-22T12:00:00Z');

  it('sin devengarDesde devenga TODO el historial (el comportamiento que causaba la deuda falsa)', () => {
    const data = computarLiquidacionesContrato(contrato(INICIO_HISTORICO, FIN), now);
    // 2025-03 .. 2026-08 (mes que viene) = 18 períodos.
    expect(data.length).toBe(18);
    expect(data[0]?.periodo).toBe('2025-03');
    expect(data.filter((l) => l.estado === 'VENCIDO').length).toBeGreaterThan(12);
  });

  it('con devengarDesde en el mes actual arranca ahí: cero meses históricos', () => {
    const data = computarLiquidacionesContrato(
      contrato(INICIO_HISTORICO, FIN, { devengarDesde: new Date('2026-07-01T00:00:00Z') }),
      now,
    );
    expect(data.map((l) => l.periodo)).toEqual(['2026-07', '2026-08']);
    // CERO períodos anteriores al arranque: ésa es la deuda falsa que se evitaba.
    expect(data.filter((l) => l.periodo < '2026-07').length).toBe(0);
    // A lo sumo vence el mes en curso (diaPago 10 < 22 de julio), no 17 meses de
    // historia. Sin el fix, este mismo contrato nacía con 16 cuotas VENCIDO.
    expect(data.filter((l) => l.estado === 'VENCIDO').length).toBeLessThanOrEqual(1);
  });

  it('devengarDesde ANTERIOR al inicio real no puede adelantar el devengo', () => {
    const data = computarLiquidacionesContrato(
      contrato(INICIO_HISTORICO, FIN, { devengarDesde: new Date('2024-01-01T00:00:00Z') }),
      now,
    );
    expect(data[0]?.periodo).toBe('2025-03');
  });

  it('devengarDesde null se comporta igual que no tenerlo', () => {
    const conNull = computarLiquidacionesContrato(contrato(INICIO_HISTORICO, FIN, { devengarDesde: null }), now);
    const sin = computarLiquidacionesContrato(contrato(INICIO_HISTORICO, FIN), now);
    expect(conNull.map((l) => l.periodo)).toEqual(sin.map((l) => l.periodo));
  });
});
