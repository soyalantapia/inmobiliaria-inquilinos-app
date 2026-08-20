/**
 * T-62 · La bandeja de validación prometía un saldo que al validar valía cero.
 *
 * EL CASO. Liquidación de $600.000, vence el 10/08, mora 0,15% diario ($900/día). El
 * inquilino informa el 15/08 por $604.500 — que es exactamente lo que le mostró su app
 * (600.000 + 5 días). La inmobiliaria lo valida el 18/08.
 *
 * Durante esos tres días `GET /pagos` calculaba la mora con `hoy`: $607.200. La bandeja
 * renderizaba "si lo validás queda $2.700" (pagos-por-validar.tsx:1043). Al validar,
 * `POST /pagos/:id/validar` usa la `fechaTransferencia` del pago → $604.500, cobrado
 * $604.500, saldo $0. Los $2.700 no existieron nunca: eran los días que el pago pasó
 * esperando que alguien lo mirara, y no los debía nadie.
 *
 * El arreglo mueve la decisión a `asOfMora`, que es la única que las dos rutas consultan.
 *
 * DÓNDE NO VA, y por qué es la mitad del hallazgo. La revisión pedía propagar el congelado
 * a `deudaTotal` y al KPI de morosidad. Ahí NO corresponde: la `fechaTransferencia` la
 * carga el inquilino (con backdate de hasta 30 días — el guard de /pagos/informar existe
 * justamente porque se auto-condonaban punitorios fechando antes del vencimiento) y nadie
 * verificó todavía que la plata haya entrado. Un KPI que la respetara dejaría que
 * cualquiera se borre de la lista de morosos informando un pago inexistente. Un pago
 * INFORMADO es un reclamo sin verificar, no una deuda saldada.
 *
 * Test puro: no toca la base ni la red.
 */
import { describe, it, expect } from 'vitest';
import { asOfMora, calcularMora } from '../src/lib/punitorios.js';

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

const HOY = d('2026-08-18');
const informado = (fecha: string) => ({ estado: 'INFORMADO', fechaTransferencia: d(fecha) });
const impaga = { estado: 'PENDIENTE', fechaPago: null };

describe('T-62 — con qué fecha se corta la mora del renglón', () => {
  it('un pago INFORMADO congela en SU fechaTransferencia, no en hoy', () => {
    expect(asOfMora(informado('2026-08-15'), impaga, HOY)).toEqual(d('2026-08-15'));
  });

  it('sin pago en vuelo, una liq impaga sigue corriendo hasta hoy', () => {
    expect(asOfMora({ estado: 'CONCILIADO', fechaTransferencia: d('2026-08-15') }, impaga, HOY)).toBe(HOY);
  });

  it('un RECHAZADO no congela nada: esa plata nunca entró', () => {
    // Si congelara, rechazar un informe falso saldría gratis en punitorios.
    expect(asOfMora({ estado: 'RECHAZADO', fechaTransferencia: d('2026-08-15') }, impaga, HOY)).toBe(HOY);
  });

  it('una liq PAGADA congela en su fechaPago (el criterio que ya existía)', () => {
    const liq = { estado: 'PAGADO', fechaPago: d('2026-08-12') };
    expect(asOfMora({ estado: 'CONCILIADO', fechaTransferencia: d('2026-08-15') }, liq, HOY)).toEqual(
      d('2026-08-12'),
    );
  });

  it('el INFORMADO gana sobre la liq PAGADA: es lo que validar va a usar', () => {
    // Puede pasar: entró un cobro por otra vía mientras el informe esperaba decisión.
    const liq = { estado: 'PAGADO', fechaPago: d('2026-08-12') };
    expect(asOfMora(informado('2026-08-15'), liq, HOY)).toEqual(d('2026-08-15'));
  });
});

describe('T-62 — la plata que la bandeja inventaba', () => {
  const VENCE = new Date('2026-08-10T00:00:00.000Z');
  const ESQUEMA = { tipo: 'PORCENTAJE_DIARIO' as const, valor: 0.15 };
  const BASE = 600_000;

  const moraAl = (asOf: Date) => calcularMora(BASE, ESQUEMA, VENCE, asOf, null);

  it('el renglón "si lo validás queda" ahora da cero', () => {
    const pago = informado('2026-08-15');
    // Lo que el inquilino transfirió: lo que su app le mostró al día 15.
    const transferido = BASE + moraAl(d('2026-08-15'));
    expect(transferido).toBe(604_500);

    // Antes: la bandeja calculaba con hoy (18/08) y sobraba deuda.
    const conBug = BASE + moraAl(HOY) - transferido;
    expect(conBug).toBe(2_700);

    // Ahora: la bandeja usa el mismo asOf que validar.
    const ahora = BASE + moraAl(asOfMora(pago, impaga, HOY)) - transferido;
    expect(ahora).toBe(0);
  });

  it('el fantasma crecía con cada día de demora en decidir', () => {
    const transferido = BASE + moraAl(d('2026-08-15'));
    for (const [dia, fantasma] of [['2026-08-16', 900], ['2026-08-20', 4_500], ['2026-08-25', 9_000]] as const) {
      expect(BASE + moraAl(d(dia)) - transferido).toBe(fantasma);
      // Con el arreglo no depende de cuándo lo miren.
      expect(BASE + moraAl(asOfMora(informado('2026-08-15'), impaga, d(dia))) - transferido).toBe(0);
    }
  });
});
