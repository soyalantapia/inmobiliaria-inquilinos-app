/**
 * `aplicarEstadoInicial` — cargar un contrato que YA ESTÁ EN CURSO ("está en la cuota 7 de 12").
 *
 * POR QUÉ IMPORTA. Al dar de alta un contrato con fecha de inicio pasada, el devengo genera
 * todos los períodos vencidos **como si nadie hubiera pagado nunca**. Este helper aplica lo que
 * la inmobiliaria confirma en el wizard: cuáles ya se pagaron, cuáles a medias y cuáles se
 * deben. Si se equivoca, el contrato entra a producción con la deuda mal desde el minuto cero —
 * y esa deuda es lo que se le reclama a una persona real.
 *
 * Se prueba con un cliente de transacción falso: sin base, corre en CI.
 *
 * EL CASO QUE MÁS VALE ESTÁ EN LAS FECHAS DEL PAGO SINTÉTICO. Los pagos que se crean son
 * históricos y se fechan en el **vencimiento de su cuota**, no en `new Date()`. El comentario
 * del código cuenta qué pasó cuando no era así (bug de caja del 07/07): esa plata vieja caía en
 * el **cierre de caja de HOY** como "cobrado hoy" —el dueño veía cobros que nunca aprobó— y al
 * inquilino le llegaba "te validamos el pago de <mes viejo>" como actividad reciente.
 */
import { describe, it, expect } from 'vitest';
import {
  aplicarEstadoInicial,
  EstadoInicialInvalido,
  type PeriodoAnterior,
} from '../src/lib/estado-inicial-contrato.js';

const CONTRATO = { id: 'cnt_1', inmobiliariaId: 'inmo_1' };
const USUARIO = 'usr_1';

/** Vencimientos en el pasado: el estado inicial es historia, no futuro. */
const VENC_ENERO = new Date('2026-01-10T00:00:00.000Z');
const VENC_FEBRERO = new Date('2026-02-10T00:00:00.000Z');

function txFalso() {
  const pagosCreados: Record<string, unknown>[] = [];
  const updates: { id: string; data: Record<string, unknown> }[] = [];
  const rawEjecutados: string[] = [];

  const tx = {
    liquidacion: {
      findMany: async () => [
        { id: 'liq_ene', periodo: '2026-01', montoTotal: 100000, fechaVencimiento: VENC_ENERO },
        { id: 'liq_feb', periodo: '2026-02', montoTotal: 100000, fechaVencimiento: VENC_FEBRERO },
      ],
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: where.id, data });
        return {};
      },
    },
    pago: {
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        pagosCreados.push(...data);
        return { count: data.length };
      },
    },
    // El UPDATE de las pagadas va por SQL crudo, porque `fechaPago` tiene que salir de la
    // propia columna `fechaVencimiento` de cada fila y `updateMany` no lo puede expresar.
    $executeRaw: async (strings: TemplateStringsArray) => {
      rawEjecutados.push(strings.join('?'));
      return 1;
    },
  };

  return { tx, pagosCreados, updates, rawEjecutados };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any-justified: el tx falso implementa sólo los modelos que este camino toca.
const correr = (periodos: PeriodoAnterior[], f = txFalso()) =>
  aplicarEstadoInicial(f.tx as any, CONTRATO, periodos, USUARIO).then((r) => ({ ...f, r }));

describe('el pago sintético se fecha en el PASADO, no hoy', () => {
  it('fechaTransferencia, informadoAt y decididoAt son el vencimiento de la cuota', async () => {
    // ESTE ES EL BUG QUE YA PASÓ (caja 07/07). Con `new Date()` esta plata vieja entraba al
    // cierre de caja de HOY como cobrada hoy: la cajera cerraba un día con cobros que nunca
    // ocurrieron ese día, y el propietario veía ingresos que no aprobó.
    const { pagosCreados } = await correr([{ periodo: '2026-01', estado: 'PAGADO' }]);
    const pago = pagosCreados[0]!;
    expect(pago.fechaTransferencia).toEqual(VENC_ENERO);
    expect(pago.informadoAt).toEqual(VENC_ENERO);
    expect(pago.decididoAt).toEqual(VENC_ENERO);
  });

  it('cada cuota se fecha en SU propio vencimiento, no todas en el mismo', async () => {
    const { pagosCreados } = await correr([
      { periodo: '2026-01', estado: 'PAGADO' },
      { periodo: '2026-02', estado: 'PAGADO' },
    ]);
    expect(pagosCreados.map((p) => p.decididoAt)).toEqual([VENC_ENERO, VENC_FEBRERO]);
  });

  it('el pago nace CONCILIADO y en efectivo, reusando el circuito real', async () => {
    // Se reusa el circuito de siempre para que cuenta corriente, saldos y KPIs cierren sin
    // ningún caso especial.
    const { pagosCreados } = await correr([{ periodo: '2026-01', estado: 'PAGADO' }]);
    expect(pagosCreados[0]).toMatchObject({ estado: 'CONCILIADO', metodo: 'EFECTIVO', tipo: 'TOTAL' });
  });
});

