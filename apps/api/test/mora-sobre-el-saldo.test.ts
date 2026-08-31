/**
 * T-57 · La mora corre sobre el SALDO, no sobre el total original.
 *
 * EL BUG. Una cuota de $600.000 que vence el 10/08 con mora del 0,15% diario. El inquilino paga
 * **$599.000 el mismo 10/08** —en fecha, sin un día de atraso— y queda debiendo $1.000. Treinta
 * días después la mora se calculaba sobre los $600.000 **completos**: $27.000 de punitorios por
 * deber $1.000. Y ese total inflado es lo que veía el inquilino en la PWA, lo que topeaba
 * `POST /pagos/informar` y lo que mostraba el panel.
 *
 * LA REGLA ELEGIDA (opción (a), decisión del dueño el 21/08): **se descuenta sólo lo que entró
 * en fecha**. Lo pagado hasta el vencimiento reduce el capital sobre el que corre toda la mora;
 * lo pagado TARDE no la borra retroactivamente.
 *
 * Por qué no la ingenua (`total − todo lo conciliado`): haría que pagar tarde reduzca punitorios
 * ya devengados, y al inquilino le convendría pagar tarde y de a poco. El tercer caso de acá
 * abajo es el que cuida eso, y es el que más importa: sin él, el arreglo se "simplifica" solo.
 *
 * NO NECESITA BASE: es aritmética pura sobre `calcularMora`. La partición lo manda al job
 * `revision` sin que nadie lo liste.
 */
import { describe, it, expect } from 'vitest';
import { calcularMora, capitalConMora, type EsquemaMora } from '../src/lib/punitorios.js';

/** 0,15% diario — la tasa del caso del ticket. */
const DIARIO: EsquemaMora = { tipo: 'PORCENTAJE_DIARIO', valor: 0.15 };
const VENCE = new Date('2026-08-10T00:00:00.000Z');
/** Treinta días de atraso. */
const A_30_DIAS = new Date('2026-09-09T12:00:00.000Z');

describe('T-57 — la mora corre sobre el saldo, no sobre el total', () => {
  it('el caso del ticket: pagar $599.000 en fecha deja la mora sobre $1.000, no sobre $600.000', () => {
    const conBug = calcularMora({ total: 600_000, pagadoAlVencimiento: 0 }, DIARIO, VENCE, A_30_DIAS);
    const arreglado = calcularMora(
      { total: 600_000, pagadoAlVencimiento: 599_000 },
      DIARIO,
      VENCE,
      A_30_DIAS,
    );

    // Control: así se cobraba antes — 600.000 × 0,15% × 30.
    expect(conBug).toBe(27_000);
    // Y así se cobra ahora: 1.000 × 0,15% × 30.
    //
    // ⚠️ El documento de la tarea dice "$450" acá. Es un desliz de una coma: con 0,15% diario a
    // 30 días sobre $1.000 son **$45**. El número que sí está bien en el ticket es el del caso
    // de abajo ($4.500 sobre $100.000), que usa la misma cuenta.
    expect(arreglado).toBe(45);
  });

  it('el caso frecuente: paga $500.000 de $600.000 en fecha y la mora baja de $27.000 a $4.500', () => {
    expect(calcularMora({ total: 600_000, pagadoAlVencimiento: 500_000 }, DIARIO, VENCE, A_30_DIAS)).toBe(4_500);
  });

  it('🔴 pagar TARDE no borra la mora ya devengada — es lo que separa esta regla de la ingenua', () => {
    // El inquilino pagó $599.000, pero DESPUÉS del vencimiento: `pagadoAlVencimiento` es 0
    // porque el corte lo hace la fecha de transferencia, no el monto. La mora sigue corriendo
    // sobre el capital que estaba impago cuando venció.
    const pagoTardio = calcularMora({ total: 600_000, pagadoAlVencimiento: 0 }, DIARIO, VENCE, A_30_DIAS);
    expect(pagoTardio).toBe(27_000);
    // Si algún día alguien "unifica" esto con `total − todo lo conciliado`, este assert se pone
    // rojo. Es a propósito: sería volver a premiar al que paga tarde.
  });

  it('pagar todo en fecha deja la mora en cero', () => {
    expect(calcularMora({ total: 600_000, pagadoAlVencimiento: 600_000 }, DIARIO, VENCE, A_30_DIAS)).toBe(0);
  });

  it('pagar de más en fecha no genera mora negativa', () => {
    expect(calcularMora({ total: 600_000, pagadoAlVencimiento: 700_000 }, DIARIO, VENCE, A_30_DIAS)).toBe(0);
    expect(capitalConMora({ total: 600_000, pagadoAlVencimiento: 700_000 })).toBe(0);
    // Y un `pagadoAlVencimiento` corrupto (negativo) tampoco puede inflar el capital.
    expect(capitalConMora({ total: 600_000, pagadoAlVencimiento: -100_000 })).toBe(600_000);
  });

  it('el MONTO FIJO no se prorratea, pero desaparece si la cuota se pagó entera en fecha', () => {
    const fijo: EsquemaMora = { tipo: 'MONTO_FIJO', valor: 5_000 };
    // Debe algo → el fijo se cobra igual, no en proporción a lo que quedó debiendo.
    expect(calcularMora({ total: 600_000, pagadoAlVencimiento: 599_000 }, fijo, VENCE, A_30_DIAS)).toBe(5_000);
    // No debe nada → no hay mora que cobrar.
    expect(calcularMora({ total: 600_000, pagadoAlVencimiento: 600_000 }, fijo, VENCE, A_30_DIAS)).toBe(0);
  });

  it('el porcentaje MENSUAL sigue la misma regla', () => {
    const mensual: EsquemaMora = { tipo: 'PORCENTAJE_MENSUAL', valor: 5 };
    // 100.000 de capital × 5% × (30/30 meses).
    expect(calcularMora({ total: 600_000, pagadoAlVencimiento: 500_000 }, mensual, VENCE, A_30_DIAS)).toBe(5_000);
  });

  it('la mora manual pisa todo, incluso el capital ya saldado', () => {
    expect(
      calcularMora({ total: 600_000, pagadoAlVencimiento: 600_000 }, DIARIO, VENCE, A_30_DIAS, 1_234),
    ).toBe(1_234);
  });

  it('sin atraso no hay mora, aunque deba el total', () => {
    const elDiaDelVencimiento = new Date('2026-08-10T12:00:00.000Z');
    expect(calcularMora({ total: 600_000, pagadoAlVencimiento: 0 }, DIARIO, VENCE, elDiaDelVencimiento)).toBe(0);
  });
});
