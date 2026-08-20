/**
 * T-63 · `z.number().nonnegative()` acepta `Infinity`, y toda la plata del API estaba así.
 *
 * EL AGUJERO. zod 3 sólo rechaza `NaN`: `Infinity` es un number y `Infinity > 0` da true, así
 * que pasaba la validación de los 31 campos de plata y mora del API. Ninguno tenía `.int()`
 * ni `.max()` que lo atajara de rebote.
 *
 * DOS DAÑOS DISTINTOS, Y EL PEOR NO ES EL QUE PARECE.
 *
 *  - En las 48 columnas `Decimal(14, 2)` —que son TODAS las Decimal del schema— Postgres
 *    rechaza el valor: 500. Molesto, visible, no ensucia nada.
 *
 *  - En las columnas `Float` —`Contrato.moraValor`, `Inmobiliaria.moraValorDefault`—
 *    `double precision` **sí guarda Infinity**. El valor absurdo no falla: queda persistido.
 *    Y `calcularMora` no tiene red contra eso —`!esquema.valor` es false para Infinity, y
 *    `esquema.valor <= 0` también— así que devuelve `base * (Infinity / 100) * dias` =
 *    **Infinity**, que entra en el `montoTotal` y el `saldo` de TODAS las cuotas de ese
 *    contrato: la PWA del inquilino, los comprobantes, la deuda del panel y las métricas.
 *    Un solo PATCH a `/contratos/:id/mora` lo dejaba así para siempre.
 *
 * EL TECHO ES LA COLUMNA, no una regla de negocio: `Decimal(14, 2)` son 12 dígitos enteros,
 * o sea 999.999.999.999,99. Por encima de eso el sistema no puede GUARDAR el número.
 *
 * LO QUE ESTO NO ARREGLA: que alguien cargue $9.000.000 donde iban $90.000. Eso necesita
 * topes y aprobación — decisión de producto, anotada en T-63.
 *
 * Test puro: no toca la base ni la red.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { dinero, dineroPositivo, dineroConSigno, MAX_MONTO } from '../src/lib/monto.js';
import { calcularMora } from '../src/lib/punitorios.js';

describe('T-63 — el agujero que había', () => {
  it('el patrón viejo aceptaba Infinity: por eso hubo que barrer 31 campos', () => {
    expect(z.number().nonnegative().safeParse(Infinity).success).toBe(true);
    expect(z.number().positive().safeParse(Infinity).success).toBe(true);
    expect(z.number().min(0).safeParse(Infinity).success).toBe(true);
    // Los que ya estaban a salvo, y por qué el barrido fue de 31 y no de 34.
    expect(z.number().int().safeParse(Infinity).success).toBe(false);
    expect(z.number().positive().max(100).safeParse(Infinity).success).toBe(false);
  });

  it('Infinity en moraValor envenenaba la mora de todas las cuotas del contrato', () => {
    const venc = new Date('2026-08-10T00:00:00.000Z');
    const asOf = new Date('2026-08-20T12:00:00.000Z');
    const envenenado = calcularMora(600_000, { tipo: 'PORCENTAJE_DIARIO', valor: Infinity }, venc, asOf, null);
    expect(envenenado).toBe(Infinity);
    // Y no es un caso de borde del cálculo: con un valor sano da un número normal.
    expect(calcularMora(600_000, { tipo: 'PORCENTAJE_DIARIO', valor: 0.15 }, venc, asOf, null)).toBe(9_000);
  });
});

describe('T-63 — los validadores nuevos', () => {
  const casos = [
    ['dinero', dinero()],
    ['dineroPositivo', dineroPositivo()],
    ['dineroConSigno', dineroConSigno()],
  ] as const;

  it.each(casos)('%s rechaza Infinity, -Infinity y NaN', (_n, s) => {
    expect(s.safeParse(Infinity).success).toBe(false);
    expect(s.safeParse(-Infinity).success).toBe(false);
    expect(s.safeParse(NaN).success).toBe(false);
  });

  it.each(casos)('%s rechaza lo que la columna no puede guardar', (_n, s) => {
    expect(s.safeParse(1e30).success).toBe(false);
    expect(s.safeParse(MAX_MONTO + 1).success).toBe(false);
  });

  it.each(casos)('%s acepta el máximo exacto de Decimal(14,2)', (_n, s) => {
    expect(s.safeParse(MAX_MONTO).success).toBe(true);
    expect(MAX_MONTO).toBe(999_999_999_999.99);
  });

  it('dinero acepta cero y dineroPositivo no', () => {
    expect(dinero().safeParse(0).success).toBe(true);
    expect(dineroPositivo().safeParse(0).success).toBe(false);
  });

  it('sólo el de caja acepta negativos: un movimiento es ingreso o egreso', () => {
    expect(dineroConSigno().safeParse(-50_000).success).toBe(true);
    expect(dineroConSigno().safeParse(-MAX_MONTO - 1).success).toBe(false);
    expect(dinero().safeParse(-1).success).toBe(false);
    expect(dineroPositivo().safeParse(-1).success).toBe(false);
  });

  it('un monto normal sigue pasando por los tres', () => {
    for (const [, s] of casos) expect(s.safeParse(485_000.5).success).toBe(true);
  });
});
