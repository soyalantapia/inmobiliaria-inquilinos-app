import { Prisma } from '@prisma/client';

/**
 * Estado inicial de un contrato EN CURSO ("está en la cuota 7 de 12"):
 * al cargar un contrato con fechaInicio en el pasado, el devengo genera todos
 * los períodos vencidos como si nadie hubiera pagado nunca. Este helper aplica
 * la confirmación por período que hace la inmobiliaria en el wizard:
 *
 *  - PAGADO  → pago SINTÉTICO CONCILIADO por el total (metodo EFECTIVO,
 *              fechaTransferencia = vencimiento) + liquidación PAGADO con
 *              fechaPago = vencimiento (la mora queda congelada en 0).
 *              Reusa el circuito real: cuenta corriente, saldos y KPIs
 *              cierran sin ningún caso especial.
 *  - PARCIAL → pago sintético por `montoPagado` + liquidación PARCIAL
 *              (+ mora histórica manual si vino).
 *  - ADEUDA  → sin pago; queda VENCIDO (+ mora manual si vino, que PISA el
 *              cálculo del esquema — ver calcularMora).
 *
 * Corre DENTRO de la transacción de POST /contratos, después del devengo.
 * Lanza EstadoInicialInvalido (→ 400) ante datos inconsistentes.
 */

export type PeriodoAnterior = {
  periodo: string; // 'YYYY-MM'
  estado: 'PAGADO' | 'PARCIAL' | 'ADEUDA';
  montoPagado?: number;
  moraManual?: number;
};

export class EstadoInicialInvalido extends Error {}

const NOTA_MIGRACION = 'Migración: registrado al cargar el contrato en curso';

export async function aplicarEstadoInicial(
  tx: Prisma.TransactionClient,
  contrato: { id: string; inmobiliariaId: string },
  periodos: PeriodoAnterior[],
  decididoPorId: string,
): Promise<{ cerrados: number; parciales: number; adeudados: number }> {
  if (periodos.length === 0) return { cerrados: 0, parciales: 0, adeudados: 0 };

  const vistos = new Set<string>();
  for (const p of periodos) {
    if (vistos.has(p.periodo)) {
      throw new EstadoInicialInvalido(`El período ${p.periodo} aparece más de una vez`);
    }
    vistos.add(p.periodo);
  }

  const liqs = await tx.liquidacion.findMany({
    where: { contratoId: contrato.id, inmobiliariaId: contrato.inmobiliariaId },
    select: { id: true, periodo: true, montoTotal: true, fechaVencimiento: true },
  });
  const porPeriodo = new Map(liqs.map((l) => [l.periodo, l]));
  const ahora = new Date();

  // BATCHING (review state-tx): con la DB remota (Railway, ~50-150ms por query)
  // un loop de 2 queries awaiteadas por período rompía el timeout de la
  // transacción interactiva de Prisma (5s) con carteras largas. Acumulamos todo
  // y ejecutamos: 1 createMany (pagos) + 1 update masivo (PAGADAS, con
  // fechaPago = SU PROPIO vencimiento vía SQL) + pocas updates individuales
  // (parciales/mora manual, típicamente un puñado).
  const pagosData: Prisma.PagoCreateManyInput[] = [];
  const idsPagado: string[] = [];
  const updatesIndividuales: { id: string; data: Prisma.LiquidacionUpdateInput }[] = [];

  let cerrados = 0;
  let parciales = 0;
  let adeudados = 0;

  for (const p of periodos) {
    const liq = porPeriodo.get(p.periodo);
    if (!liq) {
      throw new EstadoInicialInvalido(`El período ${p.periodo} no corresponde a este contrato`);
    }
    // Solo períodos YA VENCIDOS: el estado inicial es historia, no futuro.
    if (liq.fechaVencimiento >= ahora) {
      throw new EstadoInicialInvalido(`El período ${p.periodo} todavía no venció — no lleva estado inicial`);
    }
    const total = Number(liq.montoTotal);
    const moraManual = p.moraManual != null ? Math.max(0, p.moraManual) : null;

    if (p.estado === 'PAGADO') {
      pagosData.push(pagoSintetico(contrato, liq, total, 'TOTAL', decididoPorId));
      idsPagado.push(liq.id);
      cerrados += 1;
    } else if (p.estado === 'PARCIAL') {
      const pagado = p.montoPagado ?? 0;
      if (pagado <= 0) {
        throw new EstadoInicialInvalido(`Indicá cuánto se pagó del período ${p.periodo}`);
      }
      if (pagado >= total) {
        throw new EstadoInicialInvalido(
          `El pago del período ${p.periodo} cubre el total — marcalo como Pagado`,
        );
      }
      pagosData.push(pagoSintetico(contrato, liq, pagado, 'PARCIAL', decididoPorId));
      updatesIndividuales.push({
        id: liq.id,
        data: { estado: 'PARCIAL', ...(moraManual != null ? { montoPunitorioManual: moraManual } : {}) },
      });
      parciales += 1;
    } else {
      // ADEUDA: el devengo ya la dejó VENCIDO; solo congelamos la mora si vino.
      if (moraManual != null) {
        updatesIndividuales.push({ id: liq.id, data: { montoPunitorioManual: moraManual } });
      }
      adeudados += 1;
    }
  }

  if (pagosData.length > 0) {
    await tx.pago.createMany({ data: pagosData });
  }
  if (idsPagado.length > 0) {
    // fechaPago = el vencimiento DE CADA liquidación (difiere por fila) → un solo
    // UPDATE con la propia columna; updateMany de Prisma no puede expresarlo.
    await tx.$executeRaw`
      UPDATE "liquidaciones"
      SET "estado" = 'PAGADO', "fechaPago" = "fechaVencimiento", "metodoPago" = 'EFECTIVO'
      WHERE "id" IN (${Prisma.join(idsPagado)})
    `;
  }
  for (const u of updatesIndividuales) {
    await tx.liquidacion.update({ where: { id: u.id }, data: u.data });
  }

  return { cerrados, parciales, adeudados };
}

function pagoSintetico(
  contrato: { id: string; inmobiliariaId: string },
  liq: { id: string; periodo: string; montoTotal: Prisma.Decimal; fechaVencimiento: Date },
  monto: number,
  tipo: 'TOTAL' | 'PARCIAL',
  decididoPorId: string,
): Prisma.PagoCreateManyInput {
  return {
    inmobiliariaId: contrato.inmobiliariaId,
    contratoId: contrato.id,
    liquidacionId: liq.id,
    periodo: liq.periodo,
    tipo,
    monto,
    montoLiqTotal: liq.montoTotal,
    metodo: 'EFECTIVO',
    // El pago histórico se asume en fecha (si debía mora, va como moraManual).
    fechaTransferencia: liq.fechaVencimiento,
    estado: 'CONCILIADO',
    observacion: NOTA_MIGRACION,
    decididoPorId,
    // informadoAt/decididoAt HISTÓRICOS (= vencimiento, igual que
    // fechaTransferencia): con decididoAt = new Date() esta plata vieja caía en
    // el CIERRE DE CAJA DE HOY como "cobrado hoy" (el dueño veía cobros que
    // nunca aprobó — bug caja 07/07) y el inquilino recibía "te validamos el
    // pago de <mes viejo>" como actividad reciente (ventana de 30 días de
    // /mis-novedades). La historia queda contada en su fecha real.
    informadoAt: liq.fechaVencimiento,
    decididoAt: liq.fechaVencimiento,
  };
}