describe('PAGADO', () => {
  it('crea un pago por el total y marca la liquidación por SQL', async () => {
    const { pagosCreados, rawEjecutados, r } = await correr([{ periodo: '2026-01', estado: 'PAGADO' }]);
    expect(Number(pagosCreados[0]!.monto)).toBe(100000);
    expect(rawEjecutados).toHaveLength(1);
    expect(rawEjecutados[0]).toContain('fechaVencimiento');
    expect(r.cerrados).toBe(1);
  });
});

describe('PARCIAL', () => {
  it('crea el pago por lo pagado y deja la cuota PARCIAL', async () => {
    const { pagosCreados, updates, r } = await correr([
      { periodo: '2026-01', estado: 'PARCIAL', montoPagado: 40000 },
    ]);
    expect(Number(pagosCreados[0]!.monto)).toBe(40000);
    expect(pagosCreados[0]!.tipo).toBe('PARCIAL');
    expect(updates[0]!.data.estado).toBe('PARCIAL');
    expect(r.parciales).toBe(1);
  });

  it('sin monto es un error, no un pago de 0', async () => {
    // Un pago sintético de 0 dejaría la cuota PARCIAL sin nada pagado: figuraría en el estado
    // equivocado y la deuda no cerraría contra lo que dice la pantalla.
    await expect(correr([{ periodo: '2026-01', estado: 'PARCIAL' }])).rejects.toThrow(EstadoInicialInvalido);
  });

  it('si el pago cubre el total, obliga a marcarlo Pagado', async () => {
    // Un "parcial" que cubre todo dejaría la cuota PARCIAL con saldo 0: inconsistente para
    // cualquiera que después mire el estado en vez del saldo.
    await expect(
      correr([{ periodo: '2026-01', estado: 'PARCIAL', montoPagado: 100000 }]),
    ).rejects.toThrow(/marcalo como Pagado/);
  });
});

describe('ADEUDA', () => {
  it('no crea ningún pago: el devengo ya la dejó VENCIDO', async () => {
    const { pagosCreados, r } = await correr([{ periodo: '2026-01', estado: 'ADEUDA' }]);
    expect(pagosCreados).toEqual([]);
    expect(r.adeudados).toBe(1);
  });

  it('congela la mora histórica si vino', async () => {
    // La mora manual PISA el cálculo del esquema: es la que la inmobiliaria acordó de verdad,
    // no la que saldría de aplicar la tasa a un período viejo.
    const { updates } = await correr([{ periodo: '2026-01', estado: 'ADEUDA', moraManual: 15000 }]);
    expect(updates[0]!.data.montoPunitorioManual).toBe(15000);
  });

  it('una mora negativa se recorta a 0, no genera un crédito', async () => {
    // Una mora negativa restaría deuda: le bajaría el total a pagar por un dato mal tipeado.
    const { updates } = await correr([{ periodo: '2026-01', estado: 'ADEUDA', moraManual: -5000 }]);
    expect(updates[0]!.data.montoPunitorioManual).toBe(0);
  });
});

describe('validaciones que frenan un alta inconsistente', () => {
  it('un período repetido se rechaza', async () => {
    // Sin esto se crearían DOS pagos sintéticos para la misma cuota: la cuenta corriente
    // arrancaría con el doble de lo que se pagó.
    await expect(
      correr([
        { periodo: '2026-01', estado: 'PAGADO' },
        { periodo: '2026-01', estado: 'PAGADO' },
      ]),
    ).rejects.toThrow(/más de una vez/);
  });

  it('un período que no es del contrato se rechaza', async () => {
    await expect(correr([{ periodo: '2025-12', estado: 'PAGADO' }])).rejects.toThrow(
      /no corresponde a este contrato/,
    );
  });

  it('un período que TODAVÍA no venció se rechaza', async () => {
    // El estado inicial es historia, no futuro: marcar como pagada una cuota que aún no venció
    // adelantaría plata que nadie cobró.
    const f = txFalso();
    const futuro = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    f.tx.liquidacion.findMany = async () => [
      { id: 'liq_fut', periodo: '2099-01', montoTotal: 100000, fechaVencimiento: futuro },
    ];
    await expect(correr([{ periodo: '2099-01', estado: 'PAGADO' }], f)).rejects.toThrow(
      /todavía no venció/,
    );
  });

  it('sin períodos no hace nada ni toca la base', async () => {
    const { pagosCreados, updates, rawEjecutados, r } = await correr([]);
    expect(r).toEqual({ cerrados: 0, parciales: 0, adeudados: 0 });
    expect([pagosCreados, updates, rawEjecutados].every((x) => x.length === 0)).toBe(true);
  });
});

describe('los contadores que ve el operador', () => {
  it('cuentan por separado cerrados, parciales y adeudados', async () => {
    const { r } = await correr([
      { periodo: '2026-01', estado: 'PAGADO' },
      { periodo: '2026-02', estado: 'PARCIAL', montoPagado: 30000 },
    ]);
    expect(r).toEqual({ cerrados: 1, parciales: 1, adeudados: 0 });
  });
});
