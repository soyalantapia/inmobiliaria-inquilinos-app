/**
 * TERCERA AUDITORÍA · La mora fantasma que quedaba cobrable.
 *
 * El server tiene una regla (T-58, `resolverEsquemaMora`): un default `MONTO_FIJO` es un
 * IMPORTE ABSOLUTO y sólo se hereda si la moneda del default coincide con la del contrato.
 * Los porcentajes se heredan siempre — se aplican sobre una base que ya está en la moneda
 * del contrato.
 *
 * El panel reimplementaba la herencia SIN esa regla. Y no quedaba en un cartel equivocado:
 * el wizard de alta usa ese esquema para prefillear el `moraManual` de cada período vencido
 * y lo manda en el alta. El server lo persiste como `montoPunitorioManual`, y `calcularMora`
 * arranca con `if (manual != null) return manual` — o sea que el número del front PISA el
 * `SIN_MORA` que el propio server había resuelto. Sobre un alquiler de US$ 800 con 26 meses
 * vencidos y un default de 800 pensado en pesos: **US$ 20.800 de deuda punitoria real**,
 * cobrable y visible en la PWA del inquilino.
 *
 * ESTE TEST PASA LA MISMA TABLA POR LAS DOS IMPLEMENTACIONES y exige que coincidan. No
 * alcanza con que el front tenga "una" regla: tiene que tener LA del server, que es quien
 * manda. Si mañana el server cambia la suya, este test se pone en rojo del lado del panel.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): sacando la rama
 * `heredado.tipo === 'MONTO_FIJO' && heredado.moneda !== monedaContrato` de `moraEfectivaDe`,
 * fallan los dos casos cruzados y la paridad. Sacando `monedaDefault` del payload de
 * `GET /cobranza`, el panel no compila.
 */
import { describe, it, expect } from 'vitest';
import type { TipoMora } from '@/lib/types';
import { moraEfectivaDe, calcularMora } from './mora-selector';
import { resolverEsquemaMora } from '../../../api/src/lib/punitorios';

type Caso = {
  nombre: string;
  defaultTipo: TipoMora;
  defaultValor: number;
  monedaDefault: 'ARS' | 'USD';
  monedaContrato: 'ARS' | 'USD';
  esperado: { tipo: TipoMora; valor: number };
};

const CASOS: Caso[] = [
  {
    nombre: 'monto fijo en la MISMA moneda se hereda',
    defaultTipo: 'MONTO_FIJO',
    defaultValor: 5000,
    monedaDefault: 'ARS',
    monedaContrato: 'ARS',
    esperado: { tipo: 'MONTO_FIJO', valor: 5000 },
  },
  {
    nombre: 'monto fijo en pesos NO se hereda a un contrato en dólares',
    defaultTipo: 'MONTO_FIJO',
    defaultValor: 800,
    monedaDefault: 'ARS',
    monedaContrato: 'USD',
    esperado: { tipo: 'SIN_MORA', valor: 0 },
  },
  {
    nombre: 'ni al revés: monto fijo en dólares tampoco baja a un contrato en pesos',
    defaultTipo: 'MONTO_FIJO',
    defaultValor: 800,
    monedaDefault: 'USD',
    monedaContrato: 'ARS',
    esperado: { tipo: 'SIN_MORA', valor: 0 },
  },
  {
    nombre: 'un PORCENTAJE sí cruza monedas: se aplica sobre la base del contrato',
    defaultTipo: 'PORCENTAJE_DIARIO',
    defaultValor: 0.15,
    monedaDefault: 'ARS',
    monedaContrato: 'USD',
    esperado: { tipo: 'PORCENTAJE_DIARIO', valor: 0.15 },
  },
  {
    nombre: 'el porcentaje mensual también',
    defaultTipo: 'PORCENTAJE_MENSUAL',
    defaultValor: 4.5,
    monedaDefault: 'ARS',
    monedaContrato: 'USD',
    esperado: { tipo: 'PORCENTAJE_MENSUAL', valor: 4.5 },
  },
];

describe('la mora heredada no cambia de moneda', () => {
  for (const c of CASOS) {
    it(`${c.nombre} — panel`, () => {
      const r = moraEfectivaDe(
        'HEREDAR',
        '',
        { tipo: c.defaultTipo, valor: c.defaultValor, moneda: c.monedaDefault },
        c.monedaContrato,
      );
      expect({ tipo: r.tipo, valor: r.valor }).toEqual(c.esperado);
    });

    it(`${c.nombre} — el server dice lo mismo`, () => {
      const r = resolverEsquemaMora(
        { moraTipo: null, moraValor: null, tasaPunitorioDiaria: null, moneda: c.monedaContrato },
        {
          moraTipoDefault: c.defaultTipo,
          moraValorDefault: c.defaultValor,
          monedaDefault: c.monedaDefault,
        },
      );
      expect({ tipo: r.tipo, valor: r.valor ?? 0 }).toEqual(c.esperado);
    });
  }

  it('elegir un esquema para ESTE contrato no pasa por la herencia', () => {
    const r = moraEfectivaDe(
      'MONTO_FIJO',
      '900',
      { tipo: 'MONTO_FIJO', valor: 5000, moneda: 'ARS' },
      'USD',
    );
    // Lo que el operador eligió a mano ES para este contrato: se respeta tal cual.
    expect(r).toEqual({ tipo: 'MONTO_FIJO', valor: 900, herenciaDescartada: false });
  });

  it('avisa cuándo descartó la herencia, para no mostrar un cero mudo', () => {
    const cruzado = moraEfectivaDe('HEREDAR', '', { tipo: 'MONTO_FIJO', valor: 800, moneda: 'ARS' }, 'USD');
    expect(cruzado.herenciaDescartada).toBe(true);
    // Un default SIN_MORA no es una herencia descartada: es que no hay mora y punto.
    const sinMora = moraEfectivaDe('HEREDAR', '', { tipo: 'SIN_MORA', valor: null, moneda: 'ARS' }, 'USD');
    expect(sinMora.herenciaDescartada).toBe(false);
  });
});

describe('y por eso el alta no congela un punitorio que no corresponde', () => {
  it('el prefill de un período vencido queda en 0 cuando la herencia no aplica', () => {
    // El escenario del informe: alquiler US$ 800, default de 800 cargado pensando en pesos,
    // 26 meses vencidos. Con el bug el wizard prefilleaba 800 × 26 = US$ 20.800 y los mandaba
    // como `moraManual`, que el server guarda en `montoPunitorioManual` y respeta antes que
    // su propio SIN_MORA.
    const conBug = calcularMora('MONTO_FIJO', 800, 800, 26 * 30);
    expect(conBug).toBe(20800);

    const efectivo = moraEfectivaDe('HEREDAR', '', { tipo: 'MONTO_FIJO', valor: 800, moneda: 'ARS' }, 'USD');
    expect(calcularMora(efectivo.tipo, efectivo.valor, 800, 26 * 30)).toBe(0);
  });

  it('y sigue prefilleando cuando la herencia SÍ aplica', () => {
    const efectivo = moraEfectivaDe('HEREDAR', '', { tipo: 'MONTO_FIJO', valor: 5000, moneda: 'ARS' }, 'ARS');
    expect(calcularMora(efectivo.tipo, efectivo.valor, 500_000, 60)).toBe(10_000);
  });
});
