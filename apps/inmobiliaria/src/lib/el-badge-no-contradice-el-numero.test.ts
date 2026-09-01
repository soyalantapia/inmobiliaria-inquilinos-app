/**
 * CUARTA AUDITORÍA · Toda unidad funcional cargada desde el panel figuraba "Al día", debiera lo
 * que debiera.
 *
 * `UnidadFuncional.estado` y `saldoDeudor` son dos columnas independientes. El único formulario
 * del producto que crea o edita una unidad arma el body con identificación, titular, teléfono,
 * coeficiente, cargo fijo y saldo deudor — y **no manda `estado`**, porque el diálogo no tiene
 * ningún control para ese campo. El server sólo lo escribe si viene. Resultado: ninguna unidad
 * cargada desde el panel sale jamás del default `AL_DIA`.
 *
 * EL ESCENARIO. La administradora edita 3°B y le carga saldo deudor 480.000 (deuda histórica al
 * migrar el edificio). En la misma fila queda "$480.000" en ámbar y, al lado, un badge **verde**
 * que dice "Al día". Arriba, la tarjeta de morosidad —que sí sale de `saldoDeudor`— dice
 * "1 unidad con deuda · $480.000". La misma pantalla, dos respuestas.
 *
 * No se ve en la demo: las unidades del seed traen estados variados y consistentes con su saldo.
 * Por eso el caso que importa acá es el del medio —el que la demo no tiene—.
 */
import { describe, it, expect } from 'vitest';
import { badgeDeUnidad, ESTADO_UF_LABEL, ESTADO_UF_COLOR, type BadgeUF } from './consorcios-storage';

const uf = (estado: 'AL_DIA' | 'PENDIENTE' | 'VENCIDO' | 'CON_PLAN_PAGO', saldoDeudor: number) => ({
  estado,
  saldoDeudor,
});

describe('el badge de la unidad no contradice el saldo que tiene al lado', () => {
  it('🔴 con deuda y estado AL_DIA —lo que deja SIEMPRE el panel— no dice "Al día"', () => {
    const badge = badgeDeUnidad(uf('AL_DIA', 480_000));
    expect(badge).toBe('CON_DEUDA');
    expect(ESTADO_UF_LABEL[badge]).toBe('Con deuda');
    // Y no se pinta de verde al lado de un número en ámbar.
    expect(ESTADO_UF_COLOR[badge]).not.toContain('emerald');
  });

  it('no inventa "Vencido": sin emisión de expensas no hay fecha contra la cual decir eso', () => {
    expect(badgeDeUnidad(uf('AL_DIA', 1))).not.toBe('VENCIDO');
  });

  it('🔴 la contradicción de ida también: sin deuda, un estado de mora no se sostiene', () => {
    expect(badgeDeUnidad(uf('VENCIDO', 0))).toBe('AL_DIA');
    expect(badgeDeUnidad(uf('PENDIENTE', 0))).toBe('AL_DIA');
    expect(badgeDeUnidad(uf('CON_PLAN_PAGO', 0))).toBe('AL_DIA');
  });

  it('CONTROL POSITIVO — un estado guardado que SÍ cuadra manda, porque dice más que el número', () => {
    // Esto es lo que se perdería derivando el badge del saldo y listo: "Plan de pago" y
    // "Vencido" son información de la administración que `saldoDeudor` no sabe.
    expect(badgeDeUnidad(uf('CON_PLAN_PAGO', 380_000))).toBe('CON_PLAN_PAGO');
    expect(badgeDeUnidad(uf('VENCIDO', 540_000))).toBe('VENCIDO');
    expect(badgeDeUnidad(uf('PENDIENTE', 245_000))).toBe('PENDIENTE');
    expect(badgeDeUnidad(uf('AL_DIA', 0))).toBe('AL_DIA');
  });

  it('un saldo negativo (pagó de más) cuenta como al día, no como deuda', () => {
    expect(badgeDeUnidad(uf('AL_DIA', -5_000))).toBe('AL_DIA');
    expect(badgeDeUnidad(uf('VENCIDO', -5_000))).toBe('AL_DIA');
  });

  it('las cinco etiquetas tienen texto y color: un badge sin entrada se renderiza vacío', () => {
    // La lección de `auditoria-labels`: agregar un valor al tipo y olvidar su etiqueta deja la
    // pantalla mostrando un hueco, sin que nada falle.
    const todos: BadgeUF[] = ['AL_DIA', 'PENDIENTE', 'VENCIDO', 'CON_PLAN_PAGO', 'CON_DEUDA'];
    for (const b of todos) {
      expect(ESTADO_UF_LABEL[b], `falta la etiqueta de ${b}`).toBeTruthy();
      expect(ESTADO_UF_COLOR[b], `falta el color de ${b}`).toBeTruthy();
    }
  });
});
