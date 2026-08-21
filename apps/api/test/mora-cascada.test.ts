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

const INMO_COBRA_DIARIO = { moraTipoDefault: 'PORCENTAJE_DIARIO' as const, moraValorDefault: 0.5, monedaDefault: 'ARS' };

describe('resolverEsquemaMora — la cascada contrato > legacy > inmobiliaria', () => {
  it('el contrato PISA el default de la inmobiliaria', () => {
    const e = resolverEsquemaMora({ moraTipo: 'MONTO_FIJO', moraValor: 5000, moneda: 'ARS' }, INMO_COBRA_DIARIO);
    expect(e.origen).toBe('CONTRATO');
    expect(e.tipo).toBe('MONTO_FIJO');
    expect(e.valor).toBe(5000);
  });

  it('el valor sale del MISMO lado que el tipo, no mezclado', () => {
    // Si el tipo viniera del contrato y el valor del default, un MONTO_FIJO se cobraría con
    // el 0.5 del porcentaje diario: $0,50 de mora en vez de $5.000. Silencioso y absurdo.
    const e = resolverEsquemaMora({ moraTipo: 'MONTO_FIJO', moraValor: 5000, moneda: 'ARS' }, INMO_COBRA_DIARIO);
    expect(e.valor).not.toBe(INMO_COBRA_DIARIO.moraValorDefault);
  });

  it('un contrato en SIN_MORA pisa a una inmobiliaria que SÍ cobra mora', () => {
    // El opt-out por contrato: se pactó sin punitorios aunque la inmo cobre por default.
    const e = resolverEsquemaMora({ moraTipo: 'SIN_MORA', moraValor: null, moneda: 'ARS' }, INMO_COBRA_DIARIO);
    expect(e.origen).toBe('CONTRATO');
    expect(e.tipo).toBe('SIN_MORA');
  });

  it('sin esquema en el contrato manda la tasa legacy', () => {
    const e = resolverEsquemaMora({ tasaPunitorioDiaria: 0.3, moneda: 'ARS' }, INMO_COBRA_DIARIO);
    expect(e.origen).toBe('LEGACY');
    expect(e.tipo).toBe('PORCENTAJE_DIARIO');
    expect(e.valor).toBe(0.3);
  });

  it('una tasa legacy en 0 NO cuenta como esquema: sigue la cascada', () => {
    const e = resolverEsquemaMora({ tasaPunitorioDiaria: 0, moneda: 'ARS' }, INMO_COBRA_DIARIO);
    expect(e.origen).toBe('INMOBILIARIA');
  });

  it('sin contrato ni legacy manda el default de la inmobiliaria', () => {
    const e = resolverEsquemaMora({ moneda: 'ARS' }, INMO_COBRA_DIARIO);
    expect(e.origen).toBe('INMOBILIARIA');
    expect(e.tipo).toBe('PORCENTAJE_DIARIO');
    expect(e.valor).toBe(0.5);
  });

  it('un default de inmobiliaria en SIN_MORA no se aplica: cae a SIN_MORA por el final', () => {
    const e = resolverEsquemaMora({ moneda: 'ARS' }, { moraTipoDefault: 'SIN_MORA', moraValorDefault: null });
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
    const inmoCara = { moraTipoDefault: 'PORCENTAJE_DIARIO' as const, moraValorDefault: 1, monedaDefault: 'ARS' };
    const delContrato = resolverEsquemaMora({ moraTipo: 'MONTO_FIJO', moraValor: 5000, moneda: 'ARS' }, inmoCara);
    const deLaInmo = resolverEsquemaMora({ moneda: 'ARS' }, inmoCara);

    const conOverride = calcularMora(BASE, delContrato, VENC, DIEZ_DIAS_DESPUES);
    const sinOverride = calcularMora(BASE, deLaInmo, VENC, DIEZ_DIAS_DESPUES);

    expect(conOverride).toBe(5000); // fijo, 1 mes iniciado
    expect(sinOverride).toBe(10_000); // 1% × 10 días sobre 100.000
    expect(conOverride).not.toBe(sinOverride);
  });

  it('el opt-out del contrato deja la mora en CERO aunque la inmobiliaria cobre', () => {
    const e = resolverEsquemaMora({ moraTipo: 'SIN_MORA', moraValor: null, moneda: 'ARS' }, INMO_COBRA_DIARIO);
    expect(calcularMora(BASE, e, VENC, DIEZ_DIAS_DESPUES)).toBe(0);
  });
});

