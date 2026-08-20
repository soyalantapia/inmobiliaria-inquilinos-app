/**
 * La aritmética del cierre de caja diario (`GET /caja/cierre`).
 *
 * POR QUÉ IMPORTA. Es el arqueo que la cajera tiene en la mano al final del día, y hasta hoy
 * **no tenía un solo test**: la aritmética vivía inline en un handler que necesita Postgres,
 * así que quedaba del lado que no corre en CI. Dos de estas reglas ya rompieron una vez en
 * producción.
 *
 * Estos tests son PUROS: no tocan base ni red, corren en cualquier máquina y en CI.
 *
 * LO QUE NO CUBREN, y conviene saberlo para no confiarse: los filtros del `where` de Prisma
 * —excluir `PROPIETARIO_DIRECTO`, excluir condonados, el aislamiento por inmobiliaria y el
 * rango del día civil argentino— **no son aritmética y no se ven desde acá**. Eso necesita
 * tests de integración (T-28-N1-N3).
 */
import { describe, it, expect } from 'vitest';
import {
  comisionDePago,
  porcionAlquilerDelPago,
  totalizarCierre,
  type PagoParaCierre,
} from '../src/lib/cierre-caja.js';

/** Un dueño único al 100% con 8% de comisión: el caso corriente. */
const UN_DUENO = [{ porcentaje: 100, propietario: { comisionPct: 8 } }];

function pago(over: Partial<PagoParaCierre> = {}): PagoParaCierre {
  return {
    monto: 600000,
    moneda: 'ARS',
    liqAlquiler: 500000,
    liqTotal: 600000,
    participaciones: UN_DUENO,
    ...over,
  };
}

describe('porción de alquiler dentro del pago', () => {
  it('deja las EXPENSAS afuera: sobre 500.000 de alquiler + 100.000 de expensas, la base es 500.000', () => {
    // El error más caro y más silencioso del cierre. Las expensas van al consorcio;
    // comisionarlas le cobra a la inmobiliaria plata que no le corresponde, y no se nota
    // porque el número igual "se ve razonable". Al 8% son $8.000/mes de más por contrato.
    expect(porcionAlquilerDelPago({ monto: 600000, liqAlquiler: 500000, liqTotal: 600000 })).toBe(500000);
  });

  it('CAPEA la mora: un pago de 630.000 sobre una liquidación de 600.000 no infla la base', () => {
    // La mora es ingreso de la inmobiliaria, no base de comisión ni de rendición. Sin el cap,
    // el cierre comisiona sobre la mora y deja de cuadrar contra la rendición, que sí capea.
    expect(porcionAlquilerDelPago({ monto: 630000, liqAlquiler: 500000, liqTotal: 600000 })).toBe(500000);
  });

  it('prorratea un pago PARCIAL', () => {
    // Media liquidación pagada → media base de alquiler. Si esto se rompiera, un parcial
    // comisionaría como si fuera un pago entero.
    expect(porcionAlquilerDelPago({ monto: 300000, liqAlquiler: 500000, liqTotal: 600000 })).toBe(250000);
  });

  it('con la liquidación en 0 devuelve 0, NUNCA NaN', () => {
    // El caso SOLO_EXPENSAS sin expensas cargadas. Sin la guarda, la división es 0/0 = NaN, el
    // NaN se propaga al total del día y JSON.stringify lo serializa como null: la cajera
    // cerraría el día sin comisión y la pantalla NO fallaría, se vería vacía.
    const r = porcionAlquilerDelPago({ monto: 0, liqAlquiler: 0, liqTotal: 0 });
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBe(0);
  });
});

describe('comisión de un pago', () => {
  it('redondea a CENTAVOS, no a peso entero', () => {
    // Es el bug B3, que ya ocurrió. La rendición persiste la comisión en Decimal(14,2): si el
    // cierre redondea a peso, cierre y rendición divergen de a centavos y el operador no puede
    // conciliar. Con 200 contratos el drift deja de ser invisible.
    // 333.333,33 × 8% = 26.666,6664 → 26.666,67 (a peso entero daría 26.667).
    const c = comisionDePago(pago({ monto: 333333.33, liqAlquiler: 333333.33, liqTotal: 333333.33 }));
    expect(c).toBe(26666.67);
  });

  it('la comisión sale sobre el alquiler, no sobre el total con expensas', () => {
    // 500.000 × 8% = 40.000. Sobre el total (600.000) daría 48.000: $8.000 de más.
    expect(comisionDePago(pago())).toBe(40000);
  });

  it('pondera por participación con varios dueños', () => {
    // 60% al 10% + 40% al 5% = 0,06 + 0,02 = 8%.
    const c = comisionDePago(
      pago({
        participaciones: [
          { porcentaje: 60, propietario: { comisionPct: 10 } },
          { porcentaje: 40, propietario: { comisionPct: 5 } },
        ],
      }),
    );
    expect(c).toBeCloseTo(40000, 2);
  });

  it('un dueño sin comisionPct no rompe la cuenta', () => {
    // `propietario` puede venir en null desde la query. Que eso devuelva NaN dejaría el día
    // entero sin comisión.
    const c = comisionDePago(pago({ participaciones: [{ porcentaje: 100, propietario: null }] }));
    expect(c).toBe(0);
  });
});

