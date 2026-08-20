/**
 * `yaVencio` y `venceDespuesDeHoy` — los dos predicados que deciden si una cuota es deuda.
 *
 * POR QUÉ IMPORTA. Viven en `packages/shared`, o sea que los usan **la API y los dos fronts**:
 * si se corren un día, se corren en los tres lados a la vez. Y deciden cosas que se le cobran a
 * una persona: qué cuotas puede cancelar el depósito en garantía (`aplicar-deposito.ts`), qué
 * períodos admiten estado inicial al dar de alta un contrato en curso
 * (`estado-inicial-contrato.ts`) y qué aparece como deuda exigible.
 *
 * Tenían **cero tests**. El archivo `vencimiento-huso-horario.test.ts` cubre `diaCivilAR` y la
 * mora, pero no toca ninguno de los dos predicados.
 *
 * LO QUE MÁS SE PUEDE ROMPER SIN QUERER: **no son negaciones el uno del otro.** El propio día
 * del vencimiento las dos dan `false` —la cuota ya está devengada pero todavía no es deuda— y
 * esa franja de un día es justamente la que hay que respetar. Escribir
 * `venceDespuesDeHoy = !yaVencio` parece una simplificación obvia y le mete al inquilino un día
 * de mora que no debe.
 */
import { describe, it, expect } from 'vitest';
import { diaCivilAR, instanteEnDiaCivilAR, venceDespuesDeHoy, yaVencio } from '@llave/shared';

/** Vencimiento del 10 de agosto, guardado como medianoche UTC de ese día civil. */
const VENCE_EL_10 = new Date('2026-08-10T00:00:00.000Z');

/** Instantes reales, en UTC, con su hora argentina al lado. */
const EL_9_A_LAS_18 = new Date('2026-08-09T21:00:00.000Z');
const EL_10_A_LAS_09 = new Date('2026-08-10T12:00:00.000Z');
const EL_10_A_LAS_2330 = new Date('2026-08-11T02:30:00.000Z'); // ya es 11 en UTC
const EL_11_A_LAS_0030 = new Date('2026-08-11T03:30:00.000Z');

describe('yaVencio · el día del vencimiento todavía NO es deuda', () => {
  it('el día ANTERIOR no está vencida', () => {
    expect(yaVencio(VENCE_EL_10, EL_9_A_LAS_18)).toBe(false);
  });

  it('el PROPIO día del vencimiento tampoco: le queda el día entero para pagar', () => {
    // Si vence el 10, recién es deuda el 11. Cortar acá le cobraría mora a alguien que está
    // dentro del plazo.
    expect(yaVencio(VENCE_EL_10, EL_10_A_LAS_09)).toBe(false);
  });

  it('a las 23:30 del 10 en Argentina SIGUE sin vencer, aunque en UTC ya sea 11', () => {
    // EL CASO QUE ROMPE SI SE COMPARA CONTRA EL INSTANTE UTC. A las 23:30 hora local ya son las
    // 02:30Z del día siguiente: con una comparación ingenua el inquilino aparece moroso con el
    // día de pago todavía sin terminar.
    expect(yaVencio(VENCE_EL_10, EL_10_A_LAS_2330)).toBe(false);
  });

  it('recién a las 00:30 del 11 (hora argentina) queda vencida', () => {
    expect(yaVencio(VENCE_EL_10, EL_11_A_LAS_0030)).toBe(true);
  });

  it('acepta la fecha como string, no sólo como Date', () => {
    // Los callers la traen de Prisma (Date) y del panel (string 'YYYY-MM-DD'). Si el string se
    // tratara distinto, el mismo vencimiento daría dos respuestas según de dónde vino.
    expect(yaVencio('2026-08-10', EL_11_A_LAS_0030)).toBe(true);
    expect(yaVencio('2026-08-10', EL_10_A_LAS_09)).toBe(false);
  });
});

describe('venceDespuesDeHoy · sólo las cuotas realmente futuras', () => {
  it('el día anterior sí es futura', () => {
    expect(venceDespuesDeHoy(VENCE_EL_10, EL_9_A_LAS_18)).toBe(true);
  });

  it('el propio día del vencimiento YA NO es futura', () => {
    expect(venceDespuesDeHoy(VENCE_EL_10, EL_10_A_LAS_09)).toBe(false);
  });

  it('a las 23:30 del 9 en Argentina todavía es futura, aunque en UTC ya sea 10', () => {
    const el9ALas2330 = new Date('2026-08-10T02:30:00.000Z');
    expect(venceDespuesDeHoy(VENCE_EL_10, el9ALas2330)).toBe(true);
  });

  it('después del vencimiento no es futura', () => {
    expect(venceDespuesDeHoy(VENCE_EL_10, EL_11_A_LAS_0030)).toBe(false);
  });
});

describe('LA TRAMPA · los dos predicados NO son negaciones', () => {
  it('el día del vencimiento las DOS dan false', () => {
    // Es la franja de un día en que la cuota ya está devengada pero todavía no es deuda.
    // Escribir `venceDespuesDeHoy = !yaVencio` la borra y le mete al inquilino un día de mora
    // que no debe — y como viven en packages/shared, se lo mete en los tres lados a la vez.
    expect(yaVencio(VENCE_EL_10, EL_10_A_LAS_09)).toBe(false);
    expect(venceDespuesDeHoy(VENCE_EL_10, EL_10_A_LAS_09)).toBe(false);
  });

  it('nunca son las dos verdaderas a la vez, en ningún día', () => {
    // Barrido de cinco días alrededor del vencimiento: pasado, borde y futuro.
    for (let d = 8; d <= 12; d++) {
      const momento = new Date(`2026-08-${String(d).padStart(2, '0')}T12:00:00.000Z`);
      const vencida = yaVencio(VENCE_EL_10, momento);
      const futura = venceDespuesDeHoy(VENCE_EL_10, momento);
      expect(vencida && futura, `el ${d} dio las dos verdaderas`).toBe(false);
    }
  });
});

describe('instanteEnDiaCivilAR · el inverso, que existe por un corrimiento real', () => {
  it('una fecha civil vuelve a SU propio día', () => {
    // `diaCivilAR` está escrito para INSTANTES. Pasarle una fecha civil pelada devuelve el día
    // ANTERIOR siempre —no es un borde, es un corrimiento constante—, y todo cálculo de mora
    // con un `asOf` de fecha pelada perdía un día. Con mora de monto fijo mensual, un día de
    // menos en un múltiplo de 30 se lleva un MES entero.
    expect(diaCivilAR(instanteEnDiaCivilAR(VENCE_EL_10)).toISOString()).toBe(VENCE_EL_10.toISOString());
  });

  it('sin el helper, la fecha pelada se corre un día para atrás', () => {
    // Se fija el comportamiento equivocado a propósito: es lo que hace que el helper tenga que
    // existir, y si algún día `diaCivilAR` dejara de corresponderse con esto, el helper pasaría
    // a corregir un problema que ya no está.
    expect(diaCivilAR(VENCE_EL_10).toISOString()).toBe('2026-08-09T00:00:00.000Z');
  });

  it('cae al mediodía argentino, lejos de los dos bordes del día', () => {
    // Mediodía y no 00:01 ni 23:59: cualquier cálculo que sume o reste unas horas sigue cayendo
    // dentro del mismo día civil.
    expect(instanteEnDiaCivilAR(VENCE_EL_10).toISOString()).toBe('2026-08-10T15:00:00.000Z');
  });
});