/**
 * T-58 · Un MONTO FIJO heredado sólo vale en su propia moneda.
 *
 * EL CASO, con números. El admin configura la mora default como `MONTO_FIJO = 5000`, pensada
 * en pesos —la pantalla que la carga ni siquiera pide moneda—. Un contrato en **USD** sin mora
 * propia (el wizard arranca en HEREDAR, y la importación de cartera tampoco la setea) heredaba
 * ese default y lo aplicaba 1:1:
 *
 *     alquiler US$ 800 + mora US$ 5.000 = US$ 5.800 exigibles.
 *
 * Cinco mil dólares de punitorio sobre un alquiler de ochocientos. Y eso es lo que la PWA le
 * reclama al inquilino, lo que topea `POST /pagos/informar` y lo que muestra el panel.
 *
 * POR QUÉ SIN_MORA Y NO UNA CONVERSIÓN. No hay cotización en el sistema. Inventarla sería
 * reemplazar un número equivocado por otro, y encima uno que se mueve todos los días. Cobrar
 * de menos se corrige cargándole la mora al contrato; cobrar US$ 5.000 de más ya se le
 * reclamó a una persona.
 *
 * Los PORCENTAJES no tienen este problema y por eso se siguen heredando: se aplican sobre la
 * base, que ya está en la moneda del contrato.
 */
describe('T-58 · el monto fijo heredado respeta la moneda', () => {
  const INMO_FIJO_EN_PESOS = {
    moraTipoDefault: 'MONTO_FIJO' as const,
    moraValorDefault: 5000,
    monedaDefault: 'ARS',
  };

  it('un contrato en ARS SÍ hereda el monto fijo del tenant', () => {
    // El caso normal, que no se puede romper arreglando el otro.
    const e = resolverEsquemaMora({ moneda: 'ARS' }, INMO_FIJO_EN_PESOS);
    expect(e.origen).toBe('INMOBILIARIA');
    expect(e.tipo).toBe('MONTO_FIJO');
    expect(e.valor).toBe(5000);
  });

  it('un contrato en USD NO hereda una mora fija cargada en pesos', () => {
    // EL BUG. Antes devolvía MONTO_FIJO 5000 y se aplicaba como US$ 5.000.
    const e = resolverEsquemaMora({ moneda: 'USD' }, INMO_FIJO_EN_PESOS);
    expect(e.tipo).toBe('SIN_MORA');
    expect(e.origen).toBe('SIN_MORA');
  });

  it('y por lo tanto la mora del contrato en USD es CERO, no 5.000', () => {
    // La prueba en plata: sobre un alquiler de US$ 800, a 40 días de atraso.
    const venc = new Date('2026-08-01T00:00:00Z');
    const asOf = new Date('2026-09-10T12:00:00Z');
    const e = resolverEsquemaMora({ moneda: 'USD' }, INMO_FIJO_EN_PESOS);
    expect(calcularMora(800, e, venc, asOf)).toBe(0);
  });

  it('un PORCENTAJE heredado se aplica igual en cualquier moneda', () => {
    // No es un olvido: un porcentaje se calcula sobre la base, que ya está en la moneda del
    // contrato. Cortarlo sería dejar sin mora a todos los contratos en dólares de un tenant
    // que cobra por porcentaje, que es un bug nuevo en el lado opuesto.
    const inmoPct = { moraTipoDefault: 'PORCENTAJE_DIARIO' as const, moraValorDefault: 0.5, monedaDefault: 'ARS' };
    const e = resolverEsquemaMora({ moneda: 'USD' }, inmoPct);
    expect(e.origen).toBe('INMOBILIARIA');
    expect(e.tipo).toBe('PORCENTAJE_DIARIO');
  });

  it('el override del CONTRATO manda aunque las monedas no coincidan', () => {
    // Si la inmobiliaria pactó una mora fija con ESE inquilino, está expresada en la moneda de
    // ese contrato: no hay nada que adivinar y la regla no aplica.
    const e = resolverEsquemaMora(
      { moraTipo: 'MONTO_FIJO', moraValor: 50, moneda: 'USD' },
      INMO_FIJO_EN_PESOS,
    );
    expect(e.origen).toBe('CONTRATO');
    expect(e.valor).toBe(50);
  });

  it('sin contrato no se hereda un monto fijo: no se sabe en qué moneda cobrarlo', () => {
    const e = resolverEsquemaMora(null, INMO_FIJO_EN_PESOS);
    expect(e.tipo).toBe('SIN_MORA');
  });

  it('si el tenant no tiene monedaDefault, tampoco se hereda a ciegas', () => {
    // Defensivo y a propósito: `monedaDefault` tiene default 'ARS' en el schema, así que esto
    // no debería pasar. Pero si alguna vez llega en null, adivinar es justo lo que este
    // arreglo evita.
    const e = resolverEsquemaMora({ moneda: 'ARS' }, { moraTipoDefault: 'MONTO_FIJO', moraValorDefault: 5000 });
    expect(e.tipo).toBe('SIN_MORA');
  });
});
