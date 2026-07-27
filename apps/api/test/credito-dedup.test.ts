import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { claveCredito } from '../src/lib/matching-bancario.js';

// CAZABUG P1 — los bancos exportan por rango de fechas y el operador sube rangos SOLAPADOS
// (o re-sube el mismo archivo). Sin dedup, la MISMA transferencia entraba dos veces como
// créditos distintos y el matcher la ofrecía contra dos liquidaciones: dos pagos CONCILIADO
// por una sola plata, que después se rinden al propietario.

const linea = {
  fecha: new Date('2026-06-01T00:00:00.000Z'),
  monto: 150000,
  titularOrigen: 'PEREZ JUAN',
  concepto: 'TRANSFERENCIA',
  nroOperacion: '99887766',
};

describe('CAZABUG — clave de dedup de créditos', () => {
  it('la misma línea da la misma clave (aunque venga de otro extracto)', () => {
    expect(claveCredito(linea)).toBe(claveCredito({ ...linea }));
  });

  it('el monto de la DB (Decimal) matchea con el del parser (number)', () => {
    // Al re-subir, lo ya cargado vuelve como Prisma.Decimal y lo nuevo es number:
    // si la clave no los normalizara, el dedup NUNCA encontraría el duplicado.
    const desdeDb = { ...linea, monto: new Prisma.Decimal('150000.00') };
    expect(claveCredito(desdeDb)).toBe(claveCredito(linea));
  });

  it('la fecha como string ISO matchea con la fecha como Date', () => {
    expect(claveCredito({ ...linea, fecha: '2026-06-01T00:00:00.000Z' })).toBe(claveCredito(linea));
  });

  it('ignora mayúsculas y espacios de más en titular y concepto', () => {
    expect(claveCredito({ ...linea, titularOrigen: '  perez juan ', concepto: ' transferencia  ' })).toBe(claveCredito(linea));
  });

  it('un monto distinto NO deduplica (dos pagos reales del mismo día)', () => {
    expect(claveCredito({ ...linea, monto: 150001 })).not.toBe(claveCredito(linea));
  });

  it('una fecha distinta NO deduplica', () => {
    expect(claveCredito({ ...linea, fecha: new Date('2026-06-02T00:00:00.000Z') })).not.toBe(claveCredito(linea));
  });

  it('otro titular por el mismo monto NO deduplica', () => {
    expect(claveCredito({ ...linea, titularOrigen: 'GOMEZ ANA' })).not.toBe(claveCredito(linea));
  });

  it('otra operación NO deduplica (dos transferencias idénticas con nro distinto)', () => {
    expect(claveCredito({ ...linea, nroOperacion: '11112222' })).not.toBe(claveCredito(linea));
  });

  it('nulls no explotan y son estables', () => {
    const sinDatos = { ...linea, titularOrigen: null, concepto: null, nroOperacion: null };
    expect(claveCredito(sinDatos)).toBe(claveCredito({ ...sinDatos }));
    expect(claveCredito(sinDatos)).not.toBe(claveCredito(linea));
  });
});
