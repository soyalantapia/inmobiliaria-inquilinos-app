/**
 * El pago parcial no desaparece del tablero cuando la cuota se atrasa.
 *
 * De la segunda auditoría del 31/08. `VENCIDO` caía en el `default` del switch y aportaba 0 a
 * "Cobrado" — y el server **deriva** VENCIDO para cualquier PENDIENTE o PARCIAL cuyo vencimiento
 * pasó, así que un parcial dejaba de ser PARCIAL sólo por el calendario.
 */
import { describe, it, expect } from 'vitest';
import { cobradoRendible, plataDelContrato, type ContratoParaKpi } from './plata-del-contrato';

/** La cuota del escenario: 500.000, de la que ya pagaron 300.000. */
const parcial = (estado: string): ContratoParaKpi => ({
  estadoPagoActual: estado,
  monto: 500_000,
  montoPagado: 300_000,
  saldo: 200_000,
  deudaTotal: 200_000,
});

describe('lo que aporta un contrato a los KPIs del tablero', () => {
  it('🔴 el parcial que se atrasa NO pierde lo cobrado', () => {
    // El 5 pagan 300.000 y el 11 el server lo deriva a VENCIDO, sin que pase nada más.
    const antesDeVencer = plataDelContrato(parcial('PARCIAL'));
    const despuesDeVencer = plataDelContrato(parcial('VENCIDO'));
    expect(antesDeVencer.cobrado).toBe(300_000);
    expect(despuesDeVencer.cobrado).toBe(300_000); // ← antes daba 0
  });

  it('y lo que se debe va a mora, sin contarse dos veces', () => {
    // `deudaTotal` es lo que se DEBE (200.000), no el canon (500.000): sumar cobrado + mora da
    // el canon, no más. Si mora usara el canon, el contrato figuraría por 800.000.
    const v = plataDelContrato(parcial('VENCIDO'));
    expect(v.mora).toBe(200_000);
    expect(v.cobrado + v.mora).toBe(500_000);
  });

  it('el control que le da sentido: con la regla vieja, el número bajaba solo', () => {
    const viejo = (c: ContratoParaKpi) =>
      c.estadoPagoActual === 'PAGADO'
        ? c.montoPagado || c.monto
        : c.estadoPagoActual === 'PARCIAL'
          ? (c.montoPagado ?? 0)
          : 0;
    expect(viejo(parcial('PARCIAL'))).toBe(300_000);
    expect(viejo(parcial('VENCIDO'))).toBe(0); // ← el 11 de mes, sin devolver un peso
    expect(plataDelContrato(parcial('VENCIDO')).cobrado).toBe(300_000);
  });

  it('los otros tres estados siguen igual que antes', () => {
    expect(plataDelContrato({ estadoPagoActual: 'PAGADO', monto: 100, montoPagado: 100 })).toEqual({
      cobrado: 100,
      porCobrar: 0,
      mora: 0,
    });
    expect(plataDelContrato({ estadoPagoActual: 'PENDIENTE', monto: 100, saldo: 100 })).toEqual({
      cobrado: 0,
      porCobrar: 100,
      mora: 0,
    });
    expect(plataDelContrato({ estadoPagoActual: 'PARCIAL', monto: 100, montoPagado: 40, saldo: 60 })).toEqual({
      cobrado: 40,
      porCobrar: 60,
      mora: 0,
    });
  });

  it('un PAGADO sin montoPagado cae al canon: la liq migrada sin Pagos no queda en cero', () => {
    // Comportamiento viejo que hay que conservar: hay liquidaciones que quedaron PAGADAS por
    // migración de cartera, sin filas de Pago.
    expect(plataDelContrato({ estadoPagoActual: 'PAGADO', monto: 480_000, montoPagado: 0 }).cobrado).toBe(480_000);
  });

  it('un estado desconocido no rompe ni inventa plata', () => {
    expect(plataDelContrato({ estadoPagoActual: 'LO_QUE_SEA', monto: 999 })).toEqual({
      cobrado: 0,
      porCobrar: 0,
      mora: 0,
    });
  });
});

describe('lo rendible al dueño', () => {
  it('🔴 el vencido con pago parcial sigue teniendo algo rendible', () => {
    expect(cobradoRendible(parcial('VENCIDO'))).toBe(300_000);
  });

  it('el pendiente sin pagar no tiene nada', () => {
    expect(cobradoRendible({ estadoPagoActual: 'PENDIENTE', monto: 500_000 })).toBe(0);
  });
});
