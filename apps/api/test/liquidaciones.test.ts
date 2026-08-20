import { describe, it, expect } from 'vitest';
import {
  computarLiquidacionesContrato,
  sumarMesesUTC,
  recomputarLiquidacionesFuturas,
  recomputarExpensasFuturas,
  type ContratoParaLiquidar,
  type LiquidacionParaReajustar,
  type LiquidacionParaReexpensar,
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
  devengarDesde: null,
  tipoContrato: 'ALQUILER',
};

function contrato(inicio: string, fin: string, over: Partial<ContratoParaLiquidar> = {}): ContratoParaLiquidar {
  return { ...base, fechaInicio: new Date(inicio), fechaFin: new Date(fin), ...over };
}

describe('computarLiquidacionesContrato · SOLO_EXPENSAS', () => {
  // El devengo NO recibía `tipoContrato`: un contrato de solo expensas daba alquiler 0
  // sólo porque `contrato.monto` había quedado en 0. Estos casos cubren justamente el
  // escenario en que NO quedó en 0 — que es lo que pasaba tras ajustar o renovar.
  const now = new Date('2026-06-15T12:00:00Z');

  it('no devenga alquiler aunque el contrato tenga un canon positivo', () => {
    const data = computarLiquidacionesContrato(
      contrato('2026-06-01T00:00:00Z', '2028-06-01T00:00:00Z', {
        tipoContrato: 'SOLO_EXPENSAS',
        monto: 500_000, // canon "sucio", dejado por un ajuste/renovación vieja
        montoExpensas: 80_000,
      }),
      now,
    );
    expect(data.every((l) => Number(l.montoAlquiler) === 0)).toBe(true);
    expect(data.every((l) => Number(l.montoTotal) === 80_000)).toBe(true);
  });

  it('el canon 0 del contrato limpio da el mismo resultado', () => {
    const data = computarLiquidacionesContrato(
      contrato('2026-06-01T00:00:00Z', '2028-06-01T00:00:00Z', {
        tipoContrato: 'SOLO_EXPENSAS',
        monto: 0,
        montoExpensas: 80_000,
      }),
      now,
    );
    expect(data.every((l) => Number(l.montoTotal) === 80_000)).toBe(true);
  });

  it('una vigencia futura de canon tampoco se le cobra', () => {
    // Un ajuste con vigencia futura entra por `vigencias`, no por `contrato.monto`:
    // si el corte estuviera antes de resolver el canon del período, este caso se colaba.
    const data = computarLiquidacionesContrato(
      contrato('2026-06-01T00:00:00Z', '2028-06-01T00:00:00Z', {
        tipoContrato: 'SOLO_EXPENSAS',
        monto: 0,
        montoExpensas: 80_000,
      }),
      now,
      [{ periodoDesde: '2026-07', monto: 900_000, montoAnterior: 0 }],
    );
    expect(data.every((l) => Number(l.montoAlquiler) === 0)).toBe(true);
    expect(data.every((l) => Number(l.montoTotal) === 80_000)).toBe(true);
  });

  it('ALQUILER_Y_EXPENSAS sí cobra las dos cosas', () => {
    const data = computarLiquidacionesContrato(
      contrato('2026-06-01T00:00:00Z', '2028-06-01T00:00:00Z', {
        tipoContrato: 'ALQUILER_Y_EXPENSAS',
        monto: 500_000,
        montoExpensas: 80_000,
      }),
      now,
    );
    expect(data.every((l) => Number(l.montoAlquiler) === 500_000)).toBe(true);
    expect(data.every((l) => Number(l.montoTotal) === 580_000)).toBe(true);
  });
});

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

  it('T-60 — contrato que TERMINA el 05/09 con diaPago 10: no se factura septiembre', () => {
    // Simétrico del caso de arriba, en el otro extremo. El tope de la enumeración es de
    // granularidad MES, así que septiembre entraba con vencimiento 10/09: CINCO DÍAS después
    // de terminado el contrato. Se le cobraba el mes entero por esos días, con comisión, y
    // una vez cobrada la baja del contrato ya no podía deshacerla.
    const now = new Date('2026-08-20T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-01-01T00:00:00Z', '2026-09-05T00:00:00Z', { diaPago: 10 }),
      now,
    );
    const periodos = data.map((l) => l.periodo);
    expect(periodos).not.toContain('2026-09');
    // Y ninguna cuota vence después del fin del contrato.
    for (const l of data) {
      expect((l.fechaVencimiento as Date) <= new Date('2026-09-05T00:00:00Z')).toBe(true);
    }
  });

  it('T-60 — si el vencimiento cae JUSTO el día de fin, la cuota sí va', () => {
    // Borde del borde: venc 05/09 == fin 05/09 no es "después del fin".
    const now = new Date('2026-08-20T12:00:00Z');
    const data = computarLiquidacionesContrato(
      contrato('2026-01-01T00:00:00Z', '2026-09-05T00:00:00Z', { diaPago: 5 }),
      now,
    );
    expect(data.map((l) => l.periodo)).toContain('2026-09');
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

  it('SOLO_EXPENSAS con monto 0: limpia también las cuotas VENCIDAS', () => {
    // Éste es el camino de NORMALIZACIÓN de un contrato ya ensuciado: `PATCH /monto` con 0.
    // Tiene que alcanzar las VENCIDAS, no sólo las PENDIENTE — si sólo tocara las pendientes,
    // los meses que ya vencieron con alquiler cobrado de más quedarían sucios para siempre
    // (el devengo usa createMany skipDuplicates y nunca pisa una fila existente).
    const out = recomputarLiquidacionesFuturas(
      [
        liq({ id: 'jul', periodo: '2026-07', estado: 'VENCIDO', montoExpensas: 50_000 }),
        liq({ id: 'ago', periodo: '2026-08', estado: 'PENDIENTE', montoExpensas: 50_000 }),
      ],
      { montoNuevo: 0, tipoContrato: 'SOLO_EXPENSAS', periodoActual },
    );
    expect(out).toEqual([
      { id: 'jul', montoAlquiler: 0, montoTotal: 50_000 },
      { id: 'ago', montoAlquiler: 0, montoTotal: 50_000 },
    ]);
  });

  it('normalizar NO toca una cuota que ya tiene pagos', () => {
    // Si ya se cobró, corregir la liquidación en silencio escondería el problema: esa plata
    // entró y hay que resolverla con la persona, no borrando el número.
    const out = recomputarLiquidacionesFuturas(
      [liq({ id: 'jul', periodo: '2026-07', estado: 'VENCIDO', montoExpensas: 50_000, cantidadPagos: 1 })],
      { montoNuevo: 0, tipoContrato: 'SOLO_EXPENSAS', periodoActual },
    );
    expect(out).toEqual([]);
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

describe('recomputarExpensasFuturas (cambio de expensas)', () => {
  /**
   * Las expensas suben todos los meses, así que este camino se usa seguido.
   * Comparte el criterio conservador del ajuste de canon: no toca meses pasados
   * ni cuotas con plata en juego. La diferencia es cuál de los dos montos se
   * conserva — acá el alquiler de CADA liquidación queda como está.
   */
  const periodoActual = '2026-07';
  function liq(over: Partial<LiquidacionParaReexpensar>): LiquidacionParaReexpensar {
    return {
      id: 'liq_x',
      periodo: '2026-07',
      estado: 'PENDIENTE',
      montoAlquiler: 500_000,
      montoExpensas: 80_000,
      cantidadPagos: 0,
      ...over,
    };
  }

  it('actualiza la cuota del mes en curso y recalcula el total', () => {
    const r = recomputarExpensasFuturas([liq({})], { expensasNuevas: 95_000, periodoActual });

    expect(r).toHaveLength(1);
    expect(r[0]?.montoExpensas).toBe(95_000);
    expect(r[0]?.montoTotal).toBe(595_000);
  });

  it('NO toca los meses pasados: el inquilino ya vio ese valor', () => {
    expect(recomputarExpensasFuturas([liq({ periodo: '2026-06' })], { expensasNuevas: 95_000, periodoActual }))
      .toHaveLength(0);
  });

  it('NO toca una cuota PAGADA ni una PARCIAL: ya hay plata contra el total viejo', () => {
    const r = recomputarExpensasFuturas(
      [liq({ id: 'a', estado: 'PAGADO' }), liq({ id: 'b', estado: 'PARCIAL' })],
      { expensasNuevas: 95_000, periodoActual },
    );

    expect(r).toHaveLength(0);
  });

  it('NO toca una cuota con un pago INFORMADO, aunque siga PENDIENTE', () => {
    // El inquilino ya informó una transferencia contra el total que vio.
    expect(recomputarExpensasFuturas([liq({ cantidadPagos: 1 })], { expensasNuevas: 95_000, periodoActual }))
      .toHaveLength(0);
  });

  it('SÍ toca una VENCIDA impaga: sigue siendo lo que se le va a reclamar', () => {
    const r = recomputarExpensasFuturas([liq({ estado: 'VENCIDO' })], { expensasNuevas: 95_000, periodoActual });

    expect(r).toHaveLength(1);
  });

  it('conserva el alquiler de CADA cuota, que puede diferir entre meses', () => {
    // Un ajuste con vigencia futura deja meses con canon distinto. Cambiar las
    // expensas no puede uniformarlos.
    const r = recomputarExpensasFuturas(
      [
        liq({ id: 'a', periodo: '2026-07', montoAlquiler: 500_000 }),
        liq({ id: 'b', periodo: '2026-08', montoAlquiler: 620_000 }),
      ],
      { expensasNuevas: 95_000, periodoActual },
    );

    expect(r.map((x) => x.montoTotal)).toEqual([595_000, 715_000]);
  });

  it('bajar las expensas a 0 deja el total en el alquiler solo', () => {
    const r = recomputarExpensasFuturas([liq({})], { expensasNuevas: 0, periodoActual });

    expect(r[0]?.montoExpensas).toBe(0);
    expect(r[0]?.montoTotal).toBe(500_000);
  });

  it('una cuota SIN expensas pasa a tenerlas, sumando al total', () => {
    const r = recomputarExpensasFuturas([liq({ montoExpensas: null })], { expensasNuevas: 95_000, periodoActual });

    expect(r[0]?.montoTotal).toBe(595_000);
  });

  it('no devuelve las que ya están en el monto nuevo: nada que escribir', () => {
    expect(recomputarExpensasFuturas([liq({ montoExpensas: 95_000 })], { expensasNuevas: 95_000, periodoActual }))
      .toHaveLength(0);
    // null y 0 son la misma cosa ("sin expensas"), así que tampoco.
    expect(recomputarExpensasFuturas([liq({ montoExpensas: null })], { expensasNuevas: 0, periodoActual }))
      .toHaveLength(0);
  });

  it('un contrato de solo expensas (alquiler 0) queda con el total en las expensas', () => {
    const r = recomputarExpensasFuturas(
      [liq({ montoAlquiler: 0, montoExpensas: 285_000 })],
      { expensasNuevas: 310_000, periodoActual },
    );

    expect(r[0]?.montoTotal).toBe(310_000);
  });
});
