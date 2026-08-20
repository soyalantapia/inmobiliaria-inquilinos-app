import { describe, expect, it } from 'vitest';

import {
  esSoloExpensas,
  montoMensual,
  montoMensualDeReferencia,
  mostrarFilaAlquiler,
} from './tipo-contrato';
import type { Contrato, Liquidacion } from './types';

const contrato = (over: Partial<Contrato> = {}): Contrato =>
  ({
    id: 'cnt_1',
    estado: 'ACTIVO',
    direccion: 'Gorriti 4521, 3°B',
    ciudad: 'CABA',
    inmobiliaria: 'Inmobiliaria del Sol',
    fechaInicio: '2025-09-01',
    fechaFin: '2028-08-31',
    diaPago: 5,
    indiceAjuste: 'ICL',
    proximoAjuste: '2026-06-01',
    montoActual: 480_000,
    moneda: 'ARS',
    ...over,
  }) as Contrato;

const liq = (over: Partial<Liquidacion> = {}): Liquidacion =>
  ({
    id: 'liq_1',
    contratoId: 'cnt_1',
    periodo: '2026-08',
    montoAlquiler: 480_000,
    montoExpensas: 90_000,
    montoPunitorio: 0,
    montoTotal: 570_000,
    fechaVencimiento: '2026-08-05',
    estado: 'PENDIENTE',
    ...over,
  }) as Liquidacion;

describe('esSoloExpensas', () => {
  it('un contrato sin tipoContrato (dato viejo) es alquiler normal', () => {
    expect(esSoloExpensas(contrato({ tipoContrato: undefined }))).toBe(false);
  });

  it('null/undefined no rompen', () => {
    expect(esSoloExpensas(null)).toBe(false);
    expect(esSoloExpensas(undefined)).toBe(false);
  });

  it('sólo es true con el tipo explícito', () => {
    expect(esSoloExpensas(contrato({ tipoContrato: 'SOLO_EXPENSAS' }))).toBe(true);
    expect(esSoloExpensas(contrato({ tipoContrato: 'ALQUILER' }))).toBe(false);
  });

  it('un monto en 0 NO alcanza para tratarlo como solo expensas', () => {
    // Un borrador o un contrato mal cargado también puede tener monto 0, y ahí
    // el rótulo correcto sigue siendo "alquiler".
    expect(esSoloExpensas(contrato({ montoActual: 0, tipoContrato: 'ALQUILER' }))).toBe(false);
  });
});

describe('mostrarFilaAlquiler', () => {
  it('se muestra cuando hay alquiler devengado', () => {
    expect(mostrarFilaAlquiler(liq())).toBe(true);
  });

  it('NO se muestra con alquiler en 0 — era el "Alquiler $0" del desglose', () => {
    expect(mostrarFilaAlquiler(liq({ montoAlquiler: 0 }))).toBe(false);
  });

  it('tolera el string que manda Prisma para los Decimal', () => {
    expect(mostrarFilaAlquiler(liq({ montoAlquiler: '0' as unknown as number }))).toBe(false);
    expect(mostrarFilaAlquiler(liq({ montoAlquiler: '480000' as unknown as number }))).toBe(true);
  });
});

describe('montoMensual', () => {
  it('alquiler normal: rótulo y monto de siempre', () => {
    expect(montoMensual(contrato())).toEqual({ label: 'Alquiler actual', monto: 480_000 });
  });

  it('solo expensas: no dice "alquiler" ni muestra el 0', () => {
    const r = montoMensual(contrato({ tipoContrato: 'SOLO_EXPENSAS', montoActual: 0, montoExpensas: 90_000 }));
    expect(r).toEqual({ label: 'Expensas por mes', monto: 90_000 });
  });

  it('solo expensas sin expensas cargadas: null, no 0', () => {
    // Preferimos no mostrar cifra antes que mostrar "$0", que se lee como "no debés nada".
    const r = montoMensual(contrato({ tipoContrato: 'SOLO_EXPENSAS', montoActual: 0, montoExpensas: null }));
    expect(r.monto).toBeNull();
  });
});

describe('montoMensualDeReferencia', () => {
  it('alquiler normal: usa el canon vigente del contrato', () => {
    expect(montoMensualDeReferencia(contrato(), liq())).toBe(480_000);
  });

  it('el bug del ?? : con montoActual 0 NO devuelve 0', () => {
    // Era `contrato?.montoActual ?? liq.montoAlquiler`: `??` no cae en 0, así que la
    // referencia quedaba en 0 y `saldo > 0 * 1.2` se cumplía con cualquier deuda →
    // el banner de "pactá un plan" le saltaba a un solo-expensas al día.
    const c = contrato({ tipoContrato: 'SOLO_EXPENSAS', montoActual: 0, montoExpensas: 90_000 });
    const l = liq({ montoAlquiler: 0, montoExpensas: 90_000, montoTotal: 90_000 });
    expect(montoMensualDeReferencia(c, l)).toBe(90_000);
  });

  it('un saldo de un período NO supera el umbral de 1.2x', () => {
    const c = contrato({ tipoContrato: 'SOLO_EXPENSAS', montoActual: 0, montoExpensas: 90_000 });
    const l = liq({ montoAlquiler: 0, montoExpensas: 90_000, montoTotal: 90_000 });
    const saldo = 90_000;
    expect(saldo > montoMensualDeReferencia(c, l) * 1.2).toBe(false);
  });

  it('dos períodos acumulados SÍ lo superan — el banner sigue sirviendo', () => {
    const c = contrato({ tipoContrato: 'SOLO_EXPENSAS', montoActual: 0, montoExpensas: 90_000 });
    const l = liq({ montoAlquiler: 0, montoExpensas: 90_000, montoTotal: 90_000 });
    const saldo = 180_000;
    expect(saldo > montoMensualDeReferencia(c, l) * 1.2).toBe(true);
  });

  it('sin contrato cargado cae a la liquidación', () => {
    expect(montoMensualDeReferencia(null, liq())).toBe(480_000);
  });

  it('último recurso: el total del período', () => {
    const l = liq({ montoAlquiler: 0, montoExpensas: 0, montoTotal: 120_000 });
    expect(montoMensualDeReferencia(null, l)).toBe(120_000);
  });
});
