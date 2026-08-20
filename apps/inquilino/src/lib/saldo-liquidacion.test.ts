import { describe, it, expect } from 'vitest';
import { saldoDeLiquidacion } from './saldo-liquidacion';

/**
 * CAZABUG — el home decía "atrasado" a alguien que acababa de informar el pago.
 *
 * En el build demo los pagos no viven en `liq.pagos` (ese campo es el espejo del API) sino en
 * `pago-storage`, con otro tipo. `saldoDeLiquidacion` pedía una `Liquidacion` entera, así que
 * pasarle los pagos del store obligaba a fabricar un `PagoDeLiquidacion` completo —doce campos
 * inventados— para colar dos números. Nadie lo hizo, y el resultado era que el home y la
 * pantalla de detalle daban dos verdades sobre la misma cuota.
 *
 * Estos tests usan la forma del STORE LOCAL a propósito: si alguien vuelve a angostar la firma
 * a `Liquidacion`, dejan de compilar. Ese es medio punto del test.
 */

// Tal cual sale de `pago-storage`: sólo estado y monto, que es lo único que la función mira.
const pagoLocal = (estado: 'INFORMADO' | 'CONCILIADO' | 'RECHAZADO', monto: number) => ({
  estado,
  monto,
});

describe('saldoDeLiquidacion — con los pagos del store local (demo)', () => {
  it('informó el total: no falta nada y queda marcado como en revisión', () => {
    const det = saldoDeLiquidacion({ saldo: 100_000, pagos: [pagoLocal('INFORMADO', 100_000)] }, 0);

    // Es LA condición del banner ámbar: con faltaPagar > 0 el home dice "Te faltan $X".
    expect(det.faltaPagar).toBe(0);
    expect(det.hayEnRevision).toBe(true);
    expect(det.enRevision).toBe(100_000);
  });

  it('informó una parte: falta el resto, y lo dice con el número exacto', () => {
    const det = saldoDeLiquidacion({ saldo: 100_000, pagos: [pagoLocal('INFORMADO', 30_000)] }, 0);
    expect(det.faltaPagar).toBe(70_000);
    expect(det.hayEnRevision).toBe(true);
  });

  it('sin ningún pago informado, falta todo — el caso "atrasado" de verdad', () => {
    const det = saldoDeLiquidacion({ saldo: 100_000, pagos: [] }, 0);
    expect(det.faltaPagar).toBe(100_000);
    expect(det.hayEnRevision).toBe(false);
  });

  it('un pago RECHAZADO no cuenta: volvió a ser deuda', () => {
    const det = saldoDeLiquidacion({ saldo: 100_000, pagos: [pagoLocal('RECHAZADO', 100_000)] }, 0);
    expect(det.faltaPagar).toBe(100_000);
    expect(det.hayEnRevision).toBe(false);
  });

  it('un CONCILIADO no se resta dos veces: ya está descontado en `saldo`', () => {
    // La inmo validó 40.000 → el backend dejó saldo en 60.000. Si acá se restaran otra vez,
    // faltaría 20.000 y el inquilino pagaría de menos.
    const det = saldoDeLiquidacion(
      { saldo: 60_000, montoPagado: 40_000, pagos: [pagoLocal('CONCILIADO', 40_000)] },
      0,
    );
    expect(det.faltaPagar).toBe(60_000);
    expect(det.hayConciliado).toBe(true);
    expect(det.hayEnRevision).toBe(false);
  });

  it('parte conciliada y parte en revisión: no falta nada, pero tampoco está cerrado', () => {
    const det = saldoDeLiquidacion(
      {
        saldo: 60_000,
        montoPagado: 40_000,
        pagos: [pagoLocal('CONCILIADO', 40_000), pagoLocal('INFORMADO', 60_000)],
      },
      0,
    );
    expect(det.faltaPagar).toBe(0);
    expect(det.hayEnRevision).toBe(true);
    expect(det.hayConciliado).toBe(true);
  });

  it('sin `saldo` del API usa el total que calculó la pantalla — el caso demo', () => {
    const det = saldoDeLiquidacion({ pagos: [pagoLocal('INFORMADO', 25_000)] }, 80_000);
    expect(det.exigible).toBe(80_000);
    expect(det.faltaPagar).toBe(55_000);
  });

  it('nunca devuelve negativos: informar de más no genera saldo a favor', () => {
    const det = saldoDeLiquidacion({ saldo: 50_000, pagos: [pagoLocal('INFORMADO', 90_000)] }, 0);
    expect(det.faltaPagar).toBe(0);
  });
});
