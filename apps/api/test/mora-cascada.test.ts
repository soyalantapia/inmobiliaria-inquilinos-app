/**
 * La cascada que decide QUÉ mora se le cobra a un contrato — y que no tenía un solo test.
 *
 * CÓMO APARECIÓ. Mutación sobre `lib/punitorios.ts`: se desactivó entero el override por
 * contrato (`if (false && contrato?.moraTipo)`) y **la suite completa siguió en verde** —
 * los 51 tests puros que tocan mora y también los tres CON BASE que setean `moraTipo`.
 *
 * Por qué no lo agarraba nadie: esos tres lo setean en `SIN_MORA` **para desactivar la mora**
 * y que no les ensucie lo que están midiendo, y ni el seed ni ellos configuran un default de
 * inmobiliaria. Con o sin override, el resultado era el mismo: cero. O sea que el override se
 * ejercitaba sólo en la única dirección donde romperlo no se nota.
 *
 * QUÉ PASA SI SE ROMPE. Un contrato con su propia mora pactada cae al default de la
 * inmobiliaria: a un inquilino con `MONTO_FIJO $5.000` se le empieza a cobrar el
 * `PORCENTAJE_DIARIO` de la inmo, o al revés. No es un error visible — es un número distinto
 * en la deuda de una persona real, y la mora se calcula on-read, así que cambia sola en toda
 * la pantalla sin que quede rastro de nada.
 *
 * Estos tests son PUROS: `resolverEsquemaMora` y `calcularMora` no tocan la base.
 */
import { describe, it, expect } from 'vitest';
import { resolverEsquemaMora, calcularMora } from '../src/lib/punitorios.js';

const INMO_COBRA_DIARIO = { moraTipoDefault: 'PORCENTAJE_DIARIO' as const, moraValorDefault: 0.5 };

describe('resolverEsquemaMora — la cascada contrato > legacy > inmobiliaria', () => {
  it('el contrato PISA el default de la inmobiliaria', () => {
    const e = resolverEsquemaMora({ moraTipo: 'MONTO_FIJO', moraValor: 5000 }, INMO_COBRA_DIARIO);
    expect(e.origen).toBe('CONTRATO');
    expect(e.tipo).toBe('MONTO_FIJO');
    expect(e.valor).toBe(5000);
  });

  it('el valor sale del MISMO lado que el tipo, no mezclado', () => {
    // Si el tipo viniera del contrato y el valor del default, un MONTO_FIJO se cobraría con
    // el 0.5 del porcentaje diario: $0,50 de mora en vez de $5.000. Silencioso y absurdo.
    const e = resolverEsquemaMora({ moraTipo: 'MONTO_FIJO', moraValor: 5000 }, INMO_COBRA_DIARIO);
    expect(e.valor).not.toBe(INMO_COBRA_DIARIO.moraValorDefault);
  });

  it('un contrato en SIN_MORA pisa a una inmobiliaria que SÍ cobra mora', () => {
    // El opt-out por contrato: se pactó sin punitorios aunque la inmo cobre por default.
    const e = resolverEsquemaMora({ moraTipo: 'SIN_MORA', moraValor: null }, INMO_COBRA_DIARIO);
    expect(e.origen).toBe('CONTRATO');
    expect(e.tipo).toBe('SIN_MORA');
  });

  it('sin esquema en el contrato manda la tasa legacy', () => {
    const e = resolverEsquemaMora({ tasaPunitorioDiaria: 0.3 }, INMO_COBRA_DIARIO);
    expect(e.origen).toBe('LEGACY');
    expect(e.tipo).toBe('PORCENTAJE_DIARIO');
    expect(e.valor).toBe(0.3);
  });

  it('una tasa legacy en 0 NO cuenta como esquema: sigue la cascada', () => {
    const e = resolverEsquemaMora({ tasaPunitorioDiaria: 0 }, INMO_COBRA_DIARIO);
    expect(e.origen).toBe('INMOBILIARIA');
  });

  it('sin contrato ni legacy manda el default de la inmobiliaria', () => {
    const e = resolverEsquemaMora({}, INMO_COBRA_DIARIO);
    expect(e.origen).toBe('INMOBILIARIA');
    expect(e.tipo).toBe('PORCENTAJE_DIARIO');
    expect(e.valor).toBe(0.5);
  });

  it('un default de inmobiliaria en SIN_MORA no se aplica: cae a SIN_MORA por el final', () => {
    const e = resolverEsquemaMora({}, { moraTipoDefault: 'SIN_MORA', moraValorDefault: null });
    expect(e.origen).toBe('SIN_MORA');
  });

  it('sin nada configurado, SIN_MORA', () => {
    expect(resolverEsquemaMora(null, null).origen).toBe('SIN_MORA');
    expect(resolverEsquemaMora(undefined).tipo).toBe('SIN_MORA');
  });
});

describe('la cascada en PESOS — que el override no sea sólo una etiqueta', () => {
  const VENC = new Date('2026-08-01T00:00:00Z');
  const DIEZ_DIAS_DESPUES = new Date('2026-08-11T12:00:00Z');
  const BASE = 100_000;

  it('se cobra la mora DEL CONTRATO, no la de la inmobiliaria', () => {
    // Los dos esquemas dan números muy distintos sobre la misma deuda: fijo $5.000 contra
    // 0,5% diario × 10 días = $5.000... a propósito NO: se elige 1% para que no empaten y el
    // test no pueda pasar por casualidad.
    const inmoCara = { moraTipoDefault: 'PORCENTAJE_DIARIO' as const, moraValorDefault: 1 };
    const delContrato = resolverEsquemaMora({ moraTipo: 'MONTO_FIJO', moraValor: 5000 }, inmoCara);
    const deLaInmo = resolverEsquemaMora({}, inmoCara);

    const conOverride = calcularMora(BASE, delContrato, VENC, DIEZ_DIAS_DESPUES);
    const sinOverride = calcularMora(BASE, deLaInmo, VENC, DIEZ_DIAS_DESPUES);

    expect(conOverride).toBe(5000); // fijo, 1 mes iniciado
    expect(sinOverride).toBe(10_000); // 1% × 10 días sobre 100.000
    expect(conOverride).not.toBe(sinOverride);
  });

  it('el opt-out del contrato deja la mora en CERO aunque la inmobiliaria cobre', () => {
    const e = resolverEsquemaMora({ moraTipo: 'SIN_MORA', moraValor: null }, INMO_COBRA_DIARIO);
    expect(calcularMora(BASE, e, VENC, DIEZ_DIAS_DESPUES)).toBe(0);
  });
});