describe('totales del día', () => {
  it('con UNA sola moneda el total plano es válido y multiMoneda es false', () => {
    const t = totalizarCierre([pago(), pago()]);
    expect(t.multiMoneda).toBe(false);
    expect(t.cobrado).toBe(1200000);
    expect(t.comision).toBe(80000);
    expect(t.cantidad).toBe(2);
    expect(t.porMoneda).toHaveLength(1);
  });

  it('NUNCA suma monedas distintas: cada una en su bucket, y multiMoneda avisa', () => {
    // El total plano de un día mixto es un número que no existe. La única defensa es el flag:
    // si mintiera, el front muestra el total plano y la cajera cierra contra una cifra
    // inventada.
    const t = totalizarCierre([
      pago(),
      pago({ moneda: 'USD', monto: 800, liqAlquiler: 800, liqTotal: 800 }),
    ]);
    expect(t.multiMoneda).toBe(true);
    expect(t.porMoneda).toHaveLength(2);

    const ars = t.porMoneda.find((b) => b.moneda === 'ARS')!;
    const usd = t.porMoneda.find((b) => b.moneda === 'USD')!;
    expect(ars.cobrado).toBe(600000);
    expect(ars.cantidad).toBe(1);
    expect(usd.cobrado).toBe(800);
    expect(usd.comision).toBe(64); // 800 × 8%
    expect(usd.cantidad).toBe(1);
  });

  it('un pago sin moneda cae en ARS y no abre un bucket aparte', () => {
    // Los pagos viejos no tienen moneda. Tratarlos como una moneda distinta partiría el día en
    // dos por un dato ausente, y encendería multiMoneda sin motivo.
    const t = totalizarCierre([pago({ moneda: null }), pago()]);
    expect(t.multiMoneda).toBe(false);
    expect(t.porMoneda).toHaveLength(1);
    expect(t.porMoneda[0].moneda).toBe('ARS');
  });

  it('un día sin pagos da ceros, no NaN ni undefined', () => {
    const t = totalizarCierre([]);
    expect(t).toMatchObject({ cobrado: 0, comision: 0, cantidad: 0, multiMoneda: false });
    expect(t.porMoneda).toEqual([]);
    expect(t.lineas).toEqual([]);
  });

  it('devuelve una línea por pago, en el mismo orden en que entraron', () => {
    // El handler arma las filas de la pantalla haciendo zip por índice contra `lineas`. Si el
    // orden se moviera, cada fila mostraría la comisión de otro pago.
    const t = totalizarCierre([
      pago({ monto: 100 }),
      pago({ monto: 200 }),
      pago({ monto: 300 }),
    ]);
    expect(t.lineas.map((l) => l.monto)).toEqual([100, 200, 300]);
  });

  it('los totales no arrastran artefactos binarios de los floats', () => {
    // cobrado/comision son acumuladores float. Sin el redondeo final, 0.1 + 0.2 se filtra al
    // JSON como 0.30000000000000004 y la cajera ve un centavo fantasma.
    const t = totalizarCierre([
      pago({ monto: 0.1, liqAlquiler: 0.1, liqTotal: 0.1 }),
      pago({ monto: 0.2, liqAlquiler: 0.2, liqTotal: 0.2 }),
    ]);
    expect(t.cobrado).toBe(0.3);
  });

  it('el total del día es la suma de las comisiones ya redondeadas, no el redondeo de la suma', () => {
    // Importa porque la rendición persiste POR PAGO. Si el cierre redondeara recién al final,
    // cerraría distinto de lo que la rendición guardó pago por pago.
    const p = pago({ monto: 333333.33, liqAlquiler: 333333.33, liqTotal: 333333.33 });
    const t = totalizarCierre([p, p, p]);
    expect(t.comision).toBe(26666.67 * 3);
  });
});
