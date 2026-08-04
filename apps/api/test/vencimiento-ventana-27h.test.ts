import { describe, it, expect } from 'vitest';
import { enumerarPeriodosContrato, yaVencio } from '@llave/shared/periodos';

/**
 * F4 — UN SOLO CORTE DE VENCIMIENTO.
 *
 * `enumerarPeriodosContrato` marcaba `vencido` con `venc < now` (instante UTC) y el
 * back valida el estado inicial con `yaVencio` (día civil argentino, UTC-3). Entre
 * los dos criterios quedaba una ventana de ~27 h — desde la medianoche UTC del día
 * de pago hasta las 00:00 AR del día siguiente — en la que el wizard OFRECÍA un
 * período que `aplicarEstadoInicial` RECHAZABA ("todavía no venció") → 400 →
 * rollback del alta entera: el operador tipeaba todo de vuelta. Un día por mes, a
 * cualquiera que cargara un contrato con día de pago reciente.
 *
 * Estos tests fijan el criterio: `p.vencido` tiene que ser EXACTAMENTE `yaVencio`
 * del mismo vencimiento, incluido cuando `now` cae dentro de la ventana.
 */

// Contrato que arrancó el 01/01/2026, paga el 10, y sigue vigente.
const CONTRATO = { fechaInicio: '2026-01-01', fechaFin: '2028-01-01', diaPago: 10 };

// El período '2026-11' vence el 2026-11-10T00:00:00Z (medianoche UTC del día civil).
const PERIODO = '2026-11';

function vencidoSegunElFront(now: Date): boolean {
  const p = enumerarPeriodosContrato(CONTRATO, now).find((x) => x.periodo === PERIODO);
  if (!p) throw new Error(`el período ${PERIODO} no se enumeró con now=${now.toISOString()}`);
  return p.vencido;
}

describe('F4 — la ventana de 27 h entre el corte del front y el del back', () => {
  // Los tres instantes de la ventana: el viejo `venc < now` daba `true` en los tres
  // (el vencimiento ya pasó en UTC) mientras el back decía que no; el criterio
  // unificado dice `false` hasta que el día de pago termina EN ARGENTINA.
  const dentroDeLaVentana = [
    { desc: 'apenas cruzada la medianoche UTC del día de pago', now: '2026-11-10T00:00:01Z' },
    { desc: 'el mediodía del propio día de pago', now: '2026-11-10T15:00:00Z' },
    { desc: 'el último segundo de la ventana (23:59:59 AR del día de pago)', now: '2026-11-11T02:59:59Z' },
  ];

  for (const c of dentroDeLaVentana) {
    it(`NO da por vencido el período — ${c.desc}`, () => {
      const now = new Date(c.now);
      expect(vencidoSegunElFront(now)).toBe(false);
      // Y el back opina lo mismo: eso es lo que evita el 400.
      expect(yaVencio(new Date(Date.UTC(2026, 10, 10)), now)).toBe(false);
    });
  }

  it('recién da por vencido a las 00:00 AR del día siguiente (fin de la ventana)', () => {
    const now = new Date('2026-11-11T03:00:00Z');
    expect(vencidoSegunElFront(now)).toBe(true);
    expect(yaVencio(new Date(Date.UTC(2026, 10, 10)), now)).toBe(true);
  });

  it('la víspera del día de pago sigue sin vencer (no se adelantó el corte)', () => {
    const now = new Date('2026-11-09T20:00:00Z');
    expect(vencidoSegunElFront(now)).toBe(false);
  });

  /**
   * La invariante general, no sólo el caso de borde: TODO período enumerado tiene que
   * coincidir con `yaVencio`. Barremos hora por hora los tres días alrededor del
   * vencimiento — ahí vive la ventana — para que ninguna reescritura futura del
   * criterio pueda volver a separarlos sin que este test se ponga rojo.
   */
  it('p.vencido === yaVencio(p.vencimiento, now) en cada hora de los 3 días del vencimiento', () => {
    const desde = Date.UTC(2026, 10, 9);
    for (let h = 0; h < 72; h += 1) {
      const now = new Date(desde + h * 60 * 60 * 1000);
      for (const p of enumerarPeriodosContrato(CONTRATO, now)) {
        expect(p.vencido, `${p.periodo} con now=${now.toISOString()}`).toBe(yaVencio(p.vencimiento, now));
      }
    }
  });
});
